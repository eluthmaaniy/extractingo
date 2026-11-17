export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const URL_REGEX =
  /https?:\/\/(www\.)?([a-zA-Z0-9.-]+)(\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?/g;

export const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "live.com",
  "msn.com",
  "rocketmail.com",
  "gmx.com",
  "fastmail.com",
]);

export type PersonalFilter = "all" | "gmail" | "yahoo" | "outlook";

export const DEFAULT_CHUNK_SIZE = 5000;
export const MAX_DISPLAY = 500;
export const LARGE_INPUT_THRESHOLD = 150_000;
export const TEXTAREA_PREVIEW_CAP = 100_000;
const DOWNLOAD_LINE_CHUNK = 8_000;
const CLASSIFY_BATCH = 8_000;
const SPLIT_YIELD_CHARS = 200_000;
const EXTRACT_CHUNK = 200_000;

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function emailDomain(email: string): string {
  return (email.split("@")[1] || "").toLowerCase();
}

export function isPersonalEmail(email: string): boolean {
  return PERSONAL_DOMAINS.has(emailDomain(email));
}

export function matchesPersonalFilter(email: string, filter: PersonalFilter): boolean {
  if (filter === "all") return true;
  const domain = emailDomain(email);
  if (filter === "gmail") return domain === "gmail.com";
  if (filter === "yahoo") return domain === "yahoo.com" || domain === "rocketmail.com";
  return domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com" || domain === "msn.com";
}

export async function extractEmailsChunked(
  text: string,
  unique: boolean,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const seen = new Set<string>();
  const results: string[] = [];
  const len = text.length || 1;

  for (let i = 0; i < text.length; i += EXTRACT_CHUNK) {
    const chunk = text.slice(i, Math.min(i + EXTRACT_CHUNK + 200, text.length));
    const matches = chunk.match(EMAIL_REGEX);
    if (matches) {
      for (const raw of matches) {
        const email = raw.toLowerCase();
        if (unique) {
          if (!seen.has(email)) {
            seen.add(email);
            results.push(email);
          }
        } else {
          results.push(email);
        }
      }
    }
    onProgress?.(Math.min(100, Math.round(((i + EXTRACT_CHUNK) / len) * 100)));
    await yieldToMain();
  }
  onProgress?.(100);
  return results;
}

export async function extractUrlsChunked(
  text: string,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const seen = new Set<string>();
  const len = text.length || 1;

  for (let i = 0; i < text.length; i += EXTRACT_CHUNK) {
    const chunk = text.slice(i, Math.min(i + EXTRACT_CHUNK + 500, text.length));
    const re = new RegExp(URL_REGEX.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(chunk)) !== null) {
      seen.add(match[2].toLowerCase());
    }
    onProgress?.(Math.min(100, Math.round(((i + EXTRACT_CHUNK) / len) * 100)));
    await yieldToMain();
  }
  onProgress?.(100);
  return Array.from(seen);
}

export async function splitEmailsPersonalDomainChunked(
  emails: string[],
): Promise<{ personal: string[]; domain: string[] }> {
  const personal: string[] = [];
  const domain: string[] = [];
  for (let i = 0; i < emails.length; i += CLASSIFY_BATCH) {
    const batch = emails.slice(i, i + CLASSIFY_BATCH);
    for (const email of batch) {
      if (isPersonalEmail(email)) personal.push(email);
      else domain.push(email);
    }
    await yieldToMain();
  }
  return { personal, domain };
}

export function filterPersonal(emails: string[], filter: PersonalFilter): string[] {
  if (filter === "all") return emails;
  return emails.filter((email) => matchesPersonalFilter(email, filter));
}

export function chunkList<T>(items: T[], chunkSize: number): T[][] {
  const size = Math.max(1, Math.floor(chunkSize) || DEFAULT_CHUNK_SIZE);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function displayText(items: string[]): string {
  if (items.length <= MAX_DISPLAY) return items.join("\n");
  return (
    items.slice(0, MAX_DISPLAY).join("\n") +
    `\n\n… and ${(items.length - MAX_DISPLAY).toLocaleString()} more (use Download for the full list)`
  );
}

export function linesUnsuitableForClipboard(lines: string[]): boolean {
  if (lines.length > 18_000) return true;
  let sampleLen = 0;
  const cap = Math.min(lines.length, 400);
  for (let i = 0; i < cap; i++) sampleLen += lines[i].length + 1;
  const avg = cap > 0 ? sampleLen / cap : 0;
  return avg * lines.length > 720_000;
}

export function downloadLinesAsFile(lines: string[], filename: string, mime = "text/plain") {
  const parts: BlobPart[] = [];
  for (let i = 0; i < lines.length; i += DOWNLOAD_LINE_CHUNK) {
    const chunk = lines.slice(i, i + DOWNLOAD_LINE_CHUNK);
    parts.push(chunk.join("\n"));
    if (i + DOWNLOAD_LINE_CHUNK < lines.length) parts.push("\n");
  }
  const blob = new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsvLines(lines: string[]): string[] {
  return ["email", ...lines.map((line) => (/[",\n]/.test(line) ? `"${line.replace(/"/g, '""')}"` : line))];
}

export async function splitLinesTrimmedChunked(text: string): Promise<string[]> {
  const lines: string[] = [];
  const len = text.length;
  let start = 0;
  let sinceYield = 0;
  for (let i = 0; i <= len; i++) {
    if (i === len || text[i] === "\n") {
      const line = text.slice(start, i).trim();
      if (line) lines.push(line);
      start = i + 1;
    }
    sinceYield++;
    if (sinceYield >= SPLIT_YIELD_CHARS) {
      sinceYield = 0;
      await yieldToMain();
    }
  }
  return lines;
}
