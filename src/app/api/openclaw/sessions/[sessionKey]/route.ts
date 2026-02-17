import { NextRequest, NextResponse } from "next/server";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";
import { requestGatewayChatHistory } from "@/lib/openclawGatewayServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> },
) {
  const { sessionKey } = await params;
  if (!sessionKey) {
    return NextResponse.json({ error: "Session key required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 200;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200;

  const urls = getOpenClawUrls();
  let lastError: Error | null = null;

  for (const url of urls) {
    const { baseUrl, token, password } = getOpenClawAuth(url);
    try {
      const result = await requestGatewayChatHistory(
        baseUrl,
        { sessionKey, limit: safeLimit },
        { 
          token, 
          password,
          timeoutMs: 30000
        },
      );
      return NextResponse.json(result);
    } catch (error) {
      console.error(`Chat history error from ${baseUrl}:`, error);
      lastError = error as Error;
    }
  }

  return NextResponse.json(
    { error: lastError?.message || "OpenClaw gateway unavailable" },
    { status: 502 },
  );
}
