/**
 * OpenClaw Client
 * Connects AI Tasks app to OpenClaw gateway
 */

const DEFAULT_OPENCLAW_URL = "http://127.0.0.1:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;

interface OpenClawSession {
  sessionId: string;
  status: string;
}

interface OpenClawResponse {
  sessionId: string;
  message?: string;
  error?: string;
}

export function normalizeOpenClawUrls(input?: string | string[]) {
  const urls = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  if (normalized.length === 0) {
    normalized.push(DEFAULT_OPENCLAW_URL);
  }
  return normalized;
}

export function getOpenClawUrls() {
  return normalizeOpenClawUrls([
    process.env.OPENCLAW_URL || process.env.NEXT_PUBLIC_OPENCLAW_URL || "",
    ...(process.env.OPENCLAW_FALLBACK_URLS ? process.env.OPENCLAW_FALLBACK_URLS.split(",") : []),
  ]);
}

/**
 * Create a new OpenClaw session and send a task
 */
export async function executeTaskWithOpenClaw(
  prompt: string,
  agent?: string,
  metadata?: Record<string, unknown>
): Promise<OpenClawSession> {
  let lastError: Error | null = null;
  const urls = getOpenClawUrls();
  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
        },
        body: JSON.stringify({
          message: prompt,
          agent: agent,
          sessionTarget: "isolated",
          metadata,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `OpenClaw error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("OpenClaw not reachable");
}

/**
 * Get session status
 */
export async function getSessionStatus(sessionId: string): Promise<{
  status: string;
  messages: string[];
}> {
  let lastError: Error | null = null;
  const urls = getOpenClawUrls();
  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
        headers: {
          ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`OpenClaw error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("OpenClaw not reachable");
}

/**
 * Send a follow-up message to existing session
 */
export async function sendMessageToSession(
  sessionId: string,
  message: string
): Promise<OpenClawResponse> {
  let lastError: Error | null = null;
  const urls = getOpenClawUrls();
  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`OpenClaw error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("OpenClaw not reachable");
}

/**
 * Test connection to OpenClaw
 */
export async function testOpenClawConnection(): Promise<boolean> {
  const urls = getOpenClawUrls();
  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
      });
      if (response.ok) return true;
    } catch {
      continue;
    }
  }
  return false;
}
