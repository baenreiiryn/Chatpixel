import { createRemoteJWKSet, jwtVerify } from "jose";

export const OPENAI_ISSUER = "https://auth.openai.com";
export const OPENAI_AUTHORIZATION_ENDPOINT = "https://auth.openai.com/api/accounts/authorize";
export const OPENAI_TOKEN_ENDPOINT = "https://auth.openai.com/api/accounts/oauth/token";
export const OPENAI_JWKS_URI = "https://auth.openai.com/.well-known/jwks.json";

const jwks = createRemoteJWKSet(new URL(OPENAI_JWKS_URI));

export function openAIAuthConfig() {
  const clientId = process.env.OPENAI_CLIENT_ID?.trim();
  const redirectUri = process.env.OPENAI_REDIRECT_URI?.trim();
  return {
    configured: Boolean(clientId && redirectUri),
    clientId,
    clientSecret: process.env.OPENAI_CLIENT_SECRET?.trim(),
    redirectUri,
  };
}

export async function verifyOpenAIIdToken(idToken: string, nonce: string, clientId: string) {
  const result = await jwtVerify(idToken, jwks, {
    issuer: OPENAI_ISSUER,
    audience: clientId,
  });
  if (result.payload.nonce !== nonce) {
    throw new Error("Invalid OpenAI OIDC nonce.");
  }
  if (!result.payload.sub) {
    throw new Error("OpenAI ID token has no subject.");
  }
  return result.payload;
}
