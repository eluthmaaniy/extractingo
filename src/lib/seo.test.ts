import { describe, expect, it } from "vitest";
import { FAQS, hashForMode, modeFromHash } from "@/lib/seo";

describe("modeFromHash", () => {
  it("maps aliases to tools", () => {
    expect(modeFromHash("#urls")).toBe("urls");
    expect(modeFromHash("#url")).toBe("urls");
    expect(modeFromHash("#clean")).toBe("clean");
    expect(modeFromHash("#duplicates")).toBe("clean");
    expect(modeFromHash("#split")).toBe("segment");
    expect(modeFromHash("#segmentation")).toBe("segment");
    expect(modeFromHash("#stores")).toBe("stores");
    expect(modeFromHash("#policy")).toBe("stores");
    expect(modeFromHash("")).toBe("emails");
  });

  it("round-trips hashes", () => {
    expect(hashForMode("emails")).toBe("emails");
    expect(hashForMode("segment")).toBe("split");
    expect(hashForMode("stores")).toBe("stores");
  });

  it("has FAQ copy for crawlers", () => {
    expect(FAQS.length).toBeGreaterThanOrEqual(8);
    expect(FAQS.some((item) => /upload/i.test(item.q))).toBe(true);
  });
});
