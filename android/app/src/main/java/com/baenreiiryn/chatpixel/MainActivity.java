package com.baenreiiryn.chatpixel;
import android.app.*;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.*;
public final class MainActivity extends Activity {
 private WebView web;private GameServer server;private boolean openingLogin=false;
 @Override public void onCreate(Bundle state){super.onCreate(state);
  try{server=GameRuntime.get(this);}catch(Exception e){TextView error=new TextView(this);error.setText("Não foi possível iniciar o jogo. Feche e reabra o Chatpixel.");setContentView(error);return;}
  getWindow().setStatusBarColor(Color.rgb(11,16,15));getWindow().setNavigationBarColor(Color.rgb(11,16,15));getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(11,16,15));
  root.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());android.graphics.Insets ime=insets.getInsets(WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  web=new WebView(this);web.setBackgroundColor(Color.rgb(11,16,15));WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);settings.setUserAgentString(settings.getUserAgentString()+" ChatpixelAndroid/0.2.0");
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);CookieManager.getInstance().setCookie(server.base(),"chatpixel="+server.secret+"; HttpOnly; SameSite=Strict; Path=/");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri u=request.getUrl();if(!request.isForMainFrame())return true;
    if(u.toString().equals(server.base()+"/auth/login")){beginLogin();return true;}
    return !u.toString().equals(server.base()+"/")&&!u.toString().equals(server.base()+"/index.html");
   }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){Uri u=request.getUrl();if(!"http".equals(u.getScheme())||!"127.0.0.1".equals(u.getHost())||u.getPort()!=server.getListeningPort())return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));return null;}
  });
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);web.loadUrl(server.base()+"/");
 }
 private void beginLogin(){if(openingLogin)return;openingLogin=true;
  try{startForegroundService(new Intent(this,LoginService.class));}catch(Exception ignored){}
  new Thread(()->{try{String url=server.auth.begin(server.base());runOnUiThread(()->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception e){Toast.makeText(this,"Instale um navegador para fazer login.",Toast.LENGTH_LONG).show();}finally{openingLogin=false;}});}catch(Exception e){runOnUiThread(()->{openingLogin=false;Toast.makeText(this,"Não foi possível iniciar o login. Tente novamente.",Toast.LENGTH_LONG).show();});}},"chatpixel-login").start();
 }
 @Override protected void onResume(){super.onResume();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('chatpixel:resume'))",null);}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('chatpixel:resume'))",null);}
 @Override public void onBackPressed(){new AlertDialog.Builder(this).setMessage("Fechar o Chatpixel? Sua cena está salva neste aparelho.").setPositiveButton("Fechar",(d,w)->finish()).setNegativeButton("Continuar",null).show();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
