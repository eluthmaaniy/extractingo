import { describe, expect, it } from "vitest";
import { copyrightYear } from "@/lib/brand";
import { emptyExtracted, formatSavedAgo, isSessionEmpty } from "@/lib/session";

describe("session helpers", () => {
  it("treats blank source and no results as empty", () => {
    expect(isSessionEmpty({ source: "  ", extracted: emptyExtracted() })).toBe(true);
    expect(isSessionEmpty({ source: "a@x.com", extracted: emptyExtracted() })).toBe(false);
    expect(isSessionEmpty({ source: "", extracted: { ...emptyExtracted(), emails: true } })).toBe(false);
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
