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
import { isTemporaryMiss, type ShopPolicyStatus } from "@/lib/shopifyPolicy";
import type { PolicyBatchItem } from "@/workers/policy.worker";
import { cn } from "@/lib/utils";

const RECENT_CAP = 8;
const NAME_CAP = 12;
const BULK_LINES = 1000;
const PASSES = 4;

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
  if (status === "not-shopify") return "border-border bg-muted text-muted-foreground";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function lineCountOf(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim()).length;
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

function remainingLabel(started: number, done: number, total: number, retrying: boolean): string {
  const left = Math.max(0, total - done);
  if (retrying) return `Checking ${left.toLocaleString()} again`;
  if (done < 4) return `${left.toLocaleString()} stores left`;
  const seconds = Math.round((((Date.now() - started) / done) * left) / 1000);
  const time = seconds < 60 ? `${Math.max(1, seconds)}s` : `${Math.max(1, Math.round(seconds / 60))} min`;
  return `${left.toLocaleString()} stores left · about ${time}`;
}

function clock(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function durationLabel(startedAt: number, endedAt: number): string {
  const seconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest}s` : `${minutes} min`;
}

function blankReport(): PolicyRunReport {
  return { empty: 0, notShopify: 0, missed: 0, finished: false, startedAt: 0, endedAt: 0 };
}

function NameList({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, NAME_CAP);
  return (
    <p className="mt-1 break-all text-[11px] font-normal leading-4 text-muted-foreground">
      {shown.join(", ")}
      {names.length > shown.length ? ` · and ${(names.length - shown.length).toLocaleString()} more` : ""}
    </p>
  );
}

export function StoresTool({ runRef }: { runRef: MutableRefObject<() => void> }) {
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [listed, setListed] = useState(0);
  const [bulk, setBulk] = useState(false);
  const [hits, setHits] = useState<PolicyHit[]>([]);
  const [recent, setRecent] = useState<StoreNote[]>([]);
  const [misses, setMisses] = useState<PolicyMissRecord[]>([]);
  const [others, setOthers] = useState<PolicyMissRecord[]>([]);
  const [report, setReport] = useState<PolicyRunReport | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [eta, setEta] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const skipSave = useRef(true);
  const quotaWarned = useRef(false);
  const runId = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const sourceRef = useRef("");
  const startedRef = useRef(0);
  const doneRef = useRef(0);
  const totalRef = useRef(0);
  const emptyRef = useRef(0);
  const missesRef = useRef<PolicyMissRecord[]>([]);
  const othersRef = useRef<PolicyMissRecord[]>([]);
  const seenHit = useRef(new Set<string>());
  const retryingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetRunView = () => {
    setDone(0);
    setTotal(0);
    setEta("");
    setRecent([]);
    setRetrying(false);
    retryingRef.current = false;
  };

  const remember = (text: string, name: string) => {
    sourceRef.current = text;
    const lines = lineCountOf(text);
    setListed(lines);
    setFileName(name);
    if (lines > BULK_LINES) {
      setBulk(true);
      setSource("");
      return;
    }
    setBulk(false);
    setSource(text);
  };

  const loadFile = (file: File | undefined) => {
    if (!file || running) return;
    setFileName(file.name);
    setListed(0);
    void file.text().then((text) => {
      remember(text, file.name);
      setHits([]);
      setMisses([]);
      setOthers([]);
      setReport(null);
      missesRef.current = [];
      othersRef.current = [];
      emptyRef.current = 0;
      seenHit.current = new Set();
      resetRunView();
    });
  };

  const recordFinal = (item: PolicyBatchItem) => {
    const { read } = item;
    const note: StoreNote = { store: read.store, status: read.status, detail: read.detail };
    if (read.emails.length > 0) {
      const added: PolicyHit[] = [];
      for (const email of read.emails) {
        const key = `${read.store}\n${email}`;
        if (seenHit.current.has(key)) continue;
        seenHit.current.add(key);
        added.push({ store: read.store, policyUrl: read.policyUrl, email });
      }
      if (added.length) setHits((current) => current.concat(added));
    } else if (read.status === "no-emails" || read.status === "no-policy") {
      emptyRef.current += 1;
    } else if (read.status === "not-shopify") {
      othersRef.current = [...othersRef.current, { store: read.store, url: item.url, detail: read.detail, status: "not-shopify" }];
      setOthers(othersRef.current);
    } else {
      missesRef.current = [
        ...missesRef.current,
        { store: read.store, url: item.url, detail: read.detail, status: read.status === "blocked" ? "blocked" : "failed" },
      ];
      setMisses(missesRef.current);
    }
    doneRef.current += 1;
    setDone(doneRef.current);
    setEta(remainingLabel(startedRef.current, doneRef.current, totalRef.current, retryingRef.current));
    setRecent((current) => [note, ...current].slice(0, RECENT_CAP));
  };

  const runPass = (jobs: PolicyJob[], id: number) => {
    const pending = new Map(jobs.map((job) => [job.host, job.url]));
    const again: PolicyJob[] = [];
    const take = (item: PolicyBatchItem) => {
      if (runId.current !== id) return;
      const host = item.read.store || jobs.find((job) => job.url === item.url)?.host || "";
      if (host && !pending.has(host)) return;
      if (host) pending.delete(host);
      if (isTemporaryMiss(item.read)) {
        again.push({ host, url: item.url });
        return;
      }
      recordFinal(item);
    };
    const finishLeft = () => {
      for (const [host, url] of pending) again.push({ host, url });
      pending.clear();
    };
    return new Promise((resolve) => {
      let closed = false;
      const succeed = () => {
        if (closed || pending.size > 0) return;
        closed = true;
        finishLeft();
        run.cancel();
        resolve(again);
      };
      const run = runPolicyJobs(jobs, (items) => {
        for (const item of items) take(item);
        succeed();
      });
      cancelRef.current = () => {
        closed = true;
        run.cancel();
      };
      void run.done.then(() => {
        succeed();
      }).catch(() => {
        if (closed) return;
        if (runId.current !== id) {
          closed = true;
          resolve(again);
          return;
        }
        const left = jobs.filter((job) => pending.has(job.host));
        if (left.length === 0) {
          closed = true;
          finishLeft();
          resolve(again);
          return;
        }
        void runPolicyJobsHere(left, (items) => {
          for (const item of items) take(item);
        }).then(() => {
          if (closed) return;
          closed = true;
          finishLeft();
          resolve(again);
        });
      });
    });
  };

  const start = (jobs: PolicyJob[], retry: boolean) => {
    if (jobs.length === 0) {
      toast.error("Paste at least one store URL.");
      return;
    }
    cancelRef.current?.();
    const id = ++runId.current;
    const startedAt = retry && report?.startedAt ? report.startedAt : Date.now();
    startedRef.current = startedAt;
    if (!retry) {
      doneRef.current = 0;
      emptyRef.current = 0;
      missesRef.current = [];
      othersRef.current = [];
      seenHit.current = new Set();
      setHits([]);
      setMisses([]);
      setOthers([]);
      setReport(null);
      setDone(0);
    } else {
      missesRef.current = [];
      setMisses([]);
      doneRef.current = Math.max(0, totalRef.current - jobs.length);
      setDone(doneRef.current);
    }
    totalRef.current = retry ? totalRef.current : jobs.length;
    retryingRef.current = false;
    setRunning(true);
    setRetrying(false);
    setTotal(totalRef.current);
    setRecent([]);
    setEta(remainingLabel(startedAt, doneRef.current, totalRef.current, false));

    const loop = async () => {
      let queue = jobs;
      for (let pass = 0; pass < PASSES && queue.length > 0; pass += 1) {
        if (runId.current !== id) return;
        retryingRef.current = pass > 0;
        setRetrying(pass > 0);
        setEta(remainingLabel(startedRef.current, doneRef.current, totalRef.current, pass > 0));
        queue = await runPass(queue, id);
        if (queue.length > 0 && pass < PASSES - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
      }
      if (runId.current !== id) return;
      for (const job of queue) {
        missesRef.current = [
          ...missesRef.current,
          { store: job.host, url: job.url, detail: "Still no response after several tries.", status: "failed" },
        ];
        doneRef.current += 1;
      }
      const endedAt = Date.now();
      const next: PolicyRunReport = {
        empty: emptyRef.current,
        notShopify: othersRef.current.length,
        missed: missesRef.current.length,
        finished: true,
        startedAt,
        endedAt,
      };
      setMisses(missesRef.current);
      setOthers(othersRef.current);
      setReport(next);
      setDone(totalRef.current);
      setRunning(false);
      setRetrying(false);
      retryingRef.current = false;
      setEta("");
      toast.success(
        `${emptyRef.current.toLocaleString()} with no email · ${othersRef.current.length.toLocaleString()} not Shopify · ${missesRef.current.length.toLocaleString()} could not be read`,
      );
    };
    void loop();
  };

  const findEmails = () => {
    const text = sourceRef.current.trim() ? sourceRef.current : source;
    if (!text.trim()) {
      toast.error("Paste at least one store URL.");
      return;
    }
    setRunning(true);
    window.setTimeout(() => {
      const { jobs, invalid } = jobsFromSource(text);
      if (jobs.length === 0) {
        setRunning(false);
        toast.error(invalid ? "None of those lines are web addresses." : "Paste at least one store URL.");
        return;
      }
      start(jobs, false);
    }, 0);
  };

  const retryMisses = () => {
    const jobs = missesRef.current.filter((miss) => miss.status !== "not-shopify").map((miss) => ({ host: miss.store, url: miss.url }));
    if (running || jobs.length === 0) return;
    start(jobs, true);
  };

  runRef.current = findEmails;

  const clear = () => {
    runId.current += 1;
    cancelRef.current?.();
    cancelRef.current = null;
    skipSave.current = true;
    sourceRef.current = "";
    setSource("");
    setFileName("");
    setListed(0);
    setBulk(false);
    setHits([]);
    setMisses([]);
    setOthers([]);
    setReport(null);
    missesRef.current = [];
    othersRef.current = [];
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
      setEta(remainingLabel(startedRef.current, doneRef.current, totalRef.current, retryingRef.current));
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
      remember(session.source, "");
      setHits(session.hits);
      const failed = session.misses.filter((miss) => miss.status !== "not-shopify");
      const shops = session.misses.filter((miss) => miss.status === "not-shopify");
      setMisses(failed);
      setOthers(shops);
      missesRef.current = failed;
      othersRef.current = shops;
      emptyRef.current = session.summary.empty;
      seenHit.current = new Set(session.hits.map((hit) => `${hit.store}\n${hit.email}`));
      totalRef.current =
        new Set(session.hits.map((hit) => hit.store)).size +
        session.summary.empty +
        session.summary.notShopify +
        session.summary.missed;
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
      const savedSource = sourceRef.current.trim() ? sourceRef.current : source;
      void savePolicySession({
        version: 1,
        updatedAt: Date.now(),
        source: savedSource,
        policyPath: "/policies/privacy-policy",
        activeUrl: "",
        hits,
        summary: report ?? { ...blankReport(), empty: emptyRef.current, notShopify: others.length, missed: misses.length },
        misses: [...othersRef.current, ...missesRef.current],
      }).then((result) => {
        if (result === "quota" && !quotaWarned.current) {
          quotaWarned.current = true;
          toast.error("This list is too large to keep after refresh. Download it if you need a copy.");
        }
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hydrated, source, hits, misses, others, report, running]);

  const shown = hits.slice(0, MAX_DISPLAY);
  const progress = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
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
          <span className="text-[13px] font-medium text-foreground">{fileName ? fileName : "Drop a .txt or .csv of store URLs"}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {listed
              ? `${listed.toLocaleString()} lines. One shop per line.`
              : "Or paste the list below. shop.myshopify.com works too."}
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
        className="min-h-[120px] bg-card font-mono text-[12px] font-normal leading-5 dark:bg-card"
        placeholder={bulk ? "This list is loaded. Paste here only to replace it." : "colourpop.com\ndemo-shop.myshopify.com"}
        value={source}
        onChange={(event) => {
          const next = event.target.value;
          sourceRef.current = next;
          setSource(next);
          setBulk(false);
          setListed(lineCountOf(next));
          setFileName("");
        }}
        aria-label="Store URLs, one per line"
        disabled={!hydrated || running}
      />

      <div className="flex gap-2">
        <Button className="gmail-btn min-w-0 flex-1" onClick={findEmails} disabled={!hydrated || running}>
          <i className="ri-search-line" aria-hidden />
          {running ? (retrying ? "Checking again…" : "Reading policies…") : "Find emails"}
        </Button>
        {(source.trim() || bulk || hits.length > 0 || report) && (
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
            {retrying ? " · retrying stores that did not answer" : ""}
          </p>
          {recent.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-xl border border-border/70 bg-muted/20 p-2">
              {recent.map((note, index) => (
                <li key={`${note.store}-${index}`} className="flex items-center justify-between gap-2 px-1 py-1">
                  <span className="min-w-0 break-all font-mono text-[12px] font-normal text-foreground">{note.store}</span>
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
        <div className="space-y-2">
          <p className="text-xs font-normal text-muted-foreground">
            Started {clock(report.startedAt)} · Ended {clock(report.endedAt)} · {durationLabel(report.startedAt, report.endedAt)}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3">
              <p className="font-mono text-lg font-medium text-warning">{report.empty.toLocaleString()}</p>
              <p className="text-[13px] font-normal text-foreground">No email in the policy</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="font-mono text-lg font-medium text-foreground">{report.notShopify.toLocaleString()}</p>
              <p className="text-[13px] font-normal text-foreground">Not Shopify</p>
              <NameList names={others.map((item) => item.store)} />
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3">
              <p className="font-mono text-lg font-medium text-destructive">{report.missed.toLocaleString()}</p>
              <p className="text-[13px] font-normal text-foreground">Could not be read</p>
              <NameList names={misses.map((item) => item.store)} />
              {misses.length > 0 && (
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retryMisses}>
                  Retry these {misses.length.toLocaleString()}
                </Button>
              )}
            </div>
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
                <p className="break-all font-mono text-[12px] font-normal leading-5 text-foreground">{hit.email}</p>
                <p className="break-all text-[11px] font-normal text-muted-foreground">{hit.store}</p>
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
