import { NextRequest, NextResponse } from "next/server";
import { getOpenClawUrls } from "@/lib/openclaw";
import { requestGatewayChatHistory } from "@/lib/openclawGatewayServer";

const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD;

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionKey: string } },
) {
  const sessionKey = params.sessionKey;
  if (!sessionKey) {
    return NextResponse.json({ error: "Session key required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 200;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200;

  const urls = getOpenClawUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const result = await requestGatewayChatHistory(
        baseUrl,
        { sessionKey, limit: safeLimit },
        { token: OPENCLAW_TOKEN, password: OPENCLAW_PASSWORD },
      );
      return NextResponse.json(result);
    } catch (error) {
      lastError = error as Error;
    }
  }

  return NextResponse.json(
    { error: lastError?.message || "OpenClaw gateway unavailable" },
    { status: 502 },
  );
}
