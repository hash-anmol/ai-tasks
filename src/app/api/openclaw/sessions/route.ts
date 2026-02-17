import { NextResponse } from "next/server";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";
import {
  requestGatewaySessions,
} from "@/lib/openclawGatewayServer";

export async function GET() {
  const urls = getOpenClawUrls();
  let lastError: Error | null = null;

  for (const url of urls) {
    const { baseUrl, token, password } = getOpenClawAuth(url);
    try {
      const result = await requestGatewaySessions(
        baseUrl,
        {
          includeGlobal: true,
          includeUnknown: true,
          limit: 200,
        },
        { 
          token, 
          password,
          timeoutMs: 30000 
        },
      );
      return NextResponse.json(result);
    } catch (error) {
      console.error(`Sessions error from ${baseUrl}:`, error);
      lastError = error as Error;
    }
  }

  return NextResponse.json(
    { error: lastError?.message || "OpenClaw gateway unavailable" },
    { status: 502 },
  );
}
