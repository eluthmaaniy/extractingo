import { describe, expect, it } from "vitest";
import { isTemporaryMiss, readStorePolicy } from "@/lib/shopifyPolicy";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("isTemporaryMiss", () => {
  it("retries timeouts and blocks, and keeps a locked store or a real answer", () => {
    expect(isTemporaryMiss({ store: "a.com", policyUrl: "", emails: [], status: "failed", detail: "Shopify did not return the privacy policy." })).toBe(true);
    expect(isTemporaryMiss({ store: "a.com", policyUrl: "", emails: [], status: "blocked", detail: "Shopify blocked this lookup. Wait and try again." })).toBe(true);
    expect(isTemporaryMiss({ store: "a.com", policyUrl: "", emails: [], status: "failed", detail: "This store's online channel is locked." })).toBe(false);
    expect(isTemporaryMiss({ store: "a.com", policyUrl: "", emails: [], status: "not-shopify", detail: "This site is not a Shopify store." })).toBe(false);
    expect(isTemporaryMiss({ store: "a.com", policyUrl: "u", emails: ["a@a.com"], status: "ok", detail: "1 email" })).toBe(false);
  });
});

describe("readStorePolicy", () => {
  it("reads emails from the Storefront privacy policy and drops the page text", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/meta.json")) throw new Error("meta.json is only for a failed direct read");
      expect(url).toBe("https://colourpop.com/api/2026-10/graphql.json");
      return jsonResponse({
        data: {
          shop: {
            privacyPolicy: {
              url: "https://colourpop.com/policies/privacy-policy",
              body: "<p>Write to <a href=\"mailto:Owner@Colourpop.com?subject=Hi\">us</a> or privacy@colourpop.com.</p>",
            },
          },
          page: null,
        },
      });
    }) as typeof fetch;

    const result = await readStorePolicy("https://colourpop.com/policies/privacy-policy", fetchImpl);
    expect(result).toEqual({
      store: "colourpop.com",
      policyUrl: "https://colourpop.com/policies/privacy-policy",
      emails: ["owner@colourpop.com", "privacy@colourpop.com"],
      status: "ok",
      detail: "2 emails",
    });
    expect(JSON.stringify(result)).not.toContain("Write to");
  });

  it("reports a missing policy", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/meta.json")) return jsonResponse({ myshopify_domain: "demo.myshopify.com" });
      return jsonResponse({ data: { shop: { privacyPolicy: null }, page: null } });
    }) as typeof fetch;
    const result = await readStorePolicy("https://demo.myshopify.com", fetchImpl);
    expect(result.status).toBe("no-policy");
  });

  it("reports a policy with no address", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/meta.json")) return jsonResponse({ myshopify_domain: "demo.myshopify.com" });
      return jsonResponse({ data: { shop: { privacyPolicy: { url: "https://demo.myshopify.com/policies/privacy-policy", body: "<p>Contact the form.</p>" } } } });
    }) as typeof fetch;
    const result = await readStorePolicy("https://demo.myshopify.com", fetchImpl);
    expect(result.status).toBe("no-emails");
    expect(result.emails).toEqual([]);
  });

  it("falls back to the myshopify host when the shop domain has no API", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/meta.json")) return jsonResponse({ myshopify_domain: "demo.myshopify.com" });
      if (url.includes("demo.myshopify.com")) {
        return jsonResponse({
          data: { shop: { privacyPolicy: { url: "https://shop.example/policies/privacy-policy", body: "hello privacy@shop.example" } } },
        });
      }
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    const result = await readStorePolicy("https://shop.example", fetchImpl);
    expect(result.status).toBe("ok");
    expect(result.emails).toEqual(["privacy@shop.example"]);
    expect(calls.some((url) => url.includes("demo.myshopify.com"))).toBe(true);
  });

  it("does not follow a store record that points off Shopify", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/meta.json")) return jsonResponse({ myshopify_domain: "evil.example" });
      return new Response("no", { status: 404 });
    }) as typeof fetch;
    const result = await readStorePolicy("https://shop.example", fetchImpl);
    expect(result.status).toBe("not-shopify");
  });

  it("reads a store that only has a myshopify.com address", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return jsonResponse({
        data: { shop: { privacyPolicy: { url: "https://demo-shop.myshopify.com/policies/privacy-policy", body: "Write privacy@demo-shop.com" } } },
      });
    }) as typeof fetch;
    const result = await readStorePolicy("https://demo-shop.myshopify.com/policies/privacy-policy", fetchImpl);
    expect(result.status).toBe("ok");
    expect(result.store).toBe("demo-shop.myshopify.com");
    expect(result.emails).toEqual(["privacy@demo-shop.com"]);
    expect(calls.some((url) => url.endsWith("/meta.json"))).toBe(false);
  });

  it("does not call a myshopify address a non-Shopify site when the policy request fails", async () => {
    const fetchImpl = (async () => new Response("no", { status: 404 })) as typeof fetch;
    const result = await readStorePolicy("https://demo-shop.myshopify.com", fetchImpl);
    expect(result.status).toBe("failed");
    expect(result.store).toBe("demo-shop.myshopify.com");
  });

  it("reports a Shopify block", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/meta.json")) return jsonResponse({ myshopify_domain: "demo.myshopify.com" });
      return jsonResponse({ errors: [{ message: "Throttled" }] }, 200);
    }) as typeof fetch;
    const result = await readStorePolicy("https://demo.myshopify.com", fetchImpl);
    expect(result.status).toBe("blocked");
  });
});
