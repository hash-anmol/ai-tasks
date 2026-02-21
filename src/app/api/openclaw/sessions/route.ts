import { NextResponse } from "next/server";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";
import {
  requestGatewaySessions,
} from "@/lib/openclawGatewayServer";

export async function GET() {
  const urls = getOpenClawUrls();
  let lastError: Error | null = null;

  console.log("[SESSIONS] getOpenClawUrls():", urls);
  
  for (const url of urls) {
    const { baseUrl, token, password } = getOpenClawAuth(url);
    console.log("[SESSIONS] Trying URL:", baseUrl);
    console.log("[SESSIONS] Auth - token:", token ? "***" : "none", "password:", password ? "***" : "none");
    
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
      console.log("[SESSIONS] Success!");
      return NextResponse.json(result);
    } catch (error) {
      console.error(`Sessions error from ${baseUrl}:`, error);
      console.error("[SESSIONS] Error details:", {
        message: (error as Error)?.message,
        cause: (error as Error)?.cause,
        stack: (error as Error)?.stack,
      });
      lastError = error as Error;
    }
  }

  return NextResponse.json(
    { error: lastError?.message || "OpenClaw gateway unavailable" },
    { status: 502 },
  );
}
