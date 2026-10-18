import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sha256 } from "@/lib/server/crypto";

export const runtime = "nodejs";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function authorizedCampaign(id: string, key: string) {
  if (!key) return null;
  const sql = db();
  const rows = await sql`
    SELECT id, state, version, updated_at
    FROM campaigns
    WHERE id = ${id}::uuid
      AND secret_hash = ${sha256(key)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const row = await authorizedCampaign(id, bearer(request));
    if (!row) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({
      id: String(row.id),
      state: row.state,
      version: Number(row.version),
      updatedAt: row.updated_at,
    });
  } catch {
    return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const key = bearer(request);
  const body = (await request.json()) as { state?: unknown; expectedVersion?: number };
  if (!body.state || typeof body.state !== "object" || !Number.isInteger(body.expectedVersion)) {
    return NextResponse.json({ error: "Invalid sync payload." }, { status: 400 });
  }

  try {
    const sql = db();
    const hash = sha256(key);
    const rows = await sql`
      UPDATE campaigns
      SET state = ${JSON.stringify(body.state)}::jsonb,
          version = version + 1,
          updated_at = now()
      WHERE id = ${id}::uuid
        AND secret_hash = ${hash}
        AND version = ${body.expectedVersion as number}
      RETURNING version, updated_at
    `;

    if (rows[0]) {
      return NextResponse.json({
        version: Number(rows[0].version),
        updatedAt: rows[0].updated_at,
      });
    }

    const current = await authorizedCampaign(id, key);
    if (!current) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json(
      { error: "Version conflict.", state: current.state, version: Number(current.version) },
      { status: 409 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  }
}
