package com.baenreiiryn.oraclerpg;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public final class UpdateManager {
    private static final String PREFS = "oracle_updates";
    private static final String PENDING_APK = "pending_apk";
    private static final String API = "https://api.github.com/repos/" + BuildConfig.GITHUB_REPO + "/releases/latest";

    private final Activity activity;
    private final OkHttpClient http = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .build();

    public UpdateManager(Activity activity) {
        this.activity = activity;
    }

    public void check(boolean manual) {
        Request request = new Request.Builder()
                .url(API)
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "OracleRPG-Android/" + BuildConfig.VERSION_NAME)
                .build();
        http.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, java.io.IOException error) {
                if (manual) activity.runOnUiThread(() ->
                        Toast.makeText(activity, "Não foi possível verificar atualizações.", Toast.LENGTH_SHORT).show());
            }

            @Override
            public void onResponse(Call call, Response response) {
                try (Response result = response) {
                    if (!result.isSuccessful() || result.body() == null) {
                        if (manual) activity.runOnUiThread(() ->
                                Toast.makeText(activity, "Nenhuma atualização disponível.", Toast.LENGTH_SHORT).show());
                        return;
                    }
                    JSONObject release = new JSONObject(result.body().string());
                    String tag = release.optString("tag_name").replaceFirst("^[vV]", "");
                    if (compareVersions(tag, BuildConfig.VERSION_NAME.replaceFirst("-.*$", "")) <= 0) {
                        if (manual) activity.runOnUiThread(() ->
                                Toast.makeText(activity, "Você já está na versão mais recente.", Toast.LENGTH_SHORT).show());
                        return;
                    }

                    String apkUrl = null;
                    JSONArray assets = release.optJSONArray("assets");
                    if (assets != null) {
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            String name = asset.optString("name");
                            if (name.toLowerCase().endsWith(".apk")) {
                                apkUrl = asset.optString("browser_download_url");
                                if (name.toLowerCase().contains("oraclerpg")) break;
                            }
                        }
                    }
                    if (apkUrl == null || apkUrl.isEmpty()) return;
                    final String downloadUrl = apkUrl;
                    final String version = tag;
                    final String notes = release.optString("body");
                    activity.runOnUiThread(() -> prompt(version, notes, downloadUrl));
                } catch (Exception ignored) {}
            }
        });
    }

    private void prompt(String version, String notes, String url) {
        String message = "A versão " + version + " do OracleRPG está disponível.";
        if (notes != null && !notes.trim().isEmpty()) {
            String clean = notes.trim();
            if (clean.length() > 600) clean = clean.substring(0, 600) + "…";
            message += "\n\n" + clean;
        }
        new AlertDialog.Builder(activity)
                .setTitle("Nova versão disponível")
                .setMessage(message)
                .setNegativeButton("Depois", null)
                .setPositiveButton("Baixar e instalar", (dialog, which) -> download(url, version))
                .show();
    }

    private void download(String url, String version) {
        Toast.makeText(activity, "Baixando OracleRPG " + version + "…", Toast.LENGTH_SHORT).show();
        Request request = new Request.Builder()
                .url(url)
                .header("User-Agent", "OracleRPG-Android/" + BuildConfig.VERSION_NAME)
                .build();
        http.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, java.io.IOException error) {
                activity.runOnUiThread(() ->
                        Toast.makeText(activity, "Falha ao baixar a atualização.", Toast.LENGTH_LONG).show());
            }

            @Override
            public void onResponse(Call call, Response response) {
                try (Response result = response) {
                    if (!result.isSuccessful() || result.body() == null) throw new IllegalStateException();
                    File directory = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (directory == null) directory = activity.getCacheDir();
                    if (!directory.exists()) directory.mkdirs();
                    File apk = new File(directory, "OracleRPG-" + version + ".apk");
                    try (InputStream input = result.body().byteStream();
                         FileOutputStream output = new FileOutputStream(apk)) {
                        byte[] buffer = new byte[64 * 1024];
                        int read;
                        while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
                    }
                    activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                            .edit().putString(PENDING_APK, apk.getAbsolutePath()).apply();
                    activity.runOnUiThread(() -> requestInstall(apk));
                } catch (Exception error) {
                    activity.runOnUiThread(() ->
                            Toast.makeText(activity, "Falha ao preparar a atualização.", Toast.LENGTH_LONG).show());
                }
            }
        });
    }

    public void resumePendingInstall() {
        String path = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .getString(PENDING_APK, null);
        if (path == null) return;
        File apk = new File(path);
        if (!apk.exists()) {
            clearPending();
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.getPackageManager().canRequestPackageInstalls()) {
            requestInstall(apk);
        }
    }

    private void requestInstall(File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(settings);
            Toast.makeText(activity,
                    "Permita instalar atualizações do OracleRPG e volte ao app.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        Uri uri = FileProvider.getUriForFile(
                activity,
                activity.getPackageName() + ".files",
                apk
        );
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(install);
        clearPending();
    }

    private void clearPending() {
        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .edit().remove(PENDING_APK).apply();
    }

    static int compareVersions(String left, String right) {
        String[] a = left.split("\\.");
        String[] b = right.split("\\.");
        int max = Math.max(a.length, b.length);
        for (int i = 0; i < max; i++) {
            int av = parseSegment(i < a.length ? a[i] : "0");
            int bv = parseSegment(i < b.length ? b[i] : "0");
            if (av != bv) return Integer.compare(av, bv);
        }
        return 0;
    }

    private static int parseSegment(String segment) {
        String digits = segment.replaceAll("[^0-9].*$", "");
        try {
            return digits.isEmpty() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
