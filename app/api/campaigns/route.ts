import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { randomToken, sha256 } from "@/lib/server/crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { state?: unknown };
  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Invalid campaign state." }, { status: 400 });
  }

  const sql = db();
  const id = crypto.randomUUID();
  const syncKey = randomToken();

  await sql`
    INSERT INTO campaigns (id, secret_hash, state)
    VALUES (${id}::uuid, ${sha256(syncKey)}, ${JSON.stringify(body.state)}::jsonb)
  `;

  return NextResponse.json({ id, syncKey, version: 1 });
}
