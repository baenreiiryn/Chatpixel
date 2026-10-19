package com.baenreiiryn.oraclerpg;

import android.app.Activity;
import android.content.ClipData;
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
import android.webkit.ValueCallback;
import android.widget.FrameLayout;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    private WebView webView;
    private UpdateManager updates;
    private ValueCallback<Uri[]> fileChooserCallback;
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
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;

                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("image/*");
                picker.putExtra(
                        Intent.EXTRA_ALLOW_MULTIPLE,
                        fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE
                );
                startActivityForResult(picker, FILE_CHOOSER_REQUEST_CODE);
                return true;
            }
        });
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
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            ValueCallback<Uri[]> callback = fileChooserCallback;
            fileChooserCallback = null;

            if (callback != null) {
                callback.onReceiveValue(extractSelectedImages(resultCode, data));
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private static Uri[] extractSelectedImages(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null) return null;

        ClipData clipData = data.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {
            Uri[] uris = new Uri[clipData.getItemCount()];
            for (int i = 0; i < clipData.getItemCount(); i++) {
                uris[i] = clipData.getItemAt(i).getUri();
            }
            return uris;
        }

        Uri uri = data.getData();
        return uri == null ? null : new Uri[]{uri};
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
    protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        super.onDestroy();
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
