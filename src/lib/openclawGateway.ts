export type GatewaySessionRow = {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
};

export type SessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults?: {
    model?: string;
    contextTokens?: number;
  };
  sessions: GatewaySessionRow[];
};

export type ChatHistoryResult = {
  sessionKey: string;
  sessionId?: string;
  messages: unknown[];
  thinkingLevel?: string | null;
};

export type GatewayConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps: string[];
  role: string;
  scopes?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
};

export function buildGatewayWsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  const url = new URL(trimmed);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

export function getAgentIdFromSessionKey(key: string): string | null {
  if (!key.startsWith("agent:")) return null;
  const parts = key.split(":");
  return parts.length >= 2 ? parts[1] : null;
}

export function filterSessionsByAgent(
  sessions: GatewaySessionRow[],
  agentId?: string,
): GatewaySessionRow[] {
  if (!agentId) return sessions;
  return sessions.filter((session) => getAgentIdFromSessionKey(session.key) === agentId);
}

export function getSessionDisplayName(session: GatewaySessionRow): string {
  if (session.displayName && session.displayName.trim()) return session.displayName.trim();
  if (session.label && session.label.trim()) return session.label.trim();
  return session.key;
}
