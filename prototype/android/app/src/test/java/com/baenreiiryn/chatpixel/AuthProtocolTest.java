package com.baenreiiryn.chatpixel;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
public class AuthProtocolTest {
 @Test public void pkceMatchesRfc7636Vector() throws Exception { assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", AuthProtocol.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")); }
 @Test public void rejectsMissingAndMismatchedState() { assertFalse(AuthProtocol.sameState(null,null));assertFalse(AuthProtocol.sameState("a","b"));assertTrue(AuthProtocol.sameState("random-state","random-state")); }
 @Test public void rejectsMissingExpiryAndWrongAudience() throws Exception {
  JSONObject c=new JSONObject().put("iss","https://auth.openai.com").put("aud","client").put("sub","user").put("nonce","nonce");
  assertFalse(AuthProtocol.claimsValid(c,"client","nonce",100));c.put("exp",200);assertTrue(AuthProtocol.claimsValid(c,"client","nonce",100));assertFalse(AuthProtocol.claimsValid(c,"other","nonce",100));assertFalse(AuthProtocol.claimsValid(c,"client","wrong",100));assertFalse(AuthProtocol.claimsValid(c,"client","nonce",201));
 }
 @Test public void returningRegistrationCannotChangeClient() { assertEquals("saved",AuthProtocol.resolveClient("saved",null));assertEquals("issued",AuthProtocol.resolveClient(null,"issued"));try{AuthProtocol.resolveClient("saved","other");fail();}catch(IllegalArgumentException expected){}try{AuthProtocol.resolveClient(null,"dynamic_agent_client");fail();}catch(IllegalArgumentException expected){} }
}
