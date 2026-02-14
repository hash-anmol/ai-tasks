/**
 * OpenClaw Client
 * Connects AI Tasks app to OpenClaw gateway
 */

const OPENCLAW_URL = process.env.NEXT_PUBLIC_OPENCLAW_URL || "http://homeserver:18789";
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

/**
 * Create a new OpenClaw session and send a task
 */
export async function executeTaskWithOpenClaw(
  prompt: string,
  agent?: string
): Promise<OpenClawSession> {
  const response = await fetch(`${OPENCLAW_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
    },
    body: JSON.stringify({
      message: prompt,
      agent: agent,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenClaw error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get session status
 */
export async function getSessionStatus(sessionId: string): Promise<{
  status: string;
  messages: string[];
}> {
  const response = await fetch(
    `${OPENCLAW_URL}/api/sessions/${sessionId}`,
    {
      headers: {
        ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`OpenClaw error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Send a follow-up message to existing session
 */
export async function sendMessageToSession(
  sessionId: string,
  message: string
): Promise<OpenClawResponse> {
  const response = await fetch(
    `${OPENCLAW_URL}/api/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!response.ok) {
    throw new Error(`OpenClaw error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Test connection to OpenClaw
 */
export async function testOpenClawConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}
