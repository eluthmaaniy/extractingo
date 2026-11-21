import { listPolicyTargets, parsePolicyLine } from "@/lib/policyUrl";

const DELIMITERS = [",", ";", "\t"] as const;
const EMAIL_TOKEN = /^[^\s/:@]+@[^\s/@]+\.[a-z]{2,}$/i;
const WITH_SCHEME = /^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i;
const BARE_HOST =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]+)(?::\d+)?(?:[/?#]\S*)?$/i;

const URL_HEADERS = new Set([
  "url",
  "website",
  "domain",
  "store url",
  "storeurl",
  "link",
  "site",
  "homepage",
  "shop url",
  "shopurl",
]);
const MYSHOPIFY_HEADERS = new Set([
  "myshopify domain",
  "myshopify_domain",
  "myshopifydomain",
  "myshopify",
  "shopify domain",
  "shopify_domain",
]);

export type ParsedStoreList = {
  urls: string[];
  listed: number;
  shops: number;
  skipped: number;
};

function detectDelimiter(text: string): string | null {
  const first = text.split(/\r\n|\n|\r/).find((l) => l.trim()) ?? "";
  let best: string | null = null;
  let bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const ch of first) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count += 1;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = text.replace(/^\uFEFF/, "");
  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      if (body[i + 1] === "\n") i += 1;
      pushRow();
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function cleanToken(raw: string): string {
  return raw.trim().replace(/^[("'<[]+|[)"'>\],.;]+$/g, "");
}

function isUrlLike(token: string): boolean {
  if (!token || EMAIL_TOKEN.test(token)) return false;
  return WITH_SCHEME.test(token) || BARE_HOST.test(token);
}

function normalizeHeader(cell: string): string {
  return cell.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function hostKey(token: string): string {
  const parsed = parsePolicyLine(token);
  const host = parsed.host ?? token.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return host.replace(/^www\./, "");
}

function pickFromRow(cells: string[], urlCol: number, shopCol: number): string | null {
  const shop = shopCol >= 0 ? cleanToken(cells[shopCol] ?? "") : "";
  if (shop && /\.myshopify\.com$/i.test(shop.replace(/^https?:\/\//i, "").split("/")[0] ?? "")) {
    return shop;
  }
  const preferred = urlCol >= 0 ? cleanToken(cells[urlCol] ?? "") : "";
  if (preferred && isUrlLike(preferred)) return preferred;
  for (const cell of cells) {
    for (const part of cell.split(/\s+/)) {
      const token = cleanToken(part);
      if (isUrlLike(token)) return token;
    }
  }
  return null;
}

/** Store URLs from a pasted or uploaded list. CSV/TSV uses URL columns; TXT stays one shop per line. */
export function parseStoreListText(text: string): ParsedStoreList {
  const body = text.replace(/^\uFEFF/, "");
  const listed = body.split(/\r\n|\n|\r/).filter((line) => line.trim()).length;
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (token: string) => {
    const parsed = parsePolicyLine(token);
    if (parsed.reason !== "ok" || !parsed.url) return;
    const key = hostKey(token);
    if (seen.has(key)) return;
    seen.add(key);
    urls.push(token);
  };

  const delimiter = detectDelimiter(body);
  if (delimiter) {
    const rows = parseRows(body, delimiter);
    if (rows.length > 0) {
      const headers = rows[0].map(normalizeHeader);
      const urlCol = headers.findIndex((h) => URL_HEADERS.has(h));
      const shopCol = headers.findIndex((h) => MYSHOPIFY_HEADERS.has(h));
      const headerLooksLikeLabels = urlCol >= 0 || shopCol >= 0 || headers.some((h) => /name|email|notes|status/.test(h));
      const data = headerLooksLikeLabels ? rows.slice(1) : rows;
      for (const row of data) {
        const token = pickFromRow(row, urlCol, shopCol);
        if (token) add(token);
      }
      return { urls, listed, shops: urls.length, skipped: Math.max(0, listed - urls.length) };
    }
  }

  for (const line of body.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parsePolicyLine(trimmed);
    if (parsed.reason === "ok") {
      add(trimmed);
      continue;
    }
    for (const part of trimmed.split(/[\s,;|]+/)) {
      const token = cleanToken(part);
      if (isUrlLike(token)) add(token);
    }
  }

  return { urls, listed, shops: urls.length, skipped: Math.max(0, listed - urls.length) };
}

export function storeListAsLines(text: string): string {
  return parseStoreListText(text).urls.join("\n");
}

export function jobsFromStoreList(source: string): { jobs: { host: string; url: string }[]; invalid: number; listed: number; shops: number } {
  const parsed = parseStoreListText(source);
  const targets = listPolicyTargets(parsed.urls.join("\n"));
  const jobs: { host: string; url: string }[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const target of targets) {
    if (target.reason !== "ok" || !target.url || !target.host) {
      invalid += 1;
      continue;
    }
    if (seen.has(target.host)) continue;
    seen.add(target.host);
    jobs.push({ host: target.host, url: target.url });
  }
  return { jobs, invalid, listed: parsed.listed, shops: jobs.length };
}
