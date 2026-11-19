import { describe, expect, it } from "vitest";
import { emailsInText } from "@/lib/policyHtml";

describe("emailsInText", () => {
  it("keeps mailto addresses and visible text, then sorts unique results", () => {
    const text = "Write us at mailto:Owner@Shop.com?subject=Hi or privacy@shop.com. Also privacy@shop.com.";
    expect(emailsInText(text)).toEqual(["owner@shop.com", "privacy@shop.com"]);
  });
});
