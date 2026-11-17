import {
  deduplicateChunked,
  extractEmailsChunked,
  extractUrlsChunked,
  splitEmailsPersonalDomainChunked,
  splitLinesTrimmedChunked,
} from "@/lib/extract";

type Job =
  | { id: number; kind: "emails"; text: string; unique: boolean }
  | { id: number; kind: "urls"; text: string; unique: boolean }
  | { id: number; kind: "dedupe"; text: string }
  | { id: number; kind: "lines"; text: string };

self.onmessage = async (event: MessageEvent<Job>) => {
  const job = event.data;
  const onProgress = (pct: number) => {
    self.postMessage({ id: job.id, type: "progress", pct });
  };
  try {
    if (job.kind === "emails") {
      const emails = await extractEmailsChunked(job.text, job.unique, (pct) => onProgress(Math.round(pct * 0.75)));
      const split = await splitEmailsPersonalDomainChunked(emails);
      self.postMessage({
        id: job.id,
        type: "done",
        result: { kind: "emails", emails, personal: split.personal, domain: split.domain },
      });
      return;
    }
    if (job.kind === "urls") {
      const urls = await extractUrlsChunked(job.text, job.unique, onProgress);
      self.postMessage({ id: job.id, type: "done", result: { kind: "urls", urls } });
      return;
    }
    if (job.kind === "dedupe") {
      const lines = await splitLinesTrimmedChunked(job.text, (pct) => onProgress(Math.round(pct * 0.45)));
      const unique = await deduplicateChunked(lines, (pct) => onProgress(45 + Math.round(pct * 0.55)));
      self.postMessage({
        id: job.id,
        type: "done",
        result: { kind: "dedupe", total: lines.length, unique, removed: lines.length - unique.length },
      });
      return;
    }
    const lines = await splitLinesTrimmedChunked(job.text, onProgress);
    self.postMessage({ id: job.id, type: "done", result: { kind: "lines", lines } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    self.postMessage({ id: job.id, type: "error", message });
  }
};
