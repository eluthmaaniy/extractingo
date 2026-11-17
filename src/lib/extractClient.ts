import {
  deduplicateChunked,
  extractEmailsChunked,
  extractUrlsChunked,
  splitEmailsPersonalDomainChunked,
  splitLinesTrimmedChunked,
} from "@/lib/extract";

export type EmailExtractResult = {
  kind: "emails";
  emails: string[];
  personal: string[];
  domain: string[];
};

export type UrlExtractResult = { kind: "urls"; urls: string[] };
export type DedupeResult = { kind: "dedupe"; total: number; unique: string[]; removed: number };
export type LinesResult = { kind: "lines"; lines: string[] };

type WorkerResult = EmailExtractResult | UrlExtractResult | DedupeResult | LinesResult;

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/extract.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("error", () => {
      workerFailed = true;
      worker = null;
    });
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function runOnWorker<T extends WorkerResult>(
  payload: object,
  onProgress?: (pct: number) => void,
): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("no-worker"));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.id !== id) return;
      if (event.data.type === "progress") {
        onProgress?.(event.data.pct);
        return;
      }
      w.removeEventListener("message", onMessage);
      if (event.data.type === "error") reject(new Error(event.data.message));
      else resolve(event.data.result as T);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, ...payload });
  });
}

export async function extractEmailsJob(
  text: string,
  unique: boolean,
  onProgress?: (pct: number) => void,
): Promise<EmailExtractResult> {
  try {
    return await runOnWorker<EmailExtractResult>({ kind: "emails", text, unique }, onProgress);
  } catch {
    const emails = await extractEmailsChunked(text, unique, (pct) => onProgress?.(Math.round(pct * 0.75)));
    const split = await splitEmailsPersonalDomainChunked(emails);
    onProgress?.(100);
    return { kind: "emails", emails, personal: split.personal, domain: split.domain };
  }
}

export async function extractUrlsJob(
  text: string,
  unique: boolean,
  onProgress?: (pct: number) => void,
): Promise<UrlExtractResult> {
  try {
    return await runOnWorker<UrlExtractResult>({ kind: "urls", text, unique }, onProgress);
  } catch {
    const urls = await extractUrlsChunked(text, unique, onProgress);
    return { kind: "urls", urls };
  }
}

export async function dedupeJob(text: string, onProgress?: (pct: number) => void): Promise<DedupeResult> {
  try {
    return await runOnWorker<DedupeResult>({ kind: "dedupe", text }, onProgress);
  } catch {
    const lines = await splitLinesTrimmedChunked(text, (pct) => onProgress?.(Math.round(pct * 0.45)));
    const unique = await deduplicateChunked(lines, (pct) => onProgress?.(45 + Math.round(pct * 0.55)));
    return { kind: "dedupe", total: lines.length, unique, removed: lines.length - unique.length };
  }
}

export async function linesJob(text: string, onProgress?: (pct: number) => void): Promise<LinesResult> {
  try {
    return await runOnWorker<LinesResult>({ kind: "lines", text }, onProgress);
  } catch {
    const lines = await splitLinesTrimmedChunked(text, onProgress);
    return { kind: "lines", lines };
  }
}
