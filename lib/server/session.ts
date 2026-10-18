import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { randomToken, sha256 } from "@/lib/server/crypto";

export const SESSION_COOKIE = "oracle_session";

export type AppAccount = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function createSession(accountId: string) {
  const sql = db();
  const token = randomToken();
  const hash = sha256(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO app_sessions (id, account_id, secret_hash, expires_at)
    VALUES (${sessionId}::uuid, ${accountId}::uuid, ${hash}, ${expiresAt.toISOString()}::timestamptz)
  `;

  return { token, expiresAt };
}

export async function getCurrentAccount(): Promise<AppAccount | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sql = db();
  const rows = await sql`
    SELECT a.id, a.email, a.display_name, a.avatar_url
    FROM app_sessions s
    JOIN app_accounts a ON a.id = s.account_id
    WHERE s.secret_hash = ${sha256(token)}
      AND s.expires_at > now()
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
  };
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = db();
    await sql`DELETE FROM app_sessions WHERE secret_hash = ${sha256(token)}`;
  }
  jar.delete(SESSION_COOKIE);
}
