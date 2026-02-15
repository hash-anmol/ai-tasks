import { describe, expect, it } from "vitest";
import { normalizeOpenClawUrls } from "@/lib/openclaw";

describe("normalizeOpenClawUrls", () => {
  it("returns default when empty", () => {
    expect(normalizeOpenClawUrls()).toEqual(["http://127.0.0.1:18789"]);
  });

  it("deduplicates and trims", () => {
    expect(normalizeOpenClawUrls([" https://x.io ", "https://x.io", ""]))
      .toEqual(["https://x.io"]);
  });

  it("keeps order", () => {
    expect(normalizeOpenClawUrls(["https://a", "https://b"]))
      .toEqual(["https://a", "https://b"]);
  });
});
