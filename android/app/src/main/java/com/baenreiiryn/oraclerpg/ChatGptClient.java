package com.baenreiiryn.oraclerpg;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Iterator;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.FormBody;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.BufferedSource;

public final class ChatGptClient {
    private static final String AUTH_URL = "https://auth.openai.com/api/accounts/authorize";
    private static final String TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
    private static final String RESOURCE = "https://api.openai.com/v1";
    private static final String PREFS = "oracle_public";
    private static final String HOST_ID = "host_id";
    private static final String PENDING = "oauth_pending";
    private static final int PORT = 31415;

    private final Context context;
    private final SecureStore secureStore;
    private final SharedPreferences preferences;
    private final OkHttpClient http;
    private final JwtVerifier jwtVerifier;
    private final Object refreshLock = new Object();

    public ChatGptClient(Context context) {
        this.context = context.getApplicationContext();
        this.secureStore = new SecureStore(context);
        this.preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.http = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.SECONDS)
                .build();
        this.jwtVerifier = new JwtVerifier(http);
    }

    public OkHttpClient http() {
        return http;
    }

    private String randomToken(int bytes) {
        byte[] data = new byte[bytes];
        new SecureRandom().nextBytes(data);
        return Base64.encodeToString(data, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private String sha256Url(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.US_ASCII));
        return Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private String hostId() {
        String current = preferences.getString(HOST_ID, null);
        if (current != null && !current.isEmpty()) return current;
        current = "urn:uuid:" + UUID.randomUUID();
        preferences.edit().putString(HOST_ID, current).apply();
        return current;
    }

    private JSONObject registration() {
        String value = secureStore.load();
        if (value == null) return null;
        try {
            return new JSONObject(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    public Object accountStatus() {
        JSONObject registration = registration();
        if (registration == null) return JSONObject.NULL;
        JSONObject result = new JSONObject();
        try {
            result.put("email", registration.optString("email", null));
            result.put("name", registration.optString("name", null));
            result.put("clientId", registration.optString("client_id", null));
            result.put("scopes", registration.optJSONArray("scopes") == null ? new JSONArray() : registration.optJSONArray("scopes"));
            result.put("connected", !registration.optString("access_token").isEmpty()
                    && !registration.optString("refresh_token").isEmpty());
        } catch (Exception ignored) {}
        return result;
    }

    public void startAuthorization() throws Exception {
        JSONObject existing = registration();
        String verifier = randomToken(48);
        String state = randomToken(32);
        String nonce = randomToken(32);
        String callback = "http://127.0.0.1:" + PORT + "/auth/callback";
        boolean initial = existing == null || existing.optString("client_id").isEmpty();
        String clientId = initial ? "dynamic_agent_client" : existing.optString("client_id");

        JSONObject pending = new JSONObject();
        pending.put("verifier", verifier);
        pending.put("state", state);
        pending.put("nonce", nonce);
        pending.put("callback", callback);
        pending.put("client_id", clientId);
        pending.put("expected_sub", existing == null ? "" : existing.optString("subject"));
        pending.put("created_at", System.currentTimeMillis());
        secureStore.save(PENDING, pending.toString());

        Uri.Builder builder = Uri.parse(AUTH_URL).buildUpon()
                .appendQueryParameter("client_id", clientId)
                .appendQueryParameter("ext_agent_host_id", hostId())
                .appendQueryParameter("response_type", "code")
                .appendQueryParameter("redirect_uri", callback)
                .appendQueryParameter("scope", "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct")
                .appendQueryParameter("resource", RESOURCE)
                .appendQueryParameter("state", state)
                .appendQueryParameter("nonce", nonce)
                .appendQueryParameter("code_challenge_method", "S256")
                .appendQueryParameter("code_challenge", sha256Url(verifier));

        if (initial) {
            builder.appendQueryParameter("agent_name_hint", "OracleRPG");
        } else {
            String idToken = existing.optString("id_token");
            String email = existing.optString("email");
            if (!idToken.isEmpty()) builder.appendQueryParameter("id_token_hint", idToken);
            if (!email.isEmpty()) builder.appendQueryParameter("login_hint", email);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, builder.build());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    public JSONObject completeAuthorization(Uri callback) throws Exception {
        String pendingRaw = secureStore.load(PENDING);
        secureStore.clear(PENDING);
        if (pendingRaw == null) throw new IllegalStateException("No OAuth attempt is active.");
        JSONObject pending = new JSONObject(pendingRaw);
        if (System.currentTimeMillis() - pending.optLong("created_at") > 10 * 60 * 1000L) {
            throw new IllegalStateException("OAuth attempt expired.");
        }
        if (!pending.getString("state").equals(callback.getQueryParameter("state"))) {
            throw new IllegalStateException("Invalid OAuth state.");
        }
        String error = callback.getQueryParameter("error");
        if (error != null) throw new IllegalStateException(error);
        String code = callback.getQueryParameter("code");
        if (code == null || code.isEmpty()) throw new IllegalStateException("Missing authorization code.");

        String issuedClient = callback.getQueryParameter("client_id");
        if (issuedClient == null) issuedClient = callback.getQueryParameter("issued_client_id");
        if (issuedClient == null || issuedClient.isEmpty()) issuedClient = pending.getString("client_id");
        if ("dynamic_agent_client".equals(issuedClient)) {
            throw new IllegalStateException("OpenAI did not return the issued client ID.");
        }

        FormBody body = new FormBody.Builder()
                .add("grant_type", "authorization_code")
                .add("client_id", issuedClient)
                .add("code", code)
                .add("code_verifier", pending.getString("verifier"))
                .add("redirect_uri", pending.getString("callback"))
                .add("resource", RESOURCE)
                .build();
        Request request = new Request.Builder().url(TOKEN_URL).post(body).build();
        JSONObject tokens;
        try (Response response = http.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IllegalStateException("Token exchange failed (" + response.code() + ").");
            }
            tokens = new JSONObject(response.body().string());
        }

        String idToken = tokens.optString("id_token");
        String accessToken = tokens.optString("access_token");
        String refreshToken = tokens.optString("refresh_token");
        if (idToken.isEmpty() || accessToken.isEmpty() || refreshToken.isEmpty()) {
            throw new IllegalStateException("Incomplete OAuth response.");
        }

        JSONObject claims = jwtVerifier.verify(idToken, pending.getString("nonce"), issuedClient);
        String expectedSub = pending.optString("expected_sub");
        if (!expectedSub.isEmpty() && !expectedSub.equals(claims.optString("sub"))) {
            throw new IllegalStateException("Authorized account differs from saved registration.");
        }

        String scopeText = tokens.optString("scope");
        JSONArray scopes = new JSONArray();
        boolean direct = false;
        for (String scope : scopeText.split("\\s+")) {
            if (scope.isEmpty()) continue;
            scopes.put(scope);
            if ("chatgpt.tokens.use.direct".equals(scope)) direct = true;
        }
        if (!direct) throw new IllegalStateException("ChatGPT plan usage permission was not granted.");

        JSONObject saved = new JSONObject();
        saved.put("client_id", issuedClient);
        saved.put("subject", claims.getString("sub"));
        saved.put("email", claims.optString("email", null));
        saved.put("name", claims.optString("name", null));
        saved.put("id_token", idToken);
        saved.put("access_token", accessToken);
        saved.put("refresh_token", refreshToken);
        saved.put("expires_in", tokens.optLong("expires_in", 3600));
        saved.put("saved_at", System.currentTimeMillis());
        saved.put("scopes", scopes);
        secureStore.save(saved.toString());
        return saved;
    }

    private JSONObject activeRegistration() throws Exception {
        JSONObject current = registration();
        if (current == null || current.optString("access_token").isEmpty()) {
            throw new IllegalStateException("ChatGPT is not connected.");
        }
        long expiresAt = current.optLong("saved_at") + current.optLong("expires_in", 3600) * 1000L;
        if (System.currentTimeMillis() < expiresAt - 5 * 60 * 1000L) return current;

        synchronized (refreshLock) {
            current = registration();
            expiresAt = current.optLong("saved_at") + current.optLong("expires_in", 3600) * 1000L;
            if (System.currentTimeMillis() < expiresAt - 5 * 60 * 1000L) return current;
            return refresh(current);
        }
    }

    private JSONObject refresh(JSONObject old) throws Exception {
        FormBody body = new FormBody.Builder()
                .add("grant_type", "refresh_token")
                .add("client_id", old.getString("client_id"))
                .add("refresh_token", old.getString("refresh_token"))
                .add("resource", RESOURCE)
                .build();
        Request request = new Request.Builder().url(TOKEN_URL).post(body).build();
        JSONObject tokens;
        try (Response response = http.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IllegalStateException("Token refresh failed (" + response.code() + ").");
            }
            tokens = new JSONObject(response.body().string());
        }
        Iterator<String> keys = tokens.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            old.put(key, tokens.get(key));
        }
        old.put("saved_at", System.currentTimeMillis());
        if (tokens.has("scope")) {
            JSONArray scopes = new JSONArray();
            for (String scope : tokens.optString("scope").split("\\s+")) {
                if (!scope.isEmpty()) scopes.put(scope);
            }
            old.put("scopes", scopes);
        }
        secureStore.save(old.toString());
        return old;
    }

    public JSONObject listModels() throws Exception {
        JSONObject registration = activeRegistration();
        Request request = new Request.Builder()
                .url(RESOURCE + "/models")
                .header("Authorization", "Bearer " + registration.getString("access_token"))
                .build();
        try (Response response = http.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IllegalStateException("Model list failed (" + response.code() + ").");
            }
            JSONObject raw = new JSONObject(response.body().string());
            JSONArray source = raw.optJSONArray("models");
            JSONArray models = new JSONArray();
            if (source != null) {
                for (int i = 0; i < source.length(); i++) {
                    JSONObject model = source.getJSONObject(i);
                    if (!"list".equals(model.optString("visibility"))) continue;
                    JSONObject item = new JSONObject();
                    item.put("slug", model.optString("slug"));
                    item.put("displayName", model.optString("display_name", model.optString("slug")));
                    models.put(item);
                }
            }
            JSONObject result = new JSONObject();
            result.put("models", models);
            return result;
        }
    }

    public JSONObject runResponse(JSONObject payload) throws Exception {
        JSONObject registration = activeRegistration();
        JSONObject requestJson = new JSONObject();
        requestJson.put("model", payload.getString("model"));
        if (payload.has("instructions")) requestJson.put("instructions", payload.get("instructions"));
        requestJson.put("input", payload.getJSONArray("input"));
        if (payload.has("tools")) requestJson.put("tools", payload.getJSONArray("tools"));
        requestJson.put("store", false);
        requestJson.put("stream", true);

        RequestBody requestBody = RequestBody.create(
                requestJson.toString(),
                MediaType.get("application/json; charset=utf-8")
        );
        Request request = new Request.Builder()
                .url(RESOURCE + "/responses")
                .header("Authorization", "Bearer " + registration.getString("access_token"))
                .post(requestBody)
                .build();

        try (Response response = http.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                String detail = response.body() == null ? "" : response.body().string();
                throw new IllegalStateException("Responses request failed (" + response.code() + "): " + detail);
            }
            BufferedSource source = response.body().source();
            JSONObject completed = null;
            StringBuilder event = new StringBuilder();
            while (!source.exhausted()) {
                String line = source.readUtf8Line();
                if (line == null) break;
                if (!line.isEmpty()) {
                    event.append(line).append("\n");
                    continue;
                }
                JSONObject parsed = parseSseEvent(event.toString());
                event.setLength(0);
                if (parsed == null) continue;
                String type = parsed.optString("type");
                if ("response.completed".equals(type)) {
                    completed = parsed.optJSONObject("response");
                } else if ("response.failed".equals(type)) {
                    JSONObject failure = parsed.optJSONObject("response");
                    JSONObject error = failure == null ? null : failure.optJSONObject("error");
                    throw new IllegalStateException(error == null ? "Response failed." : error.optString("message", "Response failed."));
                } else if ("response.incomplete".equals(type)) {
                    throw new IllegalStateException("Response was incomplete.");
                }
            }
            if (completed == null) throw new IllegalStateException("Stream ended before response.completed.");
            return completed;
        }
    }

    private JSONObject parseSseEvent(String raw) {
        for (String line : raw.split("\\n")) {
            if (!line.startsWith("data:")) continue;
            String data = line.substring(5).trim();
            if (data.isEmpty() || "[DONE]".equals(data)) return null;
            try {
                return new JSONObject(data);
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    public void logout() {
        secureStore.clear();
        secureStore.clear(PENDING);
    }
}
