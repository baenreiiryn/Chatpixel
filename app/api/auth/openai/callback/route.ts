import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { sha256 } from "@/lib/server/crypto";
import {
  OPENAI_ISSUER,
  OPENAI_TOKEN_ENDPOINT,
  openAIAuthConfig,
  verifyOpenAIIdToken,
} from "@/lib/server/openai-auth";
import { createSession, SESSION_COOKIE } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");
  const jar = await cookies();
  const cookieState = jar.get("oracle_oauth_state")?.value;
  const base = new URL("/", requestUrl);

  if (error || !code || !state || !cookieState || state !== cookieState) {
    base.searchParams.set("auth", error || "invalid_state");
    return NextResponse.redirect(base);
  }

  const config = openAIAuthConfig();
  if (!config.configured || !config.clientId) {
    base.searchParams.set("auth", "unavailable");
    return NextResponse.redirect(base);
  }

  const sql = db();
  const txRows = await sql`
    UPDATE openai_login_transactions
    SET consumed_at = now()
    WHERE state_hash = ${sha256(state)}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING id, nonce, code_verifier, redirect_uri
  `;
  const tx = txRows[0];
  if (!tx) {
    base.searchParams.set("auth", "expired");
    return NextResponse.redirect(base);
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    code_verifier: String(tx.code_verifier),
    redirect_uri: String(tx.redirect_uri),
  });
  if (config.clientSecret) form.set("client_secret", config.clientSecret);

  const tokenResponse = await fetch(OPENAI_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    base.searchParams.set("auth", "token_exchange_failed");
    return NextResponse.redirect(base);
  }

  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) {
    base.searchParams.set("auth", "missing_id_token");
    return NextResponse.redirect(base);
  }

  try {
    const claims = await verifyOpenAIIdToken(tokens.id_token, String(tx.nonce), config.clientId);
    const sub = String(claims.sub);
    const email = typeof claims.email === "string" ? claims.email : null;
    const name = typeof claims.name === "string" ? claims.name : null;
    const picture = typeof claims.picture === "string" ? claims.picture : null;

    const existing = await sql`
      SELECT id FROM app_accounts
      WHERE openai_issuer = ${OPENAI_ISSUER} AND openai_sub = ${sub}
      LIMIT 1
    `;
    const accountId = existing[0]?.id ? String(existing[0].id) : crypto.randomUUID();

    await sql`
      INSERT INTO app_accounts
        (id, openai_issuer, openai_sub, email, display_name, avatar_url)
      VALUES
        (${accountId}::uuid, ${OPENAI_ISSUER}, ${sub}, ${email}, ${name}, ${picture})
      ON CONFLICT (openai_issuer, openai_sub)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now()
    `;

    const session = await createSession(accountId);
    jar.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    jar.delete("oracle_oauth_state");
    base.searchParams.set("auth", "success");
    return NextResponse.redirect(base);
  } catch {
    base.searchParams.set("auth", "invalid_id_token");
    return NextResponse.redirect(base);
  }
}

