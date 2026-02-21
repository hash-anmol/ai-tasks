import "server-only";

import { randomUUID } from "node:crypto";

import {
  buildGatewayWsUrl,
  type ChatHistoryResult,
  type GatewayConnectParams,
  type SessionsListResult,
  OPENCLAW_ORIGIN,
} from "@/lib/openclaw";

type GatewayFrame =
  | {
      type: "event";
      event: string;
      payload?: unknown;
    }
  | {
      type: "res";
      id: string;
      ok: boolean;
      payload?: unknown;
      error?: { message?: string };
    };

type Pending = {
  resolve: (value: GatewayFrame) => void;
  reject: (err: Error) => void;
};

type GatewayRequestOptions = {
  token?: string;
  password?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function buildConnectParams(opts: GatewayRequestOptions): GatewayConnectParams {
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "webchat-ui",
      version: "ai-tasks",
      platform: "server",
      mode: "backend",
    },
    caps: [],
    role: "operator",
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
    auth:
      opts.token || opts.password
        ? {
            token: opts.token ?? undefined,
            password: opts.password ?? undefined,
          }
        : undefined,
  };
}

async function requestGatewayRaw<T>(
  baseUrl: string,
  method: string,
  params: Record<string, unknown> | undefined,
  opts: GatewayRequestOptions,
): Promise<T> {
  const wsUrl = buildGatewayWsUrl(baseUrl);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  console.log("[GatewayWS] Creating WebSocket to:", wsUrl);
  console.log("[GatewayWS] Auth opts:", { hasToken: !!opts.token, hasPassword: !!opts.password });
  console.log("[GatewayWS] Origin header:", OPENCLAW_ORIGIN || "none (using default)");

  return new Promise<T>((resolve, reject) => {
    // Explicitly set Origin header to avoid "origin not allowed" errors
    // @ts-expect-error - Node.js WebSocket supports headers option
    const ws = new WebSocket(wsUrl, { 
      headers: OPENCLAW_ORIGIN ? { Origin: OPENCLAW_ORIGIN } : {} 
    });
    const pending = new Map<string, Pending>();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close();
      }
      pending.clear();
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const sendRequest = (frameId: string, payload: Record<string, unknown>) => {
      pending.set(frameId, {
        resolve: (frame) => {
          pending.delete(frameId);
          if (frame.type !== "res") return;
          if (!frame.ok) {
            fail(new Error(frame.error?.message || "gateway request failed"));
            return;
          }
          resolve(frame.payload as T);
        },
        reject: (err) => {
          pending.delete(frameId);
          fail(err);
        },
      });
      ws.send(JSON.stringify(payload));
    };

    const startTimer = () => {
      timer = setTimeout(() => {
        fail(new Error("gateway request timed out"));
      }, timeoutMs);
    };

    ws.onopen = () => {
      console.log("[GatewayWS] WebSocket opened!");
      startTimer();
      const connectId = randomUUID();
      const connectParams = buildConnectParams(opts);
      pending.set(connectId, {
        resolve: (frame) => {
          pending.delete(connectId);
          if (frame.type !== "res") return;
          if (!frame.ok) {
            fail(new Error(frame.error?.message || "gateway connect failed"));
            return;
          }
          const requestId = randomUUID();
          sendRequest(requestId, {
            type: "req",
            id: requestId,
            method,
            params,
          });
        },
        reject: (err) => {
          pending.delete(connectId);
          fail(err);
        },
      });
      ws.send(
        JSON.stringify({
          type: "req",
          id: connectId,
          method: "connect",
          params: connectParams,
        }),
      );
    };

    ws.onmessage = (event) => {
      if (settled) return;
      let parsed: GatewayFrame | null = null;
      try {
        parsed = JSON.parse(String(event.data ?? "")) as GatewayFrame;
      } catch {
        return;
      }
      if (!parsed || parsed.type !== "res") return;
      const handler = pending.get(parsed.id);
      if (!handler) return;
      handler.resolve(parsed);
    };

    ws.onerror = (event) => {
      console.log("[GatewayWS] WebSocket error event:", event);
      fail(new Error("gateway websocket error"));
    };

    ws.onclose = (event) => {
      console.log("[GatewayWS] WebSocket closed, code:", event.code, "reason:", event.reason);
      if (!settled) {
        fail(new Error("gateway websocket closed"));
      }
    };
  });
}

export async function requestGatewaySessions(
  baseUrl: string,
  params: Record<string, unknown> | undefined,
  opts: GatewayRequestOptions,
): Promise<SessionsListResult> {
  return requestGatewayRaw<SessionsListResult>(baseUrl, "sessions.list", params, opts);
}

export async function requestGatewayChatHistory(
  baseUrl: string,
  params: Record<string, unknown> | undefined,
  opts: GatewayRequestOptions,
): Promise<ChatHistoryResult> {
  return requestGatewayRaw<ChatHistoryResult>(baseUrl, "chat.history", params, opts);
}
