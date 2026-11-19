import { emailsInText } from "@/lib/policyHtml";

/** Storefront API version confirmed readable from a normal browser page. */
export const SHOPIFY_API_VERSION = "2026-10";
export const POLICY_FETCH_TIMEOUT_MS = 12_000;

const POLICY_QUERY = `{
  shop { privacyPolicy { url body } }
  page(handle: "privacy-policy") { body onlineStoreUrl }
}`;

export type ShopPolicyStatus = "ok" | "no-emails" | "no-policy" | "not-shopify" | "blocked" | "failed";

export type ShopPolicyRead = {
  store: string;
  policyUrl: string;
  emails: string[];
  status: ShopPolicyStatus;
  detail: string;
};

type FetchLike = typeof fetch;

type PolicyPayload = {
  data?: {
    shop?: { privacyPolicy?: { url?: string | null; body?: string | null } | null };
    page?: { body?: string | null; onlineStoreUrl?: string | null } | null;
  };
  errors?: { message?: string; extensions?: { code?: string } }[];
};

function emptyRead(store: string, status: ShopPolicyStatus, detail: string): ShopPolicyRead {
  return { store, policyUrl: "", emails: [], status, detail };
}

function shopHost(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const host = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) return null;
  return host;
}

function fromPolicy(store: string, origin: string, payload: PolicyPayload): ShopPolicyRead | "blocked" | "locked" | "again" {
  const blocked = payload.errors?.some((error) => /throttl/i.test(error.message ?? "") || error.extensions?.code === "THROTTLED");
  if (blocked) return "blocked";
  const locked = payload.errors?.some((error) => /locked/i.test(error.message ?? ""));
  if (locked && !payload.data?.shop) return "locked";
  if (!payload.data) return "again";

  const policy = payload.data.shop?.privacyPolicy;
  const page = payload.data.page;
  const text = [policy?.body, page?.body].filter((part): part is string => Boolean(part)).join("\n");
  if (!text) return emptyRead(store, "no-policy", "This store has no privacy policy published.");

  const policyUrl = policy?.url || page?.onlineStoreUrl || `${origin}/policies/privacy-policy`;
  const emails = emailsInText(text);
  if (emails.length === 0) {
    return { store, policyUrl, emails, status: "no-emails", detail: "The privacy policy has no email address." };
  }
  return {
    store,
    policyUrl,
    emails,
    status: "ok",
    detail: `${emails.length.toLocaleString()} email${emails.length === 1 ? "" : "s"}`,
  };
}

async function postPolicy(endpoint: string, fetchImpl: FetchLike): Promise<{ httpStatus: number; payload: PolicyPayload | null }> {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    credentials: "omit",
    redirect: "follow",
    signal: AbortSignal.timeout(POLICY_FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: POLICY_QUERY }),
  });
  if (response.status === 430) return { httpStatus: 430, payload: null };
  const text = await response.text();
  if (!response.ok) {
    try {
      return { httpStatus: response.status, payload: JSON.parse(text) as PolicyPayload };
    } catch {
      return { httpStatus: response.status, payload: null };
    }
  }
  if (text.length > 1_500_000) return { httpStatus: response.status, payload: JSON.parse(text.slice(0, 1_500_000)) as PolicyPayload };
  try {
    return { httpStatus: response.status, payload: JSON.parse(text) as PolicyPayload };
  } catch {
    return { httpStatus: response.status, payload: null };
  }
}

/**
 * One request to the store's public Storefront API. The privacy-policy page itself
 * is blocked by CORS. If that request misses, fall back to meta.json and the
 * myshopify host. Policy text is parsed here and not returned.
 */
export async function readStorePolicy(pageUrl: string, fetchImpl: FetchLike = fetch): Promise<ShopPolicyRead> {
  let origin: string;
  let store: string;
  try {
    const parsed = new URL(pageUrl);
    origin = parsed.origin;
    store = parsed.hostname.toLowerCase();
  } catch {
    return emptyRead("", "failed", "That is not a web address.");
  }

  const onShopifyHost = store.endsWith(".myshopify.com");
  const endpoint = `https://${store}/api/${SHOPIFY_API_VERSION}/graphql.json`;
  try {
    const first = await postPolicy(endpoint, fetchImpl);
    if (first.httpStatus === 430) return emptyRead(store, "blocked", "Shopify blocked this lookup. Wait and try again.");
    if (first.payload) {
      const read = fromPolicy(store, origin, first.payload);
      if (read === "blocked") return emptyRead(store, "blocked", "Shopify blocked this lookup. Wait and try again.");
      if (read === "locked") return emptyRead(store, "failed", "This store's online channel is locked.");
      if (read !== "again") return read;
    }
  } catch {
    if (onShopifyHost) return emptyRead(store, "failed", "Shopify did not return the privacy policy.");
  }

  if (onShopifyHost) return emptyRead(store, "failed", "Shopify did not return the privacy policy.");

  let shop: string | null = null;
  try {
    const response = await fetchImpl(`${origin}/meta.json`, {
      credentials: "omit",
      redirect: "follow",
      signal: AbortSignal.timeout(POLICY_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return emptyRead(store, "not-shopify", "This site did not return a Shopify store record.");
    const meta = (await response.json()) as { myshopify_domain?: unknown };
    shop = shopHost(meta.myshopify_domain);
  } catch {
    return emptyRead(store, "not-shopify", "This site did not return a Shopify store record.");
  }
  if (!shop) return emptyRead(store, "not-shopify", "This site is not a Shopify store.");
  if (shop === store) return emptyRead(store, "failed", "Shopify did not return the privacy policy.");

  try {
    const second = await postPolicy(`https://${shop}/api/${SHOPIFY_API_VERSION}/graphql.json`, fetchImpl);
    if (second.httpStatus === 430) return emptyRead(store, "blocked", "Shopify blocked this lookup. Wait and try again.");
    if (!second.payload) return emptyRead(store, "failed", "Shopify did not return the privacy policy.");
    const read = fromPolicy(store, origin, second.payload);
    if (read === "blocked") return emptyRead(store, "blocked", "Shopify blocked this lookup. Wait and try again.");
    if (read === "locked") return emptyRead(store, "failed", "This store's online channel is locked.");
    if (read === "again") return emptyRead(store, "failed", "Shopify did not return the privacy policy.");
    return read;
  } catch {
    return emptyRead(store, "failed", "Shopify did not return the privacy policy.");
  }
}
