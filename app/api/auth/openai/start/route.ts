import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { pkceChallenge, randomToken, sha256 } from "@/lib/server/crypto";
import { OPENAI_AUTHORIZATION_ENDPOINT, openAIAuthConfig } from "@/lib/server/openai-auth";

export const runtime = "nodejs";

export async function GET() {
  const config = openAIAuthConfig();
  if (!config.configured || !config.clientId || !config.redirectUri) {
    return NextResponse.redirect(new URL("/?auth=unavailable", process.env.OPENAI_REDIRECT_URI || "http://localhost:3000"));
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const sql = db();

  await sql`
    INSERT INTO openai_login_transactions
      (id, state_hash, nonce, code_verifier, redirect_uri, expires_at)
    VALUES
      (${id}::uuid, ${sha256(state)}, ${nonce}, ${verifier}, ${config.redirectUri}, ${expiresAt.toISOString()}::timestamptz)
  `;

  const url = new URL(OPENAI_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", pkceChallenge(verifier));

  const jar = await cookies();
  jar.set("oracle_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(url);
}
