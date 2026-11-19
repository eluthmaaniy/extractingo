import type { PolicyBatchItem } from "@/workers/policy.worker";
import { readStorePolicy } from "@/lib/shopifyPolicy";

export type PolicyJob = { host: string; url: string };

export type PolicyPace = { concurrency: number; workers: number };

/** Two queues, each reading 12 stores at once. */
export function policyPace(): PolicyPace {
  return { concurrency: 12, workers: 2 };
}

function chunks(jobs: PolicyJob[], groups: number): PolicyJob[][] {
  if (jobs.length === 0) return [];
  const count = jobs.length > 24 ? groups : 1;
  const size = Math.ceil(jobs.length / count);
  const parts: PolicyJob[][] = [];
  for (let i = 0; i < jobs.length; i += size) parts.push(jobs.slice(i, i + size));
  return parts;
}

/** Reads stores in background workers. Two chunks run at once on a long list. */
export function runPolicyJobs(
  jobs: PolicyJob[],
  onBatch: (items: PolicyBatchItem[]) => void,
  pace: PolicyPace = policyPace(),
): { cancel: () => void; done: Promise<void> } {
  const parts = chunks(jobs, pace.workers);
  const workers: Worker[] = [];
  let settled = false;

  const done = new Promise<void>((resolve, reject) => {
    if (parts.length === 0) {
      resolve();
      return;
    }
    let pending = parts.length;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      for (const worker of workers) worker.terminate();
      reject(error);
    };
    for (const part of parts) {
      let worker: Worker;
      try {
        worker = new Worker(new URL("../workers/policy.worker.ts", import.meta.url), { type: "module" });
      } catch (error) {
        fail(error instanceof Error ? error : new Error("worker"));
        return;
      }
      workers.push(worker);
      worker.onmessage = (event: MessageEvent) => {
        if (settled) return;
        if (event.data?.type === "batch") onBatch(event.data.items as PolicyBatchItem[]);
        if (event.data?.type === "done") {
          const tail = event.data.items as PolicyBatchItem[] | undefined;
          if (tail?.length) onBatch(tail);
          pending -= 1;
          if (pending === 0) resolve();
        }
      };
      worker.onerror = () => {
        if (!settled) fail(new Error("worker"));
      };
      worker.postMessage({ jobs: part, concurrency: pace.concurrency });
    }
  });

  return {
    cancel: () => {
      if (settled) return;
      settled = true;
      for (const worker of workers) worker.terminate();
    },
    done,
  };
}

/** Same batching on the page thread if a worker cannot start. */
export async function runPolicyJobsHere(
  jobs: PolicyJob[],
  onBatch: (items: PolicyBatchItem[]) => void,
  pace: PolicyPace = policyPace(),
): Promise<void> {
  const queue = jobs.slice();
  let batch: PolicyBatchItem[] = [];
  let timer = 0;
  const flush = () => {
    timer = 0;
    if (batch.length === 0) return;
    const items = batch;
    batch = [];
    onBatch(items);
  };
  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(flush, 200);
  };
  const worker = async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      batch.push({ url: job.url, read: await readStorePolicy(job.url) });
      schedule();
    }
  };
  await Promise.all(Array.from({ length: Math.min(pace.concurrency, Math.max(jobs.length, 1)) }, () => worker()));
  window.clearTimeout(timer);
  flush();
}
