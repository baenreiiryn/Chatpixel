import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST() {
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
