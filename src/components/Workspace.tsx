import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ModeSwitcher, type WorkspaceMode } from "@/components/ModeSwitcher";
import { ReplaceConfirm } from "@/components/SessionBanner";
import { ResultPane } from "@/components/ResultPane";
import { StoresTool } from "@/components/StoresTool";
import { ToolIntro } from "@/components/ToolIntro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { dedupeJob, extractEmailsJob, extractUrlsJob, linesJob } from "@/lib/extractClient";
import {
  DEFAULT_CHUNK_SIZE,
  LARGE_INPUT_THRESHOLD,
  chunkList,
  filterPersonal,
  type PersonalFilter,
} from "@/lib/extract";
import { ACCEPTED_EXTENSIONS, readSourceFiles } from "@/lib/files";
import { applyDocumentSeo, hashForMode, modeFromHash } from "@/lib/seo";
import {
  clearSession,
  emptyExtracted,
  isSessionEmpty,
  loadSession,
  saveSession,
  type ExtractedFlags,
  type WorkspaceSession,
} from "@/lib/session";
import { cn } from "@/lib/utils";

type EmailBucket = "personal" | "domain";

function previewSource(source: string): string {
  return (
    source.slice(0, 1000) +
    `\n\n… [${(source.length / 1024).toFixed(0)} KB loaded — too large to show in full. Run the tool.]`
  );
}

const PLACEHOLDERS: Record<WorkspaceMode, string> = {
  emails: "Paste mixed text, a crawl, or an email list…",
  urls: "Paste text that contains http(s) links…",
  clean: "Paste one email or URL per line…",
  segment: "Paste a cleaned list, one email per line…",
  stores: "Paste one store URL per line…",
};

const DROP_COPY: Record<WorkspaceMode, { title: string; subtitle: string }> = {
  emails: {
    title: "Drop files or click to browse",
    subtitle: ".txt, .csv, .pdf, .docx — addresses are found in the file",
  },
  urls: {
    title: "Drop a file that contains links",
    subtitle: ".txt, .csv, .pdf, .docx — only the URL itself is kept",
  },
  clean: {
    title: "Drop a finished list",
    subtitle: "One email per line in .txt or .csv works best",
  },
  segment: {
    title: "Drop a cleaned list",
    subtitle: "This splits lines. It does not extract emails from paragraphs.",
  },
  stores: {
    title: "Drop a list of store URLs",
    subtitle: "One shop per line in .txt or .csv.",
  },
};

const ACTIONS: Record<WorkspaceMode, { idle: string; busy: string; icon: string }> = {
  emails: { idle: "Extract emails", busy: "Extracting…", icon: "ri-mail-open-line" },
  urls: { idle: "Extract URLs", busy: "Extracting…", icon: "ri-links-line" },
  clean: { idle: "Remove duplicates", busy: "Cleaning…", icon: "ri-delete-bin-line" },
  segment: { idle: "Split list", busy: "Splitting…", icon: "ri-scissors-line" },
  stores: { idle: "Find emails", busy: "Finding emails…", icon: "ri-store-2-line" },
};

export function Workspace() {
  const [mode, setMode] = useState<WorkspaceMode>(() =>
    typeof window === "undefined" ? "emails" : modeFromHash(),
  );
  const [text, setText] = useState("");
  const [bulkActive, setBulkActive] = useState(false);
  const bulkRef = useRef<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [unique, setUnique] = useState(true);
  const [personalFilter, setPersonalFilter] = useState<PersonalFilter>("all");
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedFlags>(emptyExtracted);
  const [personal, setPersonal] = useState<string[]>([]);
  const [domain, setDomain] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [cleaned, setCleaned] = useState<string[]>([]);
  const [dupStats, setDupStats] = useState({ total: 0, removed: 0 });
  const [segments, setSegments] = useState<string[][]>([]);
  const [bucket, setBucket] = useState<EmailBucket>("personal");
  const [hydrated, setHydrated] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => undefined);
  const storesRunRef = useRef<() => void>(() => undefined);
  const skipSave = useRef(true);
  const quotaWarned = useRef(false);
  const sessionRef = useRef<WorkspaceSession | null>(null);

  const sourceText = () => bulkRef.current ?? text;
  const hasSource = Boolean((bulkRef.current ?? text).trim());
  const done = extracted[mode];

  const setSource = (value: string) => {
    if (value.length > LARGE_INPUT_THRESHOLD) {
      bulkRef.current = value;
      setBulkActive(true);
      setText(previewSource(value));
    } else {
      bulkRef.current = null;
      setBulkActive(false);
      setText(value);
    }
  };

  const resetResults = () => {
    setExtracted(emptyExtracted());
    setPersonal([]);
    setDomain([]);
    setUrls([]);
    setCleaned([]);
    setSegments([]);
    setDupStats({ total: 0, removed: 0 });
  };

  const snapshot = (): WorkspaceSession => ({
    version: 1,
    updatedAt: Date.now(),
    mode,
    source: sourceText(),
    fileNames,
    unique,
    personalFilter,
    chunkSize,
    extracted,
    personal,
    domain,
    urls,
    cleaned,
    dupStats,
    segments,
    bucket,
  });

  sessionRef.current = snapshot();

  const persist = async (session: WorkspaceSession) => {
    if (skipSave.current) return;
    const result = await saveSession(session);
    if (skipSave.current) {
      await clearSession();
      return;
    }
    if (result === "quota" && !quotaWarned.current) {
      quotaWarned.current = true;
      toast.error("This list is too large to keep after refresh. Download it if you need a copy.");
    }
  };

  const clear = () => {
    skipSave.current = true;
    bulkRef.current = null;
    setBulkActive(false);
    setText("");
    setFileNames([]);
    resetResults();
    setPendingFiles(null);
    void clearSession().finally(() => {
      skipSave.current = false;
    });
  };

  const attachFileSource = (value: string, names: string[]) => {
    bulkRef.current = value;
    setFileNames(names);
  };

  const loadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    try {
      const { text: next, names } = await readSourceFiles(files, setProgress);
      attachFileSource(next, names);
      resetResults();
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file. Try .txt, .csv, .pdf, or .docx.");
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const requestIncoming = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (hasSource) {
      setPendingFiles(files);
      return;
    }
    void loadFiles(files);
  };

  const run = async () => {
    if (mode === "stores") {
      storesRunRef.current();
      return;
    }
    const source = sourceText();
    if (!source.trim()) {
      toast.error("Paste text or drop a file first");
      return;
    }
    setProcessing(true);
    setProgress(0);
    const start = performance.now();
    try {
      if (mode === "urls") {
        const found = await extractUrlsJob(source, unique, setProgress);
        setUrls(found.urls);
        setExtracted((prev) => ({ ...prev, urls: true }));
        const ms = Math.round(performance.now() - start);
        if (found.urls.length === 0) toast.info("No URLs found");
        else toast.success(`${found.urls.length.toLocaleString()} URL(s) in ${ms}ms`);
        return;
      }
      if (mode === "clean") {
        const result = await dedupeJob(source, setProgress);
        setCleaned(result.unique);
        setDupStats({ total: result.total, removed: result.removed });
        setExtracted((prev) => ({ ...prev, clean: true }));
        toast.success(`Removed ${result.removed.toLocaleString()} duplicate(s)`);
        return;
      }
      if (mode === "segment") {
        const result = await linesJob(source, setProgress);
        const pieces = chunkList(result.lines, chunkSize);
        setSegments(pieces);
        setExtracted((prev) => ({ ...prev, segment: true }));
        toast.success(`${result.lines.length.toLocaleString()} lines → ${pieces.length} segment(s)`);
        return;
      }
      const found = await extractEmailsJob(source, unique, setProgress);
      setPersonal(found.personal);
      setDomain(found.domain);
      setBucket(found.personal.length > 0 ? "personal" : "domain");
      setExtracted((prev) => ({ ...prev, emails: true }));
      const ms = Math.round(performance.now() - start);
      if (found.emails.length === 0) toast.info("No email addresses found");
      else toast.success(`${found.emails.length.toLocaleString()} email(s) in ${ms}ms`);
    } catch (err) {
      console.error(err);
      toast.error("That file was too heavy or invalid. Try a smaller slice, or download instead of copy.");
    } finally {
      setProcessing(false);
      setProgress(100);
    }
  };

  runRef.current = run;

  useEffect(() => {
    let cancelled = false;
    void loadSession().then((session) => {
      if (cancelled) return;
      if (session && !isSessionEmpty(session)) {
        if (session.fileNames.length > 0) {
          bulkRef.current = session.source;
          setBulkActive(false);
          setText("");
        } else {
          bulkRef.current = session.source.length > LARGE_INPUT_THRESHOLD ? session.source : null;
          setBulkActive(session.source.length > LARGE_INPUT_THRESHOLD);
          setText(session.source.length > LARGE_INPUT_THRESHOLD ? previewSource(session.source) : session.source);
        }
        setFileNames(session.fileNames);
        setUnique(session.unique);
        setPersonalFilter(session.personalFilter);
        setChunkSize(session.chunkSize);
        setExtracted({ ...emptyExtracted(), ...(session.extracted ?? {}) });
        setPersonal(session.personal);
        setDomain(session.domain);
        setUrls(session.urls);
        setCleaned(session.cleaned);
        setDupStats(session.dupStats);
        setSegments(session.segments);
        setBucket(session.bucket);
        if (!window.location.hash) setMode(session.mode);
      }
      skipSave.current = false;
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyDocumentSeo(mode);
    const next = hashForMode(mode);
    if (window.location.hash.replace(/^#/, "") !== next) {
      history.replaceState(null, "", `#${next}`);
    }
  }, [mode]);

  useEffect(() => {
    const onHash = () => {
      const next = modeFromHash();
      setMode((current) => (current === next ? current : next));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!hydrated || skipSave.current) return;
    const session = snapshot();
    const timer = window.setTimeout(() => {
      void persist(session);
    }, 400);
    return () => window.clearTimeout(timer);
    // snapshot is rebuilt each render; persist the latest fields below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    mode,
    text,
    bulkActive,
    fileNames,
    unique,
    personalFilter,
    chunkSize,
    extracted,
    personal,
    domain,
    urls,
    cleaned,
    dupStats,
    segments,
    bucket,
  ]);

  useEffect(() => {
    const flush = () => {
      if (skipSave.current || !sessionRef.current) return;
      void persist(sessionRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const filteredPersonal = useMemo(
    () => filterPersonal(personal, personalFilter),
    [personal, personalFilter],
  );

  const personalLabel =
    personalFilter === "gmail"
      ? "Personal (Gmail only)"
      : personalFilter === "yahoo"
        ? "Personal (Yahoo)"
        : personalFilter === "outlook"
          ? "Personal (Outlook)"
          : "Personal emails";

  const action = ACTIONS[mode];
  const drop = hasSource
    ? {
        title: "Drop a new file to replace this list",
        subtitle: "The new file replaces what is here. It is not added on top.",
      }
    : DROP_COPY[mode];
  const visibleSegments = segments.slice(0, 40);

  if (!hydrated) {
    return (
      <section id="tool" className="gmail-card-static min-h-[12rem] p-6" aria-busy="true" />
    );
  }

  if (mode === "stores") {
    return (
      <section id="tool" className="gmail-card-static space-y-4 p-3.5 sm:space-y-5 sm:p-6">
        <ModeSwitcher value={mode} onChange={setMode} />
        <ToolIntro mode={mode} />
        <StoresTool runRef={storesRunRef} />
      </section>
    );
  }

  return (
    <section id="tool" className="gmail-card-static space-y-4 p-3.5 sm:space-y-5 sm:p-6">
      <ModeSwitcher value={mode} onChange={setMode} />
      <ToolIntro mode={mode} />

      {pendingFiles && (
        <ReplaceConfirm
          names={pendingFiles.map((file) => file.name)}
          onReplace={() => {
            const files = pendingFiles;
            setPendingFiles(null);
            void loadFiles(files);
          }}
          onKeep={() => setPendingFiles(null)}
        />
      )}

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-4 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border/80 bg-muted/10",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          requestIncoming(e.dataTransfer.files);
        }}
      >
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
            <i className="ri-upload-2-line text-lg" aria-hidden />
          </span>
          <span className="text-sm font-medium text-foreground">{drop.title}</span>
          <span className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">{drop.subtitle}</span>
          <Input
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) requestIncoming(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {fileNames.length > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{fileNames.join(", ")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Textarea
          className="min-h-[140px] bg-card font-mono text-[12px] font-normal leading-5 dark:bg-card"
          placeholder={PLACEHOLDERS[mode]}
          value={text}
          readOnly={bulkActive}
          onChange={(e) => {
            setFileNames([]);
            setSource(e.target.value);
            resetResults();
          }}
          aria-label="Paste text"
        />
        {bulkActive && (
          <p className="text-xs text-muted-foreground">
            Full paste is kept for extraction. The box is a preview so a second paste cannot mix into it.
          </p>
        )}
      </div>

      {mode === "emails" && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Personal filter</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("field-chip", unique && "field-chip-active")}
              aria-pressed={unique}
              onClick={() => setUnique((v) => !v)}
            >
              Unique
            </button>
            {(
              [
                ["all", "All personal"],
                ["gmail", "Gmail only"],
                ["yahoo", "Yahoo"],
                ["outlook", "Outlook"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn("field-chip", personalFilter === id && "field-chip-active")}
                aria-pressed={personalFilter === id}
                onClick={() => setPersonalFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex w-full flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
            Emails per result chunk
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              className="h-11 w-full sm:h-9 sm:w-28"
              value={chunkSize}
              onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || DEFAULT_CHUNK_SIZE))}
            />
          </label>
        </div>
      )}

      {mode === "urls" && (
        <button
          type="button"
          className={cn("field-chip", unique && "field-chip-active")}
          aria-pressed={unique}
          onClick={() => setUnique((v) => !v)}
        >
          Unique URLs
        </button>
      )}

      {mode === "segment" && (
        <label className="flex w-full flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
          Emails per segment
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            className="h-11 w-full sm:h-9 sm:w-28"
            value={chunkSize}
            onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || DEFAULT_CHUNK_SIZE))}
          />
        </label>
      )}

      <div className="flex gap-2">
        <Button className="gmail-btn min-w-0 flex-1" onClick={() => void run()} disabled={processing}>
          {processing ? (
            <>
              <i className="ri-loader-4-line animate-spin" aria-hidden />
              {action.busy}
            </>
          ) : (
            <>
              <i className={action.icon} aria-hidden />
              {action.idle}
            </>
          )}
        </Button>
        {hasSource && (
          <Button type="button" variant="outline" className="h-11 shrink-0 rounded-full px-4 sm:w-28" onClick={clear} disabled={processing}>
            Clear
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5">Ctrl</kbd>
          {" + "}
          <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5">Enter</kbd>
          {" to run. "}
        </span>
        New files replace, they do not merge.
      </p>

      {processing && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-loader-4-line animate-spin text-live" aria-hidden />
              Working in the background so the page stays usable…
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {done && !processing && mode === "emails" && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("field-chip", bucket === "personal" && "field-chip-active")}
              onClick={() => setBucket("personal")}
            >
              Personal ({filteredPersonal.length.toLocaleString()})
            </button>
            <button
              type="button"
              className={cn("field-chip", bucket === "domain" && "field-chip-active")}
              onClick={() => setBucket("domain")}
            >
              Business / other ({domain.length.toLocaleString()})
            </button>
          </div>
          {bucket === "personal" ? (
            <ResultPane
              title={personalLabel}
              lines={filteredPersonal}
              fileSlug={personalFilter === "gmail" ? "gmail_emails" : "personal_emails"}
              chunkSize={chunkSize}
              csvColumn="email"
            />
          ) : (
            <ResultPane
              title="Business / other emails"
              lines={domain}
              fileSlug="domain_emails"
              chunkSize={chunkSize}
              csvColumn="email"
            />
          )}
        </div>
      )}

      {done && !processing && mode === "urls" && (
        <ResultPane title="URLs" lines={urls} fileSlug="extracted_urls" chunkSize={chunkSize} csvColumn="url" />
      )}

      {done && !processing && mode === "clean" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {dupStats.total.toLocaleString()} lines in → {cleaned.length.toLocaleString()} unique. Removed{" "}
            {dupStats.removed.toLocaleString()} duplicate(s).
          </p>
          <ResultPane title="Cleaned list" lines={cleaned} fileSlug="cleaned_list" chunkSize={chunkSize} />
        </div>
      )}

      {done && !processing && mode === "segment" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {segments.reduce((n, s) => n + s.length, 0).toLocaleString()} lines in {segments.length} segment(s).
          </p>
          {visibleSegments.map((seg, i) => (
            <ResultPane
              key={i}
              title={`Segment ${i + 1}`}
              lines={seg}
              fileSlug={`segment_${i + 1}`}
              chunkSize={seg.length || 1}
            />
          ))}
          {segments.length > visibleSegments.length && (
            <p className="text-center text-xs text-muted-foreground">
              Showing the first {visibleSegments.length} segments. Download each piece from the buttons above, or
              raise emails per segment.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
