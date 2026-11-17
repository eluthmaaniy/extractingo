import type { WorkspaceMode } from "@/components/ModeSwitcher";
import type { PersonalFilter } from "@/lib/extract";

export const SESSION_DB = "extractingo";
export const SESSION_STORE = "session";
export const SESSION_KEY = "current";
export const SESSION_LS_KEY = "extractingo-session";
export const SESSION_VERSION = 1;
const LS_MAX_CHARS = 3_500_000;

export type ExtractedFlags = Record<WorkspaceMode, boolean>;

export type EmailBucket = "personal" | "domain";

export type WorkspaceSession = {
  version: typeof SESSION_VERSION;
  updatedAt: number;
  mode: WorkspaceMode;
  source: string;
  fileNames: string[];
  unique: boolean;
  personalFilter: PersonalFilter;
  chunkSize: number;
  extracted: ExtractedFlags;
  personal: string[];
  domain: string[];
  urls: string[];
  cleaned: string[];
  dupStats: { total: number; removed: number };
  segments: string[][];
  bucket: EmailBucket;
};

export const EMPTY_EXTRACTED: ExtractedFlags = {
  emails: false,
  urls: false,
  clean: false,
  segment: false,
};

export function emptyExtracted(): ExtractedFlags {
  return { ...EMPTY_EXTRACTED };
}

export function isSessionEmpty(session: Pick<WorkspaceSession, "source" | "extracted">): boolean {
  const hasResults = Object.values(session.extracted).some(Boolean);
  return !session.source.trim() && !hasResults;
}

export function formatSavedAgo(updatedAt: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 20) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function isValidSession(value: unknown): value is WorkspaceSession {
  if (!value || typeof value !== "object") return false;
  const session = value as WorkspaceSession;
  return (
    session.version === SESSION_VERSION &&
    typeof session.source === "string" &&
    typeof session.updatedAt === "number" &&
    Array.isArray(session.fileNames) &&
    Boolean(session.extracted) &&
    typeof session.extracted === "object"
  );
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

function idbGet(): Promise<WorkspaceSession | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(SESSION_STORE, "readonly").objectStore(SESSION_STORE).get(SESSION_KEY);
        request.onsuccess = () => {
          const value = request.result;
          resolve(isValidSession(value) ? value : null);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbSet(session: WorkspaceSession): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(SESSION_STORE, "readwrite").objectStore(SESSION_STORE).put(session, SESSION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbClear(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(SESSION_STORE, "readwrite").objectStore(SESSION_STORE).delete(SESSION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

function readLocalFallback(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_LS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<WorkspaceSession | null> {
  try {
    const fromIdb = await idbGet();
    if (fromIdb) return fromIdb;
  } catch {
    /* fall through */
  }
  return readLocalFallback();
}

export async function saveSession(session: WorkspaceSession): Promise<"ok" | "empty" | "quota"> {
  if (isSessionEmpty(session)) {
    await clearSession();
    return "empty";
  }
  try {
    await idbSet(session);
    try {
      localStorage.removeItem(SESSION_LS_KEY);
    } catch {
      /* ignore */
    }
    return "ok";
  } catch {
    try {
      const json = JSON.stringify(session);
      if (json.length > LS_MAX_CHARS) return "quota";
      localStorage.setItem(SESSION_LS_KEY, json);
      return "ok";
    } catch {
      return "quota";
    }
  }
}

export async function clearSession(): Promise<void> {
  try {
    await idbClear();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(SESSION_LS_KEY);
  } catch {
    /* ignore */
  }
}
