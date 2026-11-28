import { describe, expect, it } from "vitest";
import { emailsInText, policyHitsToCsv, policyHitsToScoutierCsv } from "@/lib/policyHtml";

describe("emailsInText", () => {
  it("keeps mailto addresses and visible text, then sorts unique results", () => {
    const text = "Write us at mailto:Owner@Shop.com?subject=Hi or privacy@shop.com. Also privacy@shop.com.";
    expect(emailsInText(text)).toEqual(["owner@shop.com", "privacy@shop.com"]);
  });
});

describe("policyHitsToScoutierCsv", () => {
  it("writes one email,website,url row per hit and strips www from the host", () => {
    const hits = [
      {
        store: "www.shop.com",
        policyUrl: "https://www.shop.com/policies/privacy-policy",
        email: "hello@shop.com",
      },
      {
        store: "other.com",
        policyUrl: "https://other.com/policies/privacy-policy",
        email: "privacy@other.com",
      },
    ];
    expect(policyHitsToScoutierCsv(hits)).toEqual([
      "email,website,url",
      "hello@shop.com,shop.com,https://www.shop.com/policies/privacy-policy",
      "privacy@other.com,other.com,https://other.com/policies/privacy-policy",
    ]);
  });

  it("falls back to https://{store}/ when there is no policy URL", () => {
    expect(
      policyHitsToScoutierCsv([{ store: "shop.com", policyUrl: "", email: "hello@shop.com" }]),
    ).toEqual(["email,website,url", "hello@shop.com,shop.com,https://shop.com/"]);
  });

  it("quotes cells that contain commas or quotes", () => {
    expect(
      policyHitsToScoutierCsv([
        {
          store: "shop.com",
          policyUrl: 'https://shop.com/a,b"c',
          email: "hello@shop.com",
        },
      ]),
    ).toEqual(["email,website,url", 'hello@shop.com,shop.com,"https://shop.com/a,b""c"']);
  });

  it("does not change the existing store,policy_url,email CSV", () => {
    const hits = [{ store: "shop.com", policyUrl: "https://shop.com/p", email: "a@shop.com" }];
    expect(policyHitsToCsv(hits)).toEqual(["store,policy_url,email", "shop.com,https://shop.com/p,a@shop.com"]);
  });

  it("writes the store host when Shopify returned a checkout policy URL", () => {
    expect(
      policyHitsToScoutierCsv([
        {
          store: "colourpop.com",
          policyUrl: "https://checkout.shopify.com/c/123",
          email: "hello@colourpop.com",
        },
      ]),
    ).toEqual(["email,website,url", "hello@colourpop.com,colourpop.com,https://colourpop.com/"]);
  });

  it("writes the store host when Shopify returned a Shop app policy URL", () => {
    expect(
      policyHitsToScoutierCsv([
        {
          store: "glow.com",
          policyUrl: "https://glow.shop.app/policies/privacy-policy",
          email: "hi@glow.com",
        },
      ]),
    ).toEqual(["email,website,url", "hi@glow.com,glow.com,https://glow.com/"]);
  });
});
