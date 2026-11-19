import { SESSION_DB, SESSION_STORE } from "@/lib/session";

export const POLICY_SESSION_KEY = "policy";
export const POLICY_LS_KEY = "extractingo-policy-session";
export const POLICY_SESSION_VERSION = 1;

export type PolicyHitRecord = { store: string; policyUrl: string; email: string };

export type PolicyMissRecord = {
  store: string;
  url: string;
  detail: string;
  status: "not-shopify" | "failed" | "blocked";
};

export type PolicyRunReport = {
  empty: number;
  notShopify: number;
  missed: number;
  finished: boolean;
  startedAt: number;
  endedAt: number;
};

export type PolicySession = {
  version: typeof POLICY_SESSION_VERSION;
  updatedAt: number;
  source: string;
  policyPath: string;
  activeUrl: string;
  hits: PolicyHitRecord[];
  summary: PolicyRunReport;
  misses: PolicyMissRecord[];
};

function sanitizeHit(value: unknown): PolicyHitRecord | null {
  if (!value || typeof value !== "object") return null;
  const hit = value as PolicyHitRecord & { html?: unknown };
  if (typeof hit.email !== "string" || !hit.email.includes("@")) return null;
  return {
    store: typeof hit.store === "string" ? hit.store : "",
    policyUrl: typeof hit.policyUrl === "string" ? hit.policyUrl : "",
    email: hit.email.toLowerCase(),
  };
}

function sanitizeMiss(value: unknown): PolicyMissRecord | null {
  if (!value || typeof value !== "object") return null;
  const miss = value as PolicyMissRecord;
  if (typeof miss.store !== "string" || typeof miss.url !== "string") return null;
  const detail = typeof miss.detail === "string" ? miss.detail : "";
  const status =
    miss.status === "not-shopify" || miss.status === "blocked" || miss.status === "failed"
      ? miss.status
      : /shopify store record|not a shopify/i.test(detail)
        ? "not-shopify"
        : "failed";
  return { store: miss.store, url: miss.url, detail, status };
}

export function isPolicySession(value: unknown): value is PolicySession {
  if (!value || typeof value !== "object") return false;
  const session = value as PolicySession;
  return (
    session.version === POLICY_SESSION_VERSION &&
    typeof session.source === "string" &&
    typeof session.policyPath === "string" &&
    typeof session.updatedAt === "number" &&
    typeof session.activeUrl === "string" &&
    Array.isArray(session.hits)
  );
}

export function normalizePolicySession(value: PolicySession): PolicySession {
  const raw = value as PolicySession & { summary?: Partial<PolicyRunReport>; misses?: unknown };
  const misses = Array.isArray(raw.misses) ? raw.misses.map(sanitizeMiss).filter((miss): miss is PolicyMissRecord => miss !== null) : [];
  return {
    ...value,
    activeUrl: value.activeUrl,
    hits: value.hits.map(sanitizeHit).filter((hit): hit is PolicyHitRecord => hit !== null),
    summary: {
      empty: typeof raw.summary?.empty === "number" ? raw.summary.empty : 0,
      notShopify: typeof raw.summary?.notShopify === "number" ? raw.summary.notShopify : misses.filter((miss) => miss.status === "not-shopify").length,
      missed: typeof raw.summary?.missed === "number" ? raw.summary.missed : misses.filter((miss) => miss.status !== "not-shopify").length,
      finished: raw.summary?.finished === true,
      startedAt: typeof raw.summary?.startedAt === "number" ? raw.summary.startedAt : 0,
      endedAt: typeof raw.summary?.endedAt === "number" ? raw.summary.endedAt : 0,
    },
    misses,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

function idbGet(): Promise<PolicySession | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(SESSION_STORE, "readonly").objectStore(SESSION_STORE).get(POLICY_SESSION_KEY);
        request.onsuccess = () => {
          const value = request.result;
          resolve(isPolicySession(value) ? normalizePolicySession(value) : null);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbSet(session: PolicySession): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db
          .transaction(SESSION_STORE, "readwrite")
          .objectStore(SESSION_STORE)
          .put(session, POLICY_SESSION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbClear(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(SESSION_STORE, "readwrite").objectStore(SESSION_STORE).delete(POLICY_SESSION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function loadPolicySession(): Promise<PolicySession | null> {
  try {
    const fromIdb = await idbGet();
    if (fromIdb) return fromIdb;
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(POLICY_LS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPolicySession(parsed) ? normalizePolicySession(parsed) : null;
  } catch {
    return null;
  }
}

export async function savePolicySession(session: PolicySession): Promise<"ok" | "empty" | "quota"> {
  if (!session.source.trim() && session.hits.length === 0) {
    await clearPolicySession();
    return "empty";
  }
  try {
    await idbSet(session);
    try {
      localStorage.removeItem(POLICY_LS_KEY);
    } catch {
      /* ignore */
    }
    return "ok";
  } catch {
    try {
      localStorage.setItem(POLICY_LS_KEY, JSON.stringify(session));
      return "ok";
    } catch {
      return "quota";
    }
  }
}

export async function clearPolicySession(): Promise<void> {
  try {
    await idbClear();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(POLICY_LS_KEY);
  } catch {
    /* ignore */
  }
}
