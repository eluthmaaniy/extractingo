export const DEFAULT_POLICY_PATH = "/policies/privacy-policy";
export const ALT_POLICY_PATH = "/pages/privacy-policy";

export type PolicyTarget = {
  input: string;
  url: string | null;
  host: string | null;
  pathAdded: boolean;
  reason: "ok" | "empty" | "invalid";
};

export function normalizePolicyPath(path: string): string {
  let value = path.trim();
  if (!value) return DEFAULT_POLICY_PATH;
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1) value = value.replace(/\/+$/, "");
  return value || DEFAULT_POLICY_PATH;
}

function pathnameKey(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function parsePolicyLine(raw: string, policyPath = DEFAULT_POLICY_PATH): PolicyTarget {
  const input = raw.trim();
  if (!input) return { input: raw, url: null, host: null, pathAdded: false, reason: "empty" };

  const suffix = normalizePolicyPath(policyPath);
  let candidate = input;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { input, url: null, host: null, pathAdded: false, reason: "invalid" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { input, url: null, host: null, pathAdded: false, reason: "invalid" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || (!host.includes(".") && host !== "localhost")) {
    return { input, url: null, host: null, pathAdded: false, reason: "invalid" };
  }

  const bare = pathnameKey(parsed.pathname) === "/";
  if (bare) parsed.pathname = suffix;
  parsed.hostname = host;

  return { input, url: parsed.href, host, pathAdded: bare, reason: "ok" };
}

export function listPolicyTargets(text: string, policyPath = DEFAULT_POLICY_PATH): PolicyTarget[] {
  return text
    .split(/\r?\n/)
    .map((line) => parsePolicyLine(line, policyPath))
    .filter((target) => target.reason !== "empty");
}

/** On a 404, try the other common Shopify policy path. Custom paths are left alone. */
export function alternatePolicyUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = pathnameKey(parsed.pathname);
  if (path === DEFAULT_POLICY_PATH) parsed.pathname = ALT_POLICY_PATH;
  else if (path === ALT_POLICY_PATH) parsed.pathname = DEFAULT_POLICY_PATH;
  else return null;
  return parsed.href;
}
