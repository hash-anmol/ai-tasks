import { NextResponse } from "next/server";
import { getOpenClawUrls } from "@/lib/openclaw";
import {
  requestGatewaySessions,
} from "@/lib/openclawGatewayServer";

const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD || process.env.OPENCLAW_GATEWAY_PASSWORD;

export async function GET() {
  const urls = getOpenClawUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const result = await requestGatewaySessions(
        baseUrl,
        {
          includeGlobal: true,
          includeUnknown: true,
          limit: 200,
        },
        { 
          token: OPENCLAW_TOKEN, 
          password: OPENCLAW_PASSWORD,
          timeoutMs: 30000 
        },
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
