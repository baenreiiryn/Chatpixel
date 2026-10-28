package com.baenreiiryn.chatpixel;
import android.app.*;
import android.content.Intent;
import android.os.*;
public final class LoginService extends Service {
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("chatpixel-login","Conexão com ChatGPT",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification notification=new Notification.Builder(this,"chatpixel-login").setSmallIcon(com.baenreiiryn.chatpixel.R.drawable.icon).setContentTitle("Conectando Chatpixel").setContentText("Conclua o login no navegador e volte ao jogo.").setContentIntent(open).build();
  startForeground(1,notification);new Handler(Looper.getMainLooper()).postDelayed(this::stopSelf,600000);return START_NOT_STICKY;
 }
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public void onTimeout(int startId,int fgsType){stopSelf();}
}
