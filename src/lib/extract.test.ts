import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHUNK_SIZE,
  chunkList,
  cleanUrl,
  emailDomain,
  extractEmailsChunked,
  extractUrlsChunked,
  filterPersonal,
  isPersonalEmail,
  parseChunkSize,
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

  it("keeps a bare domain and drops numbers, words, and file names", async () => {
    const urls = await extractUrlsChunked(
      "12 3400 notes.txt 99.5 hello world example.com not a link",
    );
    expect(urls).toEqual(["https://example.com"]);
  });

  it("keeps the real link and does not invent a privacy-policy path", async () => {
    const urls = await extractUrlsChunked(
      [
        "1, https://Shop.example/policies/privacy-policy",
        "2 https://shop.example/pages/privacy-policy",
        "see https://www.Example.com/pricing",
        "bare shop.example",
      ].join("\n"),
    );
    expect(urls).toEqual(["https://shop.example", "https://www.example.com/pricing"]);
  });

  it("cleanUrl rejects junk", () => {
    expect(cleanUrl("https://ok.com/path")).toBe("https://ok.com/path");
    expect(cleanUrl("ftp://ok.com")).toBeNull();
    expect(cleanUrl("https://localhost/app")).toBe("https://localhost/app");
    expect(cleanUrl("https://shop.example")).toBe("https://shop.example");
    expect(cleanUrl("notes.txt")).toBeNull();
  });

  it("chunks with a default-safe size", () => {
    expect(chunkList(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });

  it("defaults empty or invalid chunk sizes to 5000", () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(5000);
    expect(parseChunkSize("")).toBe(5000);
    expect(parseChunkSize("   ")).toBe(5000);
    expect(parseChunkSize(0)).toBe(5000);
    expect(parseChunkSize(-3)).toBe(5000);
    expect(parseChunkSize("12")).toBe(12);
    expect(parseChunkSize(12.9)).toBe(12);
  });
});
