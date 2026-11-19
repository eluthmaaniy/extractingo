import { readStorePolicy, type ShopPolicyRead } from "@/lib/shopifyPolicy";

type Job = { host: string; url: string };
type Start = { jobs: Job[]; concurrency?: number };
export type PolicyBatchItem = { url: string; read: ShopPolicyRead };

self.onmessage = (event: MessageEvent<Start>) => {
  const jobs = event.data.jobs ?? [];
  const concurrency = Math.min(12, Math.max(1, event.data.concurrency ?? 8));
  const queue = jobs.slice();
  const results: PolicyBatchItem[] = [];

  const slots = Math.min(concurrency, Math.max(jobs.length, 1));
  const worker = async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      let item: PolicyBatchItem;
      try {
        item = { url: job.url, read: await readStorePolicy(job.url) };
      } catch {
        item = {
          url: job.url,
          read: { store: job.host, policyUrl: "", emails: [], status: "failed", detail: "Could not read this store." },
        };
      }
      results.push(item);
      self.postMessage({ type: "batch", items: [item] });
    }
  };

  void Promise.all(Array.from({ length: slots }, () => worker())).then(() => {
    self.postMessage({ type: "done", items: results });
  });
};
