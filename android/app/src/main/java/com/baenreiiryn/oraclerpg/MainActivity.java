package com.baenreiiryn.oraclerpg;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public final class MainActivity extends Activity {
    private WebView webView;
    private UpdateManager updates;
    private final String oracleHost = Uri.parse(BuildConfig.ORACLE_URL).getHost();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 6, 12));
        getWindow().setNavigationBarColor(Color.rgb(7, 6, 12));

        OracleBridgeServer.get(this).start();
        updates = new UpdateManager(this);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 6, 12));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString()
                + " OracleRPG-Android/" + BuildConfig.VERSION_NAME);
        settings.setMediaPlaybackRequiresUserGesture(false);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setBackgroundColor(Color.rgb(7, 6, 12));
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (oracleHost != null && oracleHost.equalsIgnoreCase(uri.getHost())) return false;
                Intent external = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(external);
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(BuildConfig.ORACLE_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }

        root.postDelayed(() -> updates.check(false), 2500);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (updates != null) updates.resumePendingInstall();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
