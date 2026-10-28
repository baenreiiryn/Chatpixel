package com.baenreiiryn.chatpixel;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import java.util.Base64;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;
final class SecureStore {
 private final Context context;
 SecureStore(Context context){this.context=context.getApplicationContext();}
 private javax.crypto.SecretKey key() throws Exception {KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias("chatpixel-oauth")){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("chatpixel-oauth",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (javax.crypto.SecretKey)ks.getKey("chatpixel-oauth",null);}
 JSONObject load() throws Exception {String v=context.getSharedPreferences("secure",0).getString("credentials",null);if(v==null)return new JSONObject();String[] parts=v.split(":");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));return new JSONObject(new String(c.doFinal(Base64.getDecoder().decode(parts[1])),java.nio.charset.StandardCharsets.UTF_8));}
 void save(JSONObject data) throws Exception {Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String value=Base64.getEncoder().encodeToString(c.getIV())+":"+Base64.getEncoder().encodeToString(c.doFinal(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));if(!context.getSharedPreferences("secure",0).edit().putString("credentials",value).commit())throw new Exception("Não foi possível salvar a conexão.");}
 void clear(){context.getSharedPreferences("secure",0).edit().remove("credentials").commit();}
}
