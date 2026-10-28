package com.baenreiiryn.oraclerpg;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public final class JwtVerifier {
    private static final String JWKS_URL = "https://auth.openai.com/.well-known/jwks.json";
    private final OkHttpClient http;

    public JwtVerifier(OkHttpClient http) {
        this.http = http;
    }

    private byte[] decodeUrl(String value) {
        return Base64.decode(value, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private RSAPublicKey fetchKey(String kid) throws Exception {
        Request request = new Request.Builder().url(JWKS_URL).build();
        try (Response response = http.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IllegalStateException("Could not load OpenAI JWKS.");
            }
            JSONObject json = new JSONObject(response.body().string());
            JSONArray keys = json.getJSONArray("keys");
            for (int i = 0; i < keys.length(); i++) {
                JSONObject key = keys.getJSONObject(i);
                if (!kid.equals(key.optString("kid"))) continue;
                BigInteger modulus = new BigInteger(1, decodeUrl(key.getString("n")));
                BigInteger exponent = new BigInteger(1, decodeUrl(key.getString("e")));
                RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
                return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
            }
        }
        throw new IllegalStateException("OpenAI signing key was not found.");
    }

    public JSONObject verify(String jwt, String nonce, String audience) throws Exception {
        String[] parts = jwt.split("\\.");
        if (parts.length != 3) throw new IllegalArgumentException("Invalid ID token.");

        JSONObject header = new JSONObject(new String(decodeUrl(parts[0]), StandardCharsets.UTF_8));
        if (!"RS256".equals(header.optString("alg"))) {
            throw new IllegalStateException("Unexpected ID token algorithm.");
        }

        RSAPublicKey publicKey = fetchKey(header.getString("kid"));
        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(publicKey);
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        if (!verifier.verify(decodeUrl(parts[2]))) {
            throw new IllegalStateException("Invalid ID token signature.");
        }

        JSONObject payload = new JSONObject(new String(decodeUrl(parts[1]), StandardCharsets.UTF_8));
        if (!"https://auth.openai.com".equals(payload.optString("iss"))) {
            throw new IllegalStateException("Invalid ID token issuer.");
        }
        if (!nonce.equals(payload.optString("nonce"))) {
            throw new IllegalStateException("Invalid ID token nonce.");
        }

        boolean audienceOk = audience.equals(payload.optString("aud"));
        Object aud = payload.opt("aud");
        if (!audienceOk && aud instanceof JSONArray) {
            JSONArray values = (JSONArray) aud;
            for (int i = 0; i < values.length(); i++) {
                if (audience.equals(values.optString(i))) {
                    audienceOk = true;
                    break;
                }
            }
        }
        if (!audienceOk) throw new IllegalStateException("Invalid ID token audience.");

        long now = System.currentTimeMillis() / 1000L;
        if (payload.optLong("exp", 0L) <= now) {
            throw new IllegalStateException("Expired ID token.");
        }
        if (payload.optString("sub").isEmpty()) {
            throw new IllegalStateException("ID token has no subject.");
        }
        return payload;
    }
}
