import { describe, expect, it } from "vitest";
import { alternatePolicyUrl, listPolicyTargets, parsePolicyLine } from "@/lib/policyUrl";

describe("parsePolicyLine", () => {
  it("adds https and the privacy path to a bare store", () => {
    const target = parsePolicyLine("example.com");
    expect(target.reason).toBe("ok");
    expect(target.pathAdded).toBe(true);
    expect(target.url).toBe("https://example.com/policies/privacy-policy");
    expect(target.host).toBe("example.com");
  });

  it("accepts a protocol-relative homepage", () => {
    const target = parsePolicyLine("//example.com");
    expect(target.pathAdded).toBe(true);
    expect(target.url).toBe("https://example.com/policies/privacy-policy");
  });

  it("leaves a full policy URL as entered", () => {
    const target = parsePolicyLine("https://example.com/policies/privacy-policy");
    expect(target.pathAdded).toBe(false);
    expect(target.url).toBe("https://example.com/policies/privacy-policy");
  });

  it("leaves any other path as entered", () => {
    const target = parsePolicyLine("shop.example/pages/contact");
    expect(target.pathAdded).toBe(false);
    expect(target.url).toBe("https://shop.example/pages/contact");
  });

  it("uses a custom path only for bare homepages", () => {
    const bare = parsePolicyLine("https://example.com/", "/pages/privacy-policy");
    const full = parsePolicyLine("https://example.com/policies/privacy-policy", "/pages/privacy-policy");
    expect(bare.url).toBe("https://example.com/pages/privacy-policy");
    expect(bare.pathAdded).toBe(true);
    expect(full.pathAdded).toBe(false);
    expect(full.url).toBe("https://example.com/policies/privacy-policy");
  });

  it("rejects non-web addresses", () => {
    expect(parsePolicyLine("ftp://example.com").reason).toBe("invalid");
    expect(parsePolicyLine("not a url").reason).toBe("invalid");
    expect(parsePolicyLine("example").reason).toBe("invalid");
  });
});

describe("listPolicyTargets", () => {
  it("skips blank lines and keeps invalid ones visible", () => {
    const targets = listPolicyTargets("example.com\n\nftp://nope\nhttps://shop.test/policies/privacy-policy");
    expect(targets.map((item) => item.reason)).toEqual(["ok", "invalid", "ok"]);
    expect(targets[0]?.pathAdded).toBe(true);
    expect(targets[2]?.pathAdded).toBe(false);
  });
});

describe("alternatePolicyUrl", () => {
  it("swaps the two Shopify policy paths after a 404", () => {
    expect(alternatePolicyUrl("https://example.com/policies/privacy-policy")).toBe(
      "https://example.com/pages/privacy-policy",
    );
    expect(alternatePolicyUrl("https://example.com/pages/privacy-policy?ref=1")).toBe(
      "https://example.com/policies/privacy-policy?ref=1",
    );
  });

  it("does not invent an alternate for a custom path", () => {
    expect(alternatePolicyUrl("https://example.com/pages/contact")).toBeNull();
  });
});
