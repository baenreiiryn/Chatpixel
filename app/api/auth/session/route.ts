import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/server/session";
import { openAIAuthConfig } from "@/lib/server/openai-auth";

export const runtime = "nodejs";

export async function GET() {
  const account = await getCurrentAccount();
  return NextResponse.json({
    configured: openAIAuthConfig().configured,
    authenticated: Boolean(account),
    account,
  });
}
