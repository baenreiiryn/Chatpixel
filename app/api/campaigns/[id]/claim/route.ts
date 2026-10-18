import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sha256 } from "@/lib/server/crypto";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const value = request.headers.get("authorization") || "";
  const key = value.startsWith("Bearer ") ? value.slice(7).trim() : "";
  if (!key) return NextResponse.json({ error: "Sync key required." }, { status: 401 });

  try {
    const sql = db();
    const found = await sql`
      SELECT id FROM campaigns
      WHERE id = ${id}::uuid AND secret_hash = ${sha256(key)}
      LIMIT 1
    `;
    if (!found[0]) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    await sql`
      INSERT INTO campaign_accounts (campaign_id, account_id, role)
      VALUES (${id}::uuid, ${account.id}::uuid, 'owner')
      ON CONFLICT DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  }
}
