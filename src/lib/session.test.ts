import { describe, expect, it } from "vitest";
import { copyrightYear } from "@/lib/brand";
import { emptyExtracted, formatSavedAgo, isSessionEmpty, newerRecord, normalizeSession, type WorkspaceSession } from "@/lib/session";

describe("session helpers", () => {
  it("treats blank source and no results as empty", () => {
    expect(isSessionEmpty({ source: "  ", extracted: emptyExtracted() })).toBe(true);
    expect(isSessionEmpty({ source: "a@x.com", extracted: emptyExtracted() })).toBe(false);
    expect(isSessionEmpty({ source: "", extracted: { ...emptyExtracted(), emails: true } })).toBe(false);
  });

  it("fills missing result lists so an older save can still open", () => {
    const session = normalizeSession({
      version: 1,
      updatedAt: 10,
      mode: "urls",
      source: "https://shop.example",
      fileNames: ["stores.txt"],
      unique: true,
      personalFilter: "all",
      chunkSize: 20,
      extracted: { ...emptyExtracted(), urls: true },
    } as WorkspaceSession);
    expect(session.urls).toEqual([]);
    expect(session.segments).toEqual([]);
    expect(session.personal).toEqual([]);
    expect(session.urlDelivery).toBe("all");
  });

  it("keeps the newer of two saved copies", () => {
    const older = { updatedAt: 1 };
    const newer = { updatedAt: 5 };
    expect(newerRecord(older, newer)?.updatedAt).toBe(5);
    expect(newerRecord(newer, null)?.updatedAt).toBe(5);
  });

  it("formats a relative saved time", () => {
    const now = 1_700_000_000_000;
    expect(formatSavedAgo(now, now)).toBe("just now");
    expect(formatSavedAgo(now - 45_000, now)).toBe("45s ago");
    expect(formatSavedAgo(now - 10 * 60_000, now)).toBe("10 min ago");
  });
});

describe("copyrightYear", () => {
  it("follows the current calendar year", () => {
    expect(copyrightYear(new Date(2027, 2, 1))).toBe(2027);
    expect(copyrightYear(new Date(2026, 11, 31))).toBe(2026);
  });
});
