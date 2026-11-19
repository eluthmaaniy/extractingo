export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Full http(s) URLs only. Stops at whitespace and quotes so nearby words are never captured. */
export const URL_FIND_REGEX = /https?:\/\/[^\s<>"'`]+/gi;

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
export const MAX_CHUNK_SIZE = 1_000_000;
export const MAX_DISPLAY = 400;
export const LARGE_INPUT_THRESHOLD = 120_000;
export const TEXTAREA_PREVIEW_CAP = 80_000;
const DOWNLOAD_LINE_CHUNK = 8_000;
const CLASSIFY_BATCH = 8_000;
const SPLIT_YIELD_CHARS = 120_000;
const EXTRACT_CHUNK = 80_000;
const EMAIL_OVERLAP = 256;
const URL_OVERLAP = 2048;

export function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => {
    if (typeof MessageChannel !== "undefined") {
      const ch = new MessageChannel();
      ch.port2.onmessage = () => resolve();
      ch.port1.postMessage(null);
    } else {
      setTimeout(resolve, 0);
    }
  });
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

const TRAILING_URL_JUNK = /[),.;:!?\]\}>'"]+$/g;

/** Drop surrounding punctuation so a sentence never sticks to the URL. */
export function cleanUrl(raw: string): string | null {
  let s = raw.trim().replace(TRAILING_URL_JUNK, "");
  while (s.endsWith(")") && (s.split(")").length - 1) > (s.split("(").length - 1)) {
    s = s.slice(0, -1);
  }
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") && host !== "localhost") return null;
  if (host.startsWith(".") || host.endsWith(".")) return null;

  const auth = parsed.username
    ? `${encodeURIComponent(parsed.username)}${parsed.password ? `:${encodeURIComponent(parsed.password)}` : ""}@`
    : "";
  const port = parsed.port ? `:${parsed.port}` : "";
  const path = parsed.pathname === "/" && !parsed.search && !parsed.hash ? "" : parsed.pathname;
  return `${parsed.protocol}//${auth}${host}${port}${path}${parsed.search}${parsed.hash}`;
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
    const sliceEnd = Math.min(i + EXTRACT_CHUNK + EMAIL_OVERLAP, text.length);
    const slice = text.slice(i, sliceEnd);
    const re = new RegExp(EMAIL_REGEX.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(slice)) !== null) {
      const abs = i + match.index;
      if (abs >= i + EXTRACT_CHUNK && i + EXTRACT_CHUNK < text.length) continue;
      const email = match[0].toLowerCase();
      if (unique) {
        if (!seen.has(email)) {
          seen.add(email);
          results.push(email);
        }
      } else {
        results.push(email);
      }
    }
    onProgress?.(Math.min(99, Math.round(((i + EXTRACT_CHUNK) / len) * 100)));
    await yieldToMain();
  }
  onProgress?.(100);
  return results;
}

export async function extractUrlsChunked(
  text: string,
  unique = true,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const seen = new Set<string>();
  const results: string[] = [];
  const len = text.length || 1;

  for (let i = 0; i < text.length; i += EXTRACT_CHUNK) {
    const sliceEnd = Math.min(i + EXTRACT_CHUNK + URL_OVERLAP, text.length);
    const slice = text.slice(i, sliceEnd);
    const re = new RegExp(URL_FIND_REGEX.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(slice)) !== null) {
      const abs = i + match.index;
      if (abs >= i + EXTRACT_CHUNK && i + EXTRACT_CHUNK < text.length) continue;
      const url = cleanUrl(match[0]);
      if (!url) continue;
      if (unique) {
        if (!seen.has(url)) {
          seen.add(url);
          results.push(url);
        }
      } else {
        results.push(url);
      }
    }
    onProgress?.(Math.min(99, Math.round(((i + EXTRACT_CHUNK) / len) * 100)));
    await yieldToMain();
  }
  onProgress?.(100);
  return results;
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

export function parseChunkSize(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CHUNK_SIZE;
  return Math.min(Math.floor(n), MAX_CHUNK_SIZE);
}

export function chunkList<T>(items: T[], chunkSize: number): T[][] {
  const size = parseChunkSize(chunkSize);
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

export function toCsvLines(lines: string[], column = "value"): string[] {
  return [column, ...lines.map((line) => (/[",\n]/.test(line) ? `"${line.replace(/"/g, '""')}"` : line))];
}

export async function splitLinesTrimmedChunked(
  text: string,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const lines: string[] = [];
  const len = text.length || 1;
  let start = 0;
  let sinceYield = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      const line = text.slice(start, i).trim();
      if (line) lines.push(line);
      start = i + 1;
    }
    sinceYield++;
    if (sinceYield >= SPLIT_YIELD_CHARS) {
      sinceYield = 0;
      onProgress?.(Math.min(99, Math.round((i / len) * 100)));
      await yieldToMain();
    }
  }
  onProgress?.(100);
  return lines;
}

export async function deduplicateChunked(
  lines: string[],
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  if (lines.length === 0) {
    onProgress?.(100);
    return [];
  }
  const BATCH = 40_000;
  const seen = new Set<string>();
  const unique: string[] = [];
  for (let i = 0; i < lines.length; i += BATCH) {
    const batch = lines.slice(i, i + BATCH);
    for (const line of batch) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(line);
      }
    }
    onProgress?.(Math.min(100, Math.round(((i + BATCH) / lines.length) * 100)));
    await yieldToMain();
  }
  onProgress?.(100);
  return unique;
}
