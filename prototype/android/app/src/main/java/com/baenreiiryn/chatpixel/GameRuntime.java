package com.baenreiiryn.chatpixel;
import android.content.Context;
final class GameRuntime {
 private static GameServer server;
 static synchronized GameServer get(Context context) throws Exception {if(server==null){server=new GameServer(context,new AuthManager(context));server.start(120000,false);}return server;}
}
