import { describe, expect, it } from "vitest";
import {
  buildGatewayWsUrl,
  filterSessionsByAgent,
  getAgentIdFromSessionKey,
  getSessionDisplayName,
  type GatewaySessionRow,
} from "@/lib/openclawGateway";

describe("openclaw gateway helpers", () => {
  it("builds ws url from http", () => {
    expect(buildGatewayWsUrl("http://localhost:18789")).toBe(
      "ws://localhost:18789"
    );
  });

  it("builds wss url from https", () => {
    expect(buildGatewayWsUrl("https://homeserver.tailnet.ts.net")).toBe(
      "wss://homeserver.tailnet.ts.net"
    );
  });

  it("strips path when building ws url", () => {
    expect(buildGatewayWsUrl("https://example.com/gateway/v1")).toBe(
      "wss://example.com"
    );
  });

  it("extracts agent id from session key", () => {
    expect(getAgentIdFromSessionKey("agent:coordinator:openai:abc")).toBe(
      "coordinator"
    );
    expect(getAgentIdFromSessionKey("agent:writer:anthropic:123")).toBe(
      "writer"
    );
  });

  it("returns null for non-agent keys", () => {
    expect(getAgentIdFromSessionKey("main")).toBeNull();
    expect(getAgentIdFromSessionKey("")).toBeNull();
  });

  it("prefers displayName for session label", () => {
    const row: GatewaySessionRow = {
      key: "agent:researcher:openai:1",
      kind: "direct",
      displayName: "Research Session",
      label: "Fallback",
      updatedAt: Date.now(),
    };
    expect(getSessionDisplayName(row)).toBe("Research Session");
  });

  it("falls back to label then key for display", () => {
    const withLabel: GatewaySessionRow = {
      key: "agent:writer:openai:2",
      kind: "direct",
      label: "Writer Thread",
      updatedAt: null,
    };
    expect(getSessionDisplayName(withLabel)).toBe("Writer Thread");

    const withKey: GatewaySessionRow = {
      key: "agent:writer:openai:3",
      kind: "direct",
      updatedAt: null,
    };
    expect(getSessionDisplayName(withKey)).toBe("agent:writer:openai:3");
  });

  it("filters sessions by agent id", () => {
    const sessions: GatewaySessionRow[] = [
      { key: "agent:coordinator:openai:a", kind: "direct", updatedAt: 1 },
      { key: "agent:writer:openai:b", kind: "direct", updatedAt: 2 },
      { key: "agent:writer:openai:c", kind: "direct", updatedAt: 3 },
      { key: "main", kind: "direct", updatedAt: 4 },
    ];
    expect(filterSessionsByAgent(sessions, "writer").map((s) => s.key)).toEqual([
      "agent:writer:openai:b",
      "agent:writer:openai:c",
    ]);
  });

  it("includes non-agent sessions for main", () => {
    const sessions: GatewaySessionRow[] = [
      { key: "main", kind: "direct", updatedAt: 1 },
      { key: "agent:main:openai:abc", kind: "direct", updatedAt: 2 },
      { key: "agent:writer:openai:b", kind: "direct", updatedAt: 3 },
    ];
    expect(filterSessionsByAgent(sessions, "main").map((s) => s.key)).toEqual([
      "main",
      "agent:main:openai:abc",
    ]);
  });

  it("returns all sessions when no agent filter provided", () => {
    const sessions: GatewaySessionRow[] = [
      { key: "agent:coordinator:openai:a", kind: "direct", updatedAt: 1 },
      { key: "main", kind: "direct", updatedAt: 2 },
    ];
    expect(filterSessionsByAgent(sessions).length).toBe(2);
  });
});
