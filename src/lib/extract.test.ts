import { describe, expect, it } from "vitest";
import {
  chunkList,
  emailDomain,
  extractEmailsChunked,
  extractUrlsChunked,
  filterPersonal,
  isPersonalEmail,
} from "./extract";

describe("extract", () => {
  it("finds unique emails case-insensitively", async () => {
    const emails = await extractEmailsChunked(
      "Write a@gmail.com and A@Gmail.com plus info@acme.io",
      true,
    );
    expect(emails).toEqual(["a@gmail.com", "info@acme.io"]);
  });

  it("keeps duplicates when unique is off", async () => {
    const emails = await extractEmailsChunked("a@gmail.com a@gmail.com", false);
    expect(emails).toEqual(["a@gmail.com", "a@gmail.com"]);
  });

  it("classifies personal domains without case", () => {
    expect(isPersonalEmail("x@GMAIL.com")).toBe(true);
    expect(isPersonalEmail("x@acme.io")).toBe(false);
    expect(emailDomain("x@Yahoo.COM")).toBe("yahoo.com");
  });

  it("filters Gmail only from personal list", () => {
    const personal = ["a@gmail.com", "b@yahoo.com", "c@outlook.com"];
    expect(filterPersonal(personal, "gmail")).toEqual(["a@gmail.com"]);
    expect(filterPersonal(personal, "all")).toEqual(personal);
  });

  it("extracts unique hostnames", async () => {
    const urls = await extractUrlsChunked(
      "See https://www.Example.com/a and http://example.com/b https://other.org",
    );
    expect(urls.sort()).toEqual(["example.com", "other.org"]);
  });

  it("chunks with a default-safe size", () => {
    expect(chunkList(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
});
