import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PORT = Number(process.env.ORACLE_BRIDGE_PORT || 31415);
const HOST = "127.0.0.1";
const APP_NAME = "OracleRPG";
const RESOURCE = "https://api.openai.com/v1";
const AUTHORIZATION_ENDPOINT = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_ENDPOINT = "https://auth.openai.com/api/accounts/oauth/token";
const OIDC_CONFIGURATION = "https://auth.openai.com/.well-known/openid-configuration";
const JWKS = createRemoteJWKSet(new URL("https://auth.openai.com/.well-known/jwks.json"));
const DATA_DIR = process.env.ORACLE_BRIDGE_HOME || path.join(os.homedir(), ".oraclerpg");
const DATA_FILE = path.join(DATA_DIR, "bridge.json");
const DEFAULT_ORIGINS = [
  "https://oraclerpg.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const ALLOWED_ORIGINS = new Set(
  (process.env.ORACLE_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

let authAttempt = null;
let refreshPromise = null;

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

async function readStore() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return { hostId: `urn:uuid:${crypto.randomUUID()}`, registration: null };
  }
}

async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
  try { await fs.chmod(temp, 0o600); } catch {}
  await fs.rename(temp, DATA_FILE);
  try { await fs.chmod(DATA_FILE, 0o600); } catch {}
}

async function ensureStore() {
  const store = await readStore();
  if (!store.hostId) {
    store.hostId = `urn:uuid:${crypto.randomUUID()}`;
  }
  await writeStore(store);
  return store;
}

function safeAccount(registration) {
  if (!registration) return null;
  return {
    email: registration.email || null,
    name: registration.name || null,
    clientId: registration.client_id || null,
    scopes: registration.scopes || [],
    connected: Boolean(registration.access_token && registration.refresh_token),
  };
}

function sendJson(res, status, body, origin) {
  const payload = JSON.stringify(body);
  cors(res, origin);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function cors(res, origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-private-network", "true");
  res.setHeader("access-control-max-age", "600");
}

function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || ALLOWED_ORIGINS.has(origin);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function openBrowser(url) {
  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
  } else if (process.platform === "darwin") {
    execFile("open", [url]);
  } else {
    execFile("xdg-open", [url]);
  }
}

function tokenExpiry(registration) {
  const saved = Date.parse(registration?.saved_at || "");
  const expires = Number(registration?.expires_in || 0) * 1000;
  return Number.isFinite(saved) ? saved + expires : 0;
}

async function exchangeRefreshToken(registration) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: registration.client_id,
    refresh_token: registration.refresh_token,
    resource: RESOURCE,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status}).`);
  }
  const refreshed = await response.json();
  const store = await ensureStore();
  store.registration = {
    ...registration,
    ...refreshed,
    scopes: String(refreshed.scope || registration.scopes?.join(" ") || "")
      .split(/\s+/)
      .filter(Boolean),
    saved_at: new Date().toISOString(),
  };
  await writeStore(store);
  return store.registration;
}

async function activeRegistration() {
  const store = await ensureStore();
  const registration = store.registration;
  if (!registration?.access_token || !registration?.refresh_token) {
    throw new Error("ChatGPT is not connected.");
  }
  if (Date.now() < tokenExpiry(registration) - 5 * 60 * 1000) {
    return registration;
  }
  if (!refreshPromise) {
    refreshPromise = exchangeRefreshToken(registration).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function startAuthorization() {
  const store = await ensureStore();
  const verifier = randomToken(48);
  const state = randomToken();
  const nonce = randomToken();
  const redirectUri = `http://${HOST}:${PORT}/auth/callback`;
  const existing = store.registration;
  const firstRegistration = !existing?.client_id;
  const clientId = firstRegistration ? "dynamic_agent_client" : existing.client_id;
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

  authAttempt = {
    state,
    nonce,
    verifier,
    redirectUri,
    clientId,
    expectedSubject: existing?.subject || null,
    startedAt: Date.now(),
  };

  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("ext_agent_host_id", store.hostId);
  if (firstRegistration) {
    url.searchParams.set("agent_name_hint", APP_NAME);
  } else {
    if (existing.id_token) url.searchParams.set("id_token_hint", existing.id_token);
    if (existing.email) url.searchParams.set("login_hint", existing.email);
  }
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
  url.searchParams.set("resource", RESOURCE);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  openBrowser(url.toString());
}

async function completeAuthorization(url) {
  const attempt = authAttempt;
  authAttempt = null;
  if (!attempt || Date.now() - attempt.startedAt > 10 * 60 * 1000) {
    throw new Error("Authorization attempt expired.");
  }
  if (url.searchParams.get("state") !== attempt.state) {
    throw new Error("Invalid OAuth state.");
  }
  const error = url.searchParams.get("error");
  if (error) throw new Error(error);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("Authorization code is missing.");

  const issuedClientId =
    url.searchParams.get("client_id") ||
    url.searchParams.get("issued_client_id") ||
    attempt.clientId;
  if (!issuedClientId || issuedClientId === "dynamic_agent_client") {
    throw new Error("OpenAI did not return an issued client_id.");
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: issuedClientId,
    code,
    code_verifier: attempt.verifier,
    redirect_uri: attempt.redirectUri,
    resource: RESOURCE,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`OAuth token exchange failed (${response.status}).`);
  }
  const tokens = await response.json();
  if (!tokens.id_token || !tokens.access_token || !tokens.refresh_token) {
    throw new Error("Incomplete OAuth token response.");
  }
  const verified = await jwtVerify(tokens.id_token, JWKS, {
    issuer: "https://auth.openai.com",
    audience: issuedClientId,
  });
  if (verified.payload.nonce !== attempt.nonce) throw new Error("Invalid OIDC nonce.");
  if (!verified.payload.sub) throw new Error("ID token has no subject.");
  if (attempt.expectedSubject && attempt.expectedSubject !== verified.payload.sub) {
    throw new Error("The authorized ChatGPT account does not match this saved registration.");
  }
  const scopes = String(tokens.scope || "").split(/\s+/).filter(Boolean);
  if (!scopes.includes("chatgpt.tokens.use.direct")) {
    throw new Error("ChatGPT plan usage permission was not granted.");
  }

  const store = await ensureStore();
  store.registration = {
    client_id: issuedClientId,
    subject: String(verified.payload.sub),
    email: typeof verified.payload.email === "string" ? verified.payload.email : null,
    name: typeof verified.payload.name === "string" ? verified.payload.name : null,
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || "Bearer",
    expires_in: tokens.expires_in || 3600,
    earliest_refresh_at: tokens.earliest_refresh_at || null,
    scopes,
    saved_at: new Date().toISOString(),
  };
  await writeStore(store);
  return store.registration;
}

async function listModels() {
  const registration = await activeRegistration();
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${registration.access_token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Model list failed (${response.status}).`);
  const data = await response.json();
  return (data.models || [])
    .filter((model) => model.visibility === "list")
    .map((model) => ({ slug: model.slug, displayName: model.display_name || model.slug }));
}

async function runResponse(payload) {
  const registration = await activeRegistration();
  const requestBody = {
    model: payload.model,
    instructions: payload.instructions,
    input: payload.input,
    tools: payload.tools,
    include: payload.include,
    tool_choice: payload.toolChoice,
    store: false,
    stream: true,
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${registration.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok || !response.body) {
    const message = await response.text();
    throw new Error(`Responses request failed (${response.status}): ${message.slice(0, 500)}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let completed = null;
  let failure = null;
  const completedItems = new Map();
  const completedText = [];
  const consumeEvent = (event) => {
    if (!event) return;
    if (event.type === "response.completed") completed = event.response;
    if (event.type === "response.output_item.done" && event.item) {
      completedItems.set(Number(event.output_index ?? completedItems.size), event.item);
    }
    if (event.type === "response.output_text.done" && typeof event.text === "string" && event.text) {
      completedText.push(event.text);
    }
    if (event.type === "response.failed") {
      failure = event.response?.error || { message: "Response failed." };
    }
    if (event.type === "response.incomplete") {
      failure = { message: "Response was incomplete." };
    }
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const raw of events) {
      const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const text = dataLine.slice(5).trim();
      if (!text || text === "[DONE]") continue;
      let event;
      try { event = JSON.parse(text); } catch { continue; }
      consumeEvent(event);
    }
  }
  if (buffer.trim()) {
    const dataLine = buffer.split("\n").find((line) => line.startsWith("data:"));
    if (dataLine) {
      const text = dataLine.slice(5).trim();
      if (text && text !== "[DONE]") {
        try { consumeEvent(JSON.parse(text)); } catch {}
      }
    }
  }
  if (failure) {
    const error = new Error(failure.message || failure.code || "Response failed.");
    error.code = failure.code;
    throw error;
  }
  if (!completed) throw new Error("Stream ended without response.completed.");
  if (completedItems.size) {
    const originalOutput = Array.isArray(completed.output) ? completed.output : [];
    completed.output = [...completedItems.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, item]) => {
        const original = originalOutput[index];
        if (original && original.type === "web_search_call" && Array.isArray(original.results)) {
          return { ...item, results: original.results };
        }
        return item;
      });
  } else if ((!Array.isArray(completed.output) || completed.output.length === 0) && completedText.length) {
    completed.output = [{
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: completedText.join("\n") }],
    }];
  }
  return completed;
}

async function logout() {
  const store = await ensureStore();
  const registration = store.registration;
  if (!registration) return;
  if (registration.refresh_token && registration.client_id) {
    try {
      const config = await fetch(OIDC_CONFIGURATION).then((response) => response.json());
      if (config.revocation_endpoint) {
        await fetch(config.revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: registration.refresh_token,
            token_type_hint: "refresh_token",
            client_id: registration.client_id,
          }),
        });
      }
    } catch {}
  }
  store.registration = {
    client_id: registration.client_id,
    subject: registration.subject,
    email: registration.email,
    name: registration.name,
    scopes: [],
  };
  await writeStore(store);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    cors(res, origin);
    res.writeHead(originAllowed(req) ? 204 : 403);
    res.end();
    return;
  }
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/auth/callback") {
    try {
      const registration = await completeAuthorization(url);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><title>OracleRPG conectado</title><style>body{font-family:system-ui;background:#09070e;color:#eee;padding:48px;text-align:center}b{color:#c8a7ef}</style><h1>OracleRPG conectado</h1><p><b>${registration.email || registration.name || "ChatGPT"}</b> foi autorizado.</p><p>Você pode fechar esta aba e voltar ao OracleRPG.</p>`);
    } catch (error) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><title>Falha</title><h1>Falha ao conectar</h1><pre>${String(error.message || error)}</pre>`);
    }
    return;
  }
  if (!originAllowed(req)) {
    sendJson(res, 403, { error: "Origin not allowed." }, origin);
    return;
  }
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const store = await ensureStore();
      sendJson(res, 200, {
        ok: true,
        app: APP_NAME,
        version: "0.2.0",
        account: safeAccount(store.registration),
      }, origin);
      return;
    }
    if (req.method === "POST" && url.pathname === "/auth/start") {
      await startAuthorization();
      sendJson(res, 202, { ok: true }, origin);
      return;
    }
    if (req.method === "POST" && url.pathname === "/auth/logout") {
      await logout();
      sendJson(res, 200, { ok: true }, origin);
      return;
    }
    if (req.method === "GET" && url.pathname === "/models") {
      sendJson(res, 200, { models: await listModels() }, origin);
      return;
    }
    if (req.method === "POST" && url.pathname === "/responses") {
      const payload = await readJson(req);
      if (!payload.model || !Array.isArray(payload.input)) {
        sendJson(res, 400, { error: "model and input are required." }, origin);
        return;
      }
      sendJson(res, 200, { response: await runResponse(payload) }, origin);
      return;
    }
    sendJson(res, 404, { error: "Not found." }, origin);
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error), code: error.code || null }, origin);
  }
});

server.listen(PORT, HOST, async () => {
  await ensureStore();
  console.log(`Oracle Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Allowed Oracle origins: ${[...ALLOWED_ORIGINS].join(", ")}`);
});
