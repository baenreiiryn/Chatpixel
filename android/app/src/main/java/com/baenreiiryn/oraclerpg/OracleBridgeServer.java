package com.baenreiiryn.oraclerpg;

import android.content.Context;
import android.net.Uri;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class OracleBridgeServer {
    private static final int PORT = 31415;
    private static final Set<String> ALLOWED_ORIGINS = Set.of(
            BuildConfig.ORACLE_URL,
            "http://localhost:3000",
            "http://127.0.0.1:3000"
    );
    private static OracleBridgeServer instance;

    public static synchronized OracleBridgeServer get(Context context) {
        if (instance == null) instance = new OracleBridgeServer(context.getApplicationContext());
        return instance;
    }

    private final ChatGptClient chatGpt;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private volatile boolean running;
    private ServerSocket serverSocket;

    private OracleBridgeServer(Context context) {
        chatGpt = new ChatGptClient(context);
    }

    public synchronized void start() {
        if (running) return;
        running = true;
        pool.execute(() -> {
            try {
                serverSocket = new ServerSocket(PORT, 16, InetAddress.getByName("127.0.0.1"));
                while (running) {
                    Socket socket = serverSocket.accept();
                    pool.execute(() -> handle(socket));
                }
            } catch (Exception ignored) {
                running = false;
            }
        });
    }

    private void handle(Socket socket) {
        try (Socket client = socket) {
            client.setSoTimeout(120_000);
            InputStream input = client.getInputStream();
            String requestLine = readLine(input);
            if (requestLine == null || requestLine.isEmpty()) return;
            String[] requestParts = requestLine.split(" ", 3);
            if (requestParts.length < 2) return;
            String method = requestParts[0].toUpperCase(Locale.ROOT);
            String target = requestParts[1];

            Map<String, String> headers = new HashMap<>();
            while (true) {
                String line = readLine(input);
                if (line == null || line.isEmpty()) break;
                int colon = line.indexOf(':');
                if (colon > 0) {
                    headers.put(
                            line.substring(0, colon).trim().toLowerCase(Locale.ROOT),
                            line.substring(colon + 1).trim()
                    );
                }
            }

            int contentLength = 0;
            try {
                contentLength = Integer.parseInt(headers.getOrDefault("content-length", "0"));
            } catch (NumberFormatException ignored) {}
            if (contentLength > 2_000_000) {
                writeJson(client, 413, new JSONObject().put("error", "Request too large."), headers.get("origin"));
                return;
            }
            byte[] bodyBytes = readExact(input, contentLength);
            String bodyText = new String(bodyBytes, StandardCharsets.UTF_8);

            String origin = headers.get("origin");
            if ("OPTIONS".equals(method)) {
                writeEmpty(client, isOriginAllowed(origin) ? 204 : 403, origin);
                return;
            }

            Uri requestUri = Uri.parse("http://127.0.0.1:" + PORT + target);
            String path = requestUri.getPath();
            if ("/auth/callback".equals(path)) {
                try {
                    JSONObject registration = chatGpt.completeAuthorization(requestUri);
                    String label = registration.optString("email", registration.optString("name", "ChatGPT"));
                    writeHtml(client, 200,
                            "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">" +
                            "<style>body{font-family:system-ui;background:#09070e;color:#eee;padding:48px 24px;text-align:center}" +
                            "b{color:#c8a7ef}p{line-height:1.55}</style>" +
                            "<h1>OracleRPG conectado</h1><p><b>" + escape(label) + "</b> foi autorizado.</p>" +
                            "<p>Você pode fechar esta aba e voltar ao OracleRPG.</p>");
                } catch (Exception error) {
                    writeHtml(client, 400,
                            "<!doctype html><meta charset=\"utf-8\"><h1>Falha ao conectar</h1><pre>" +
                                    escape(error.getMessage()) + "</pre>");
                }
                return;
            }

            if (!isOriginAllowed(origin)) {
                writeJson(client, 403, new JSONObject().put("error", "Origin not allowed."), origin);
                return;
            }

            try {
                if ("GET".equals(method) && "/health".equals(path)) {
                    JSONObject health = new JSONObject();
                    health.put("ok", true);
                    health.put("app", "OracleRPG");
                    health.put("version", BuildConfig.VERSION_NAME);
                    health.put("account", chatGpt.accountStatus());
                    writeJson(client, 200, health, origin);
                    return;
                }
                if ("POST".equals(method) && "/auth/start".equals(path)) {
                    chatGpt.startAuthorization();
                    writeJson(client, 202, new JSONObject().put("ok", true), origin);
                    return;
                }
                if ("POST".equals(method) && "/auth/logout".equals(path)) {
                    chatGpt.logout();
                    writeJson(client, 200, new JSONObject().put("ok", true), origin);
                    return;
                }
                if ("GET".equals(method) && "/models".equals(path)) {
                    writeJson(client, 200, chatGpt.listModels(), origin);
                    return;
                }
                if ("POST".equals(method) && "/responses".equals(path)) {
                    JSONObject payload = new JSONObject(bodyText.isEmpty() ? "{}" : bodyText);
                    JSONObject result = new JSONObject();
                    result.put("response", chatGpt.runResponse(payload));
                    writeJson(client, 200, result, origin);
                    return;
                }
                writeJson(client, 404, new JSONObject().put("error", "Not found."), origin);
            } catch (Exception error) {
                JSONObject failure = new JSONObject();
                failure.put("error", error.getMessage() == null ? error.toString() : error.getMessage());
                writeJson(client, 500, failure, origin);
            }
        } catch (Exception ignored) {}
    }

    private boolean isOriginAllowed(String origin) {
        return origin == null || origin.isEmpty() || ALLOWED_ORIGINS.contains(origin);
    }

    private String readLine(InputStream input) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int previous = -1;
        while (true) {
            int current = input.read();
            if (current == -1) {
                if (buffer.size() == 0) return null;
                break;
            }
            if (previous == '\r' && current == '\n') {
                byte[] bytes = buffer.toByteArray();
                return new String(bytes, 0, Math.max(0, bytes.length - 1), StandardCharsets.US_ASCII);
            }
            buffer.write(current);
            previous = current;
            if (buffer.size() > 16_384) throw new IllegalStateException("Header line too large.");
        }
        return buffer.toString(StandardCharsets.US_ASCII.name());
    }

    private byte[] readExact(InputStream input, int length) throws Exception {
        byte[] bytes = new byte[length];
        int offset = 0;
        while (offset < length) {
            int read = input.read(bytes, offset, length - offset);
            if (read < 0) break;
            offset += read;
        }
        if (offset == length) return bytes;
        byte[] partial = new byte[offset];
        System.arraycopy(bytes, 0, partial, 0, offset);
        return partial;
    }

    private void writeJson(Socket socket, int status, JSONObject body, String origin) throws Exception {
        write(socket, status, "application/json; charset=utf-8",
                body.toString().getBytes(StandardCharsets.UTF_8), origin);
    }

    private void writeHtml(Socket socket, int status, String html) throws Exception {
        write(socket, status, "text/html; charset=utf-8",
                html.getBytes(StandardCharsets.UTF_8), null);
    }

    private void writeEmpty(Socket socket, int status, String origin) throws Exception {
        write(socket, status, "text/plain; charset=utf-8", new byte[0], origin);
    }

    private void write(Socket socket, int status, String type, byte[] body, String origin) throws Exception {
        String reason = status == 200 ? "OK" :
                status == 202 ? "Accepted" :
                status == 204 ? "No Content" :
                status == 400 ? "Bad Request" :
                status == 403 ? "Forbidden" :
                status == 404 ? "Not Found" :
                status == 413 ? "Payload Too Large" : "Internal Server Error";
        StringBuilder headers = new StringBuilder()
                .append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
                .append("Content-Type: ").append(type).append("\r\n")
                .append("Content-Length: ").append(body.length).append("\r\n")
                .append("Cache-Control: no-store\r\n")
                .append("Connection: close\r\n")
                .append("Access-Control-Allow-Methods: GET,POST,OPTIONS\r\n")
                .append("Access-Control-Allow-Headers: content-type\r\n")
                .append("Access-Control-Allow-Private-Network: true\r\n")
                .append("Access-Control-Max-Age: 600\r\n");
        if (origin != null && ALLOWED_ORIGINS.contains(origin)) {
            headers.append("Access-Control-Allow-Origin: ").append(origin).append("\r\n")
                    .append("Vary: Origin\r\n");
        }
        headers.append("\r\n");
        OutputStream output = socket.getOutputStream();
        output.write(headers.toString().getBytes(StandardCharsets.US_ASCII));
        output.write(body);
        output.flush();
    }

    private String escape(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
