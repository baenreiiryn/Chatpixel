package com.baenreiiryn.chatpixel;
import android.content.Context;
import android.content.Intent;
import fi.iki.elonen.NanoHTTPD;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
final class GameServer extends NanoHTTPD {
 final String secret=AuthProtocol.random();final AuthManager auth;private final Context context;
 GameServer(Context context,AuthManager auth){super("127.0.0.1",localPort(context));this.context=context.getApplicationContext();this.auth=auth;}
 private static int localPort(Context c){android.content.SharedPreferences p=c.getSharedPreferences("host",0);int port=p.getInt("port",0);if(port==0){port=20000+new java.security.SecureRandom().nextInt(30000);p.edit().putInt("port",port).commit();}return port;}
 String base(){return "http://127.0.0.1:"+getListeningPort();}
 private Response json(JSONObject data,Response.IStatus code){Response r=newFixedLengthResponse(code,"application/json; charset=utf-8",data.toString());r.addHeader("Cache-Control","no-store");return r;}
 private JSONObject error(String text){try{return new JSONObject().put("error",text);}catch(Exception e){throw new IllegalStateException(e);}}
 private boolean authenticated(IHTTPSession s){String cookie=s.getHeaders().get("cookie");return cookie!=null&&Arrays.asList(cookie.split(";\\s*")).contains("chatpixel="+secret);}
 @Override public Response serve(IHTTPSession s){
  try{
   if(!("127.0.0.1:"+getListeningPort()).equals(s.getHeaders().get("host")))return json(error("Host inválido"),Response.Status.FORBIDDEN);
   String path=s.getUri();
   if(path.equals("/auth/callback")&&s.getMethod()==Method.GET){
    String message;boolean ok;
    try{Map<String,String> query=new HashMap<>();for(Map.Entry<String,List<String>> e:s.getParameters().entrySet())query.put(e.getKey(),e.getValue().get(0));auth.finish(query);ok=true;message="Conexão concluída. Volte ao jogo para escolher o modelo.";context.stopService(new Intent(context,LoginService.class));}
    catch(Exception e){ok=false;message=e.getMessage();}
    String safe=message.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");
    Response r=newFixedLengthResponse(ok?Response.Status.OK:Response.Status.BAD_REQUEST,"text/html; charset=utf-8","<!doctype html><html lang='pt-BR'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Chatpixel</title><body style='background:#14271f;color:#e8ede8;font:18px system-ui;padding:32px'><h1>Chatpixel</h1><p>"+safe+"</p><p><a style='display:inline-block;background:#bce68d;color:#14271f;padding:18px;border-radius:8px' href='chatpixel://auth-complete'>Voltar ao Chatpixel</a></p></body></html>");r.addHeader("Cache-Control","no-store");r.addHeader("Referrer-Policy","no-referrer");return r;
   }
   if(path.equals("/api/session")&&s.getMethod()==Method.GET)return json(new JSONObject().put("connected",authenticated(s)&&auth.connected()).put("planEnabled",authenticated(s)&&auth.planEnabled()),Response.Status.OK);
   if(path.startsWith("/api/")||path.equals("/auth/logout")){
    if(!authenticated(s))return json(error("Sessão local inválida. Reabra o aplicativo."),Response.Status.UNAUTHORIZED);
    if(s.getMethod()==Method.POST&&!base().equals(s.getHeaders().get("origin")))return json(error("Origem inválida"),Response.Status.FORBIDDEN);
    if(path.equals("/api/models")&&s.getMethod()==Method.GET)return json(new JSONObject().put("models",auth.models()),Response.Status.OK);
    if(path.equals("/auth/logout")&&s.getMethod()==Method.POST){auth.logout();return json(new JSONObject().put("ok",true),Response.Status.OK);}
    if(path.equals("/api/interpret")&&s.getMethod()==Method.POST){int length=Integer.parseInt(s.getHeaders().getOrDefault("content-length","0"));if(length<=0||length>64000)return json(error("Mensagem muito grande ou vazia"),Response.Status.BAD_REQUEST);Map<String,String> body=new HashMap<>();s.parseBody(body);String value=body.get("postData");if(value==null||value.length()>64000)throw new Exception("Mensagem inválida");return json(auth.interpret(new JSONObject(value)),Response.Status.OK);}
    return json(error("Não encontrado"),Response.Status.NOT_FOUND);
   }
   Map<String,String> files=new HashMap<>();files.put("/","index.html");for(String name:new String[]{"index.html","style.css","app.js","engine.js","renderer.js","world.js","journey.js","scenery.js"})files.put("/"+name,name);
   if(s.getMethod()!=Method.GET||!files.containsKey(path))return json(error("Não encontrado"),Response.Status.NOT_FOUND);
   String name=files.get(path),type=name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":"text/html";
   InputStream stream=context.getAssets().open(name);Response r=newChunkedResponse(Response.Status.OK,type+"; charset=utf-8",stream);r.addHeader("Content-Security-Policy","default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");r.addHeader("X-Content-Type-Options","nosniff");return r;
  }catch(Exception e){return json(error(e.getMessage()==null?"Falha ao processar a solicitação.":e.getMessage()),Response.Status.BAD_REQUEST);}
 }
}
