import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { state?: unknown };
  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Invalid campaign state." }, { status: 400 });
  }

  const sql = db();
  const id = crypto.randomUUID();
  const syncKey = randomToken();
  const account = await getCurrentAccount();

  await sql`
    INSERT INTO campaigns (id, secret_hash, state)
    VALUES (${id}::uuid, ${sha256(syncKey)}, ${JSON.stringify(body.state)}::jsonb)
  `;

  if (account) {
    await sql`
      INSERT INTO campaign_accounts (campaign_id, account_id, role)
      VALUES (${id}::uuid, ${account.id}::uuid, 'owner')
      ON CONFLICT DO NOTHING
    `;
  }

  return NextResponse.json({ id, syncKey, version: 1 });
}

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ campaigns: [] });
  }
  const sql = db();
  const rows = await sql`
    SELECT c.id, c.state, c.version, c.updated_at
    FROM campaign_accounts ca
    JOIN campaigns c ON c.id = ca.campaign_id
    WHERE ca.account_id = ${account.id}::uuid
    ORDER BY c.updated_at DESC
  `;
  return NextResponse.json({ campaigns: rows });
}
