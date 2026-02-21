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

  const urls = getOpenClawUrls();

  for (const url of urls) {
    const { baseUrl, token, password } = getOpenClawAuth(url);
    try {
      const result = await requestGatewayChatHistory(
        baseUrl,
        { sessionKey, limit: 1 },
        { 
          token, 
          password,
          timeoutMs: 10000
        },
      );
      
      const messages = result.messages || [];
      const lastMessage = (messages as any[])[messages.length - 1];
      const lastRole = lastMessage?.message?.role || null;
      const lastContent = lastMessage?.message?.content || [];
      const lastText = Array.isArray(lastContent)
        ? lastContent
            .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
            .map((part: any) => part.text)
            .join("\n")
        : null;

      const isComplete = lastRole === "assistant" && !!lastText;

      return NextResponse.json({
        sessionKey,
        status: isComplete ? "completed" : "running",
        lastMessage: lastText?.slice(0, 500) || null,
        messageCount: messages.length,
        updatedAt: lastMessage?.timestamp || null,
      });
    } catch (error) {
      console.error(`Status check error from ${baseUrl}:`, error);
      continue;
    }
  }

  return NextResponse.json(
    { error: "OpenClaw gateway unavailable", status: "unknown" },
    { status: 502 },
  );
}
