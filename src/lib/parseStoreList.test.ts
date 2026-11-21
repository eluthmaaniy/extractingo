import { describe, expect, it } from "vitest";
import { jobsFromStoreList, parseStoreListText } from "@/lib/parseStoreList";

describe("parseStoreListText", () => {
  it("keeps one shop per line from a TXT list", () => {
    const parsed = parseStoreListText("\uFEFFcolourpop.com\n\ndemo-shop.myshopify.com\nhttps://gymshark.com");
    expect(parsed.urls).toEqual(["colourpop.com", "demo-shop.myshopify.com", "https://gymshark.com"]);
    expect(parsed.listed).toBe(3);
    expect(parsed.shops).toBe(3);
    expect(parsed.skipped).toBe(0);
  });

  it("reads a Shopify stores_export CSV from the URL and myshopify columns", () => {
    const csv = [
      "Store name,URL,myshopify_domain,Status",
      "Glow Shop,https://glow.example,glow-shop.myshopify.com,active",
      "Acme,https://acme.test,acme-inc.myshopify.com,active",
      "No site,,,draft",
    ].join("\n");
    const parsed = parseStoreListText(csv);
    expect(parsed.urls).toEqual(["glow-shop.myshopify.com", "acme-inc.myshopify.com"]);
    expect(parsed.listed).toBe(4);
    expect(parsed.shops).toBe(2);
    expect(parsed.skipped).toBe(2);
  });

  it("uses the website cell when there is no myshopify column", () => {
    const csv = [
      "Store name,Website,Email,Notes",
      'Glow,https://glow.com,hi@glow.com,"Big, shiny"',
      '"Acme, Inc",acme.io/,sales@acme.io,',
    ].join("\n");
    expect(parseStoreListText(csv).urls).toEqual(["https://glow.com", "acme.io/"]);
  });

  it("handles quoted commas, BOM, and semicolon lists", () => {
    const csv = '\uFEFFname;url\n"A; B";"https://a-b.com/?x=1;y=2"\nC;c.shop';
    expect(parseStoreListText(csv).urls).toEqual(["https://a-b.com/?x=1;y=2", "c.shop"]);
  });

  it("reads a TSV with a website column", () => {
    const tsv = "name\twebsite\nGlow\thttps://glow.com\nSkip\t";
    expect(parseStoreListText(tsv).urls).toEqual(["https://glow.com"]);
  });

  it("dedupes the same shop on custom and myshopify hosts only when the host matches", () => {
    const parsed = parseStoreListText("https://shop.com/\nshop.com\nwww.shop.com");
    expect(parsed.shops).toBe(1);
  });
});

describe("jobsFromStoreList", () => {
  it("turns CSV shops into privacy-policy jobs", () => {
    const { jobs, listed, shops } = jobsFromStoreList(
      "name,url\nGlow,https://glow.com\nSkip me,",
    );
    expect(listed).toBe(3);
    expect(shops).toBe(1);
    expect(jobs[0]?.host).toBe("glow.com");
    expect(jobs[0]?.url).toBe("https://glow.com/policies/privacy-policy");
  });
});
