import { describe, expect, it } from "vitest";
import { normalizePolicySession, type PolicySession } from "@/lib/policySession";

describe("normalizePolicySession", () => {
  it("keeps store, policy URL, and email only", () => {
    const session = {
      version: 1,
      updatedAt: 1,
      source: "example.com",
      policyPath: "/policies/privacy-policy",
      activeUrl: "https://example.com/policies/privacy-policy",
      hits: [
        {
          store: "example.com",
          policyUrl: "https://example.com/policies/privacy-policy",
          email: "Owner@example.com",
          html: "<html>secret@example.com</html>",
        },
      ],
    } as unknown as PolicySession;

    const hit = normalizePolicySession(session).hits[0];
    expect(hit).toEqual({
      store: "example.com",
      policyUrl: "https://example.com/policies/privacy-policy",
      email: "owner@example.com",
    });
  });
});
