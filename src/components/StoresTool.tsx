import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { copyLines, downloadTxt } from "@/lib/clipboard";
import { downloadLinesAsFile, MAX_DISPLAY } from "@/lib/extract";
import { policyHitsToCsv, type PolicyHit } from "@/lib/policyHtml";
import { runPolicyJobs, runPolicyJobsHere, type PolicyJob } from "@/lib/policyJob";
import { listPolicyTargets } from "@/lib/policyUrl";
import {
  clearPolicySession,
  loadPolicySession,
  savePolicySession,
  type PolicyMissRecord,
  type PolicyRunReport,
} from "@/lib/policySession";
import type { ShopPolicyStatus } from "@/lib/shopifyPolicy";
import type { PolicyBatchItem } from "@/workers/policy.worker";
import { cn } from "@/lib/utils";

const RECENT_CAP = 8;

type StoreNote = { store: string; status: ShopPolicyStatus; detail: string };

const STATUS_LABEL: Record<ShopPolicyStatus, string> = {
  ok: "Found",
  "no-emails": "No email",
  "no-policy": "No policy",
  "not-shopify": "Not Shopify",
  blocked: "Blocked",
  failed: "Failed",
};

function chipClass(status: ShopPolicyStatus): string {
  if (status === "ok") return "border-success/30 bg-success-soft text-success";
  if (status === "no-emails" || status === "no-policy") return "border-warning/40 bg-warning/10 text-warning";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function remainingLabel(started: number, done: number, total: number): string {
  const left = Math.max(0, total - done);
  if (done < 4) return `${left.toLocaleString()} stores left`;
  const seconds = Math.round(((Date.now() - started) / done) * left / 1000);
  const time = seconds < 60 ? `${Math.max(1, seconds)}s` : `${Math.max(1, Math.round(seconds / 60))} min`;
  return `${left.toLocaleString()} stores left · about ${time}`;
}

function jobsFromSource(source: string): { jobs: PolicyJob[]; invalid: number } {
  const targets = listPolicyTargets(source);
  const jobs: PolicyJob[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const target of targets) {
    if (target.reason !== "ok" || !target.url || !target.host) {
      invalid += 1;
      continue;
    }
    if (seen.has(target.host)) continue;
    seen.add(target.host);
    jobs.push({ host: target.host, url: target.url });
  }
  return { jobs, invalid };
}

export function StoresTool({ runRef }: { runRef: MutableRefObject<() => void> }) {
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [hits, setHits] = useState<PolicyHit[]>([]);
  const [recent, setRecent] = useState<StoreNote[]>([]);
  const [misses, setMisses] = useState<PolicyMissRecord[]>([]);
  const [report, setReport] = useState<PolicyRunReport | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [eta, setEta] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const skipSave = useRef(true);
  const quotaWarned = useRef(false);
  const runId = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(0);
  const doneRef = useRef(0);
  const totalRef = useRef(0);
  const emptyRef = useRef(0);
  const missesRef = useRef<PolicyMissRecord[]>([]);
  const seenHit = useRef(new Set<string>());
  const fileRef = useRef<HTMLInputElement>(null);

  const resetRunView = () => {
    setDone(0);
    setTotal(0);
    setEta("");
    setRecent([]);
  };

  const loadFile = (file: File | undefined) => {
    if (!file || running) return;
    void file.text().then((text) => {
      setSource(text);
      setFileName(file.name);
      setHits([]);
      setMisses([]);
      setReport(null);
      missesRef.current = [];
      emptyRef.current = 0;
      seenHit.current = new Set();
      resetRunView();
    });
  };

  const applyBatch = (items: PolicyBatchItem[], pending: Map<string, string>) => {
    const notes: StoreNote[] = [];
    const added: PolicyHit[] = [];
    for (const item of items) {
      const { read } = item;
      pending.delete(read.store);
      notes.push({ store: read.store, status: read.status, detail: read.detail });
      const without = missesRef.current.filter((miss) => miss.store !== read.store);
      if (read.emails.length > 0) {
        missesRef.current = without;
        for (const email of read.emails) {
          const key = `${read.store}\n${email}`;
          if (seenHit.current.has(key)) continue;
          seenHit.current.add(key);
          added.push({ store: read.store, policyUrl: read.policyUrl, email });
        }
      } else if (read.status === "no-emails" || read.status === "no-policy") {
        emptyRef.current += 1;
        missesRef.current = without;
      } else {
        missesRef.current = [{ store: read.store, url: item.url, detail: read.detail }, ...without].slice(0, 80);
      }
    }
    doneRef.current = totalRef.current - pending.size;
    setDone(doneRef.current);
    setEta(remainingLabel(startedRef.current, doneRef.current, totalRef.current));
    setRecent((current) => [...notes.reverse(), ...current].slice(0, RECENT_CAP));
    setMisses(missesRef.current);
    if (added.length) setHits((current) => current.concat(added));
  };

  const start = (jobs: PolicyJob[], retry: boolean) => {
    if (jobs.length === 0) {
      toast.error("Paste at least one store URL.");
      return;
    }
    cancelRef.current?.();
    const id = ++runId.current;
    const pending = new Map(jobs.map((job) => [job.host, job.url]));
    startedRef.current = Date.now();
    doneRef.current = 0;
    totalRef.current = jobs.length;
    if (!retry) {
      emptyRef.current = 0;
      missesRef.current = [];
      seenHit.current = new Set();
      setHits([]);
      setMisses([]);
      setReport(null);
    }
    setRunning(true);
    setTotal(jobs.length);
    setDone(0);
    setRecent([]);
    setEta(remainingLabel(startedRef.current, 0, jobs.length));

    const onBatch = (items: PolicyBatchItem[]) => {
      if (runId.current !== id) return;
      applyBatch(items, pending);
    };

    const publish = () => {
      if (runId.current !== id) return;
      for (const [host, url] of pending) {
        if (missesRef.current.some((miss) => miss.store === host)) continue;
        missesRef.current = [{ store: host, url, detail: "Stopped before a result came back." }, ...missesRef.current].slice(0, 80);
      }
      pending.clear();
      setMisses(missesRef.current);
      setReport({ empty: emptyRef.current, missed: missesRef.current.length, finished: true });
      setRunning(false);
      setDone(totalRef.current);
      setEta("");
      toast.success(
        `${emptyRef.current.toLocaleString()} with no email · ${missesRef.current.length.toLocaleString()} could not be read`,
      );
    };

    const run = runPolicyJobs(jobs, onBatch);
    cancelRef.current = run.cancel;
    void run.done.then(publish).catch(() => {
      if (runId.current !== id) return;
      const left = jobs.filter((job) => pending.has(job.host));
      if (left.length === 0) {
        publish();
        return;
      }
      void runPolicyJobsHere(left, onBatch).then(publish);
    });
  };

  const findEmails = () => {
    const { jobs, invalid } = jobsFromSource(source);
    if (jobs.length === 0) {
      toast.error(invalid ? "None of those lines are web addresses." : "Paste at least one store URL.");
      return;
    }
    start(jobs, false);
  };

  const retryMisses = () => {
    if (running || missesRef.current.length === 0) return;
    start(
      missesRef.current.map((miss) => ({ host: miss.store, url: miss.url })),
      true,
    );
  };

  runRef.current = findEmails;

  const clear = () => {
    runId.current += 1;
    cancelRef.current?.();
    cancelRef.current = null;
    skipSave.current = true;
    setSource("");
    setFileName("");
    setHits([]);
    setMisses([]);
    setReport(null);
    missesRef.current = [];
    emptyRef.current = 0;
    seenHit.current = new Set();
    setRunning(false);
    resetRunView();
    void clearPolicySession().finally(() => {
      skipSave.current = false;
    });
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setEta(remainingLabel(startedRef.current, doneRef.current, totalRef.current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    let cancelled = false;
    void loadPolicySession().then((session) => {
      if (cancelled || !session) {
        skipSave.current = false;
        setHydrated(true);
        return;
      }
      setSource(session.source);
      setHits(session.hits);
      setMisses(session.misses);
      missesRef.current = session.misses;
      emptyRef.current = session.summary.empty;
      seenHit.current = new Set(session.hits.map((hit) => `${hit.store}\n${hit.email}`));
      setReport(session.summary.finished ? session.summary : null);
      skipSave.current = false;
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || skipSave.current || running) return;
    const timer = window.setTimeout(() => {
      void savePolicySession({
        version: 1,
        updatedAt: Date.now(),
        source,
        policyPath: "/policies/privacy-policy",
        activeUrl: "",
        hits,
        summary: report ?? { empty: emptyRef.current, missed: misses.length, finished: false },
        misses,
      }).then((result) => {
        if (result === "quota" && !quotaWarned.current) {
          quotaWarned.current = true;
          toast.error("This list is too large to keep after refresh. Download it if you need a copy.");
        }
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hydrated, source, hits, misses, report, running]);

  const lineCount = source.split(/\r?\n/).filter((line) => line.trim()).length;
  const shown = hits.slice(0, MAX_DISPLAY);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const left = Math.max(0, total - done);

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border-2 border-dashed border-border/80 bg-muted/10 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          loadFile(event.dataTransfer.files[0]);
        }}
      >
        <label className="flex cursor-pointer flex-col items-center gap-1 text-center">
          <span className="text-sm font-medium text-foreground">{fileName ? fileName : "Drop a .txt or .csv of store URLs"}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {lineCount ? `${lineCount.toLocaleString()} lines. One shop per line.` : "Or paste the list below. shop.myshopify.com works too."}
          </span>
          <Input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain"
            className="sr-only"
            disabled={!hydrated || running}
            onChange={(event) => {
              loadFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <Textarea
        className="min-h-[120px] bg-card font-mono text-[13px] font-normal leading-5 dark:bg-card"
        placeholder={"colourpop.com\ndemo-shop.myshopify.com"}
        value={source}
        onChange={(event) => {
          setSource(event.target.value);
          setFileName("");
        }}
        aria-label="Store URLs, one per line"
        disabled={!hydrated || running}
      />

      <div className="flex gap-2">
        <Button className="gmail-btn min-w-0 flex-1" onClick={findEmails} disabled={!hydrated || running}>
          <i className="ri-search-line" aria-hidden />
          {running ? "Reading policies…" : "Find emails"}
        </Button>
        {(source.trim() || hits.length > 0 || report) && (
          <Button type="button" variant="outline" className="h-11 shrink-0 rounded-full px-4 sm:w-28" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      {running && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-[13px] font-normal">
            <span className="text-foreground">{left.toLocaleString()} stores left</span>
            <span className="text-primary">{eta}</span>
          </div>
          <Progress value={progress} aria-label="Stores remaining" />
          <p className="text-xs font-normal text-muted-foreground">
            {done.toLocaleString()} of {total.toLocaleString()} checked
            {hits.length ? ` · ${hits.length.toLocaleString()} emails kept` : ""}
          </p>
          {recent.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-xl border border-border/70 bg-muted/20 p-2">
              {recent.map((note, index) => (
                <li key={`${note.store}-${index}`} className="flex items-center justify-between gap-2 px-1 py-1">
                  <span className="min-w-0 break-all font-mono text-[13px] font-normal text-foreground">{note.store}</span>
                  <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium", chipClass(note.status))}>
                    {STATUS_LABEL[note.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report?.finished && !running && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3">
            <p className="font-mono text-lg font-medium text-warning">{report.empty.toLocaleString()}</p>
            <p className="text-[13px] font-normal text-foreground">Stores with no email in the policy</p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3">
            <p className="font-mono text-lg font-medium text-destructive">{report.missed.toLocaleString()}</p>
            <p className="text-[13px] font-normal text-foreground">Stores that could not be read</p>
            {misses.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retryMisses}>
                Retry these {misses.length.toLocaleString()}
              </Button>
            )}
          </div>
        </div>
      )}

      {hits.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold tracking-tight">
              Policy emails <span className="font-medium text-muted-foreground">({hits.length.toLocaleString()})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copyLines(hits.map((hit) => hit.email), "Emails copied")}>
                <i className="ri-file-copy-line" aria-hidden />
                Copy emails
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyLines(policyHitsToCsv(hits), "CSV copied")}>
                <i className="ri-file-copy-line" aria-hidden />
                Copy CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadTxt(hits.map((hit) => hit.email), "store_policy_emails.txt")}>
                <i className="ri-download-line" aria-hidden />
                .txt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadLinesAsFile(policyHitsToCsv(hits), "store_policy_emails.csv", "text/csv");
                  toast.success("CSV download started");
                }}
              >
                <i className="ri-file-excel-2-line" aria-hidden />
                .csv
              </Button>
            </div>
          </div>
          <ul className="max-h-[46vh] overflow-auto rounded-xl border border-border/70 bg-muted/40">
            {shown.map((hit) => (
              <li key={`${hit.store}-${hit.email}`} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                <p className="break-all font-mono text-[13px] font-normal leading-5 text-foreground">{hit.email}</p>
                <p className="break-all text-xs font-normal text-muted-foreground">{hit.store}</p>
              </li>
            ))}
          </ul>
          {hits.length > shown.length && (
            <p className="text-xs font-normal text-muted-foreground">
              … and {(hits.length - shown.length).toLocaleString()} more. Download for the full list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
