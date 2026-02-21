/**
 * OpenClaw Client
 * Connects AI Tasks app to OpenClaw gateway
 */

const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD || process.env.OPENCLAW_GATEWAY_PASSWORD;

interface OpenClawSession {
  sessionId: string;
  status: string;
}

interface OpenClawResponse {
  sessionId: string;
  message?: string;
  error?: string;
}

/**
 * Extracts auth info from a URL if present (e.g. ?token=abc or ?password=123)
 */
export function getAuthFromUrl(urlStr: string) {
  let workingUrl = urlStr.trim();
  if (!workingUrl.startsWith("http://") && !workingUrl.startsWith("https://")) {
    workingUrl = "https://" + workingUrl;
  }

  try {
    const url = new URL(workingUrl);
    const token = url.searchParams.get("token");
    const password = url.searchParams.get("password");
    
    // Create clean base URL without query params or trailing slash
    url.search = "";
    let cleanUrl = url.toString().replace(/\/$/, "");
    
    return { 
      token: token || undefined, 
      password: password || undefined,
      cleanUrl
    };
  } catch {
    return { cleanUrl: urlStr.split("?")[0].replace(/\/$/, "") };
  }
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
    normalized.push("http://127.0.0.1:18789");
  }
  return normalized;
}

export function getOpenClawUrls() {
  const primary = process.env.OPENCLAW_URL || process.env.NEXT_PUBLIC_OPENCLAW_URL;
  const fallbacks = process.env.OPENCLAW_FALLBACK_URLS ? process.env.OPENCLAW_FALLBACK_URLS.split(",") : [];
  
  const all = [];
  if (primary) all.push(primary);
  all.push(...fallbacks);
  
  return normalizeOpenClawUrls(all);
}

/**
 * Helper to get the best auth for a specific URL
 */
export function getOpenClawAuth(baseUrl: string) {
  const urlAuth = getAuthFromUrl(baseUrl);
  const token = urlAuth.token || OPENCLAW_TOKEN;
  const password = urlAuth.password || OPENCLAW_PASSWORD;
  
  const finalToken = token?.trim();
  const finalPassword = password?.trim();
  
  // Prefer password over token — the gateway authenticates with OPENCLAW_PASSWORD,
  // not OPENCLAW_TOKEN. OPENCLAW_TOKEN is the hex gateway-registration token and
  // is NOT accepted by the /v1/chat/completions endpoint.
  const authCredential = finalPassword || finalToken;

  return {
    token: finalToken,
    password: finalPassword,
    baseUrl: urlAuth.cleanUrl,
    header: authCredential ? `Bearer ${authCredential}` : undefined
  };
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
  for (const url of urls) {
    const { baseUrl, header } = getOpenClawAuth(url);
    try {
      const response = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(header && { Authorization: header }),
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
  for (const url of urls) {
    const { baseUrl, header } = getOpenClawAuth(url);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
        headers: {
          ...(header && { Authorization: header }),
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
  for (const url of urls) {
    const { baseUrl, header } = getOpenClawAuth(url);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(header && { Authorization: header }),
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
  for (const url of urls) {
    const { baseUrl } = getOpenClawAuth(url);
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
