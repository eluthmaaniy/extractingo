import { readStorePolicy, type ShopPolicyRead } from "@/lib/shopifyPolicy";

const CONCURRENCY = 12;
const FLUSH_MS = 200;

type Job = { host: string; url: string };
type Start = { jobs: Job[] };
export type PolicyBatchItem = { url: string; read: ShopPolicyRead };

self.onmessage = (event: MessageEvent<Start>) => {
  const jobs = event.data.jobs ?? [];
  const queue = jobs.slice();
  let batch: PolicyBatchItem[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    if (batch.length === 0) return;
    const items = batch;
    batch = [];
    self.postMessage({ type: "batch", items });
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(flush, FLUSH_MS);
  };

  const worker = async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      try {
        batch.push({ url: job.url, read: await readStorePolicy(job.url) });
      } catch {
        batch.push({
          url: job.url,
          read: { store: job.host, policyUrl: "", emails: [], status: "failed", detail: "Could not read this store." },
        });
      }
      schedule();
    }
  };

  void Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(jobs.length, 1)) }, () => worker())).then(() => {
    clearTimeout(timer);
    flush();
    self.postMessage({ type: "done" });
  });
};
