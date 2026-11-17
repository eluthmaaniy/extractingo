import { describe, expect, it } from "vitest";
import {
  chunkList,
  cleanUrl,
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

  it("extracts only the URL, never surrounding words", async () => {
    const urls = await extractUrlsChunked(
      "Please visit https://www.Example.com/pricing today and also http://other.org/docs. Thanks!",
    );
    expect(urls).toEqual(["https://www.example.com/pricing", "http://other.org/docs"]);
  });

  it("strips trailing punctuation from URLs", async () => {
    const urls = await extractUrlsChunked("Go to https://acme.io/a), then https://acme.io/b.");
    expect(urls).toEqual(["https://acme.io/a", "https://acme.io/b"]);
  });

  it("does not treat plain words as URLs", async () => {
    const urls = await extractUrlsChunked("contact sales at hello world example.com not a link");
    expect(urls).toEqual([]);
  });

  it("cleanUrl rejects junk", () => {
    expect(cleanUrl("https://ok.com/path")).toBe("https://ok.com/path");
    expect(cleanUrl("ftp://ok.com")).toBeNull();
    expect(cleanUrl("https://localhost/app")).toBe("https://localhost/app");
  });

  it("chunks with a default-safe size", () => {
    expect(chunkList(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
});
