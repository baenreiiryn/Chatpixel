package com.baenreiiryn.chatpixel;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import org.json.*;
final class AuthProtocol {
 static String random(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 static String challenge(String verifier) throws Exception{return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));}
 static boolean sameState(String expected,String actual){return expected!=null&&actual!=null&&!expected.isEmpty()&&MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),actual.getBytes(StandardCharsets.UTF_8));}
 static String resolveClient(String saved,String returned){String client=returned==null?saved:returned;if(client==null||client.isEmpty()||client.equals("dynamic_agent_client")||(saved!=null&&!saved.equals(client)))throw new IllegalArgumentException("Registro de login incompleto ou diferente.");return client;}
 static boolean claimsValid(JSONObject claims,String client,String nonce,long now){Object aud=claims.opt("aud");boolean audience=client.equals(aud);if(aud instanceof JSONArray){JSONArray a=(JSONArray)aud;for(int i=0;i<a.length();i++)audience|=client.equals(a.optString(i));}return "https://auth.openai.com".equals(claims.optString("iss"))&&audience&&claims.optLong("exp",0)>now&&nonce.equals(claims.optString("nonce"))&&!claims.optString("sub").isEmpty();}
}
