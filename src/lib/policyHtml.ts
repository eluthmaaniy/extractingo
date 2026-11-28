export const VISIBLE_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export type PolicyHit = { store: string; policyUrl: string; email: string };

/** Same order as the bookmarklet: mailto first, then addresses in the text, unique and sorted. */
export function emailsInText(text: string): string[] {
  const emails = new Set<string>();
  const mailto = /mailto:([^\s"'<>]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = mailto.exec(text)) !== null) {
    let raw = match[1].split("?")[0] ?? "";
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* keep the raw address */
    }
    const email = raw.trim();
    if (email.includes("@")) emails.add(email.toLowerCase());
  }
  const found = text.match(new RegExp(VISIBLE_EMAIL_REGEX.source, "g")) ?? [];
  for (const email of found) emails.add(email.toLowerCase());
  return [...emails].sort();
}

export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function policyHitsToCsv(hits: PolicyHit[]): string[] {
  return ["store,policy_url,email", ...hits.map((hit) => [hit.store, hit.policyUrl, hit.email].map(csvCell).join(","))];
}

/** Host without www, same idea as Scoutier URL Scout `hostLabelFromUrl`. */
export function hostLabelFromUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.toLowerCase() ?? trimmed;
  }
}

/** Shopify checkout / Shop app hosts — Scoutier import prefers the storefront over these. */
export function isShopifyCheckoutHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return h === "checkout.shopify.com" || h === "shop.app" || h.endsWith(".shop.app");
}

function isStorefrontHref(raw: string): boolean {
  const host = hostLabelFromUrl(raw);
  return Boolean(host) && !isShopifyCheckoutHost(host);
}

/** Keep a storefront policy URL. Shopify sometimes returns checkout.shopify.com instead. */
export function storefrontPolicyUrl(origin: string, candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isStorefrontHref(value)) return value;
  }
  const root = origin.replace(/\/+$/, "");
  return `${root}/policies/privacy-policy`;
}

function scoutierSourceUrl(hit: PolicyHit): string {
  const policy = hit.policyUrl.trim();
  if (policy && isStorefrontHref(policy)) return policy;
  const storeHost = hostLabelFromUrl(hit.store);
  if (storeHost && !isShopifyCheckoutHost(storeHost)) return `https://${storeHost}/`;
  return policy || (storeHost ? `https://${storeHost}/` : "");
}

/** Scoutier URL Scout file: each email stays with its store so `{website}` and `{url}` fill in. */
export function policyHitsToScoutierCsv(hits: PolicyHit[]): string[] {
  return [
    "email,website,url",
    ...hits.map((hit) => {
      const website = hostLabelFromUrl(hit.store) || hostLabelFromUrl(hit.policyUrl);
      const url = scoutierSourceUrl(hit);
      return [hit.email, website, url].map(csvCell).join(",");
    }),
  ];
}
