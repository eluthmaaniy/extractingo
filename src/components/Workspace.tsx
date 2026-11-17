import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ModeSwitcher, type WorkspaceMode } from "@/components/ModeSwitcher";
import { ResultPane } from "@/components/ResultPane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_CHUNK_SIZE,
  LARGE_INPUT_THRESHOLD,
  TEXTAREA_PREVIEW_CAP,
  extractEmailsChunked,
  extractUrlsChunked,
  filterPersonal,
  splitEmailsPersonalDomainChunked,
  type PersonalFilter,
} from "@/lib/extract";
import { ACCEPTED_EXTENSIONS, readSourceFiles } from "@/lib/files";
import { cn } from "@/lib/utils";

type EmailBucket = "personal" | "domain";

function previewSource(source: string, bulk: boolean): string {
  if (bulk || source.length > TEXTAREA_PREVIEW_CAP) {
    return (
      source.slice(0, 1000) +
      `\n\n… [${(source.length / 1024).toFixed(0)} KB loaded — click Extract]`
    );
  }
  return source;
}

export function Workspace() {
  const [mode, setMode] = useState<WorkspaceMode>("emails");
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
  const [extracted, setExtracted] = useState(false);
  const [personal, setPersonal] = useState<string[]>([]);
  const [domain, setDomain] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [bucket, setBucket] = useState<EmailBucket>("personal");

  const sourceText = () => bulkRef.current ?? text;

  const setSource = (value: string) => {
    if (value.length > LARGE_INPUT_THRESHOLD) {
      bulkRef.current = value;
      setBulkActive(true);
      setText(previewSource(value, true));
    } else {
      bulkRef.current = null;
      setBulkActive(false);
      setText(value);
    }
  };

  const loadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    toast.info(`Reading ${files.length === 1 ? files[0].name : `${files.length} files`}…`);
    try {
      const { text: next, names } = await readSourceFiles(files);
      setFileNames(names);
      setSource(next);
      setExtracted(false);
      toast.success(`Loaded ${(next.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file. Try .txt, .csv, .pdf, or .docx.");
    }
  };

  const extract = async () => {
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
        const found = await extractUrlsChunked(source, setProgress);
        setUrls(found);
        setPersonal([]);
        setDomain([]);
        setExtracted(true);
        const ms = Math.round(performance.now() - start);
        if (found.length === 0) toast.info("No URLs found");
        else toast.success(`${found.length.toLocaleString()} domain(s) in ${ms}ms`);
      } else {
        const emails = await extractEmailsChunked(source, unique, (pct) => setProgress(Math.round(pct * 0.7)));
        const split = await splitEmailsPersonalDomainChunked(emails);
        setPersonal(split.personal);
        setDomain(split.domain);
        setUrls([]);
        setBucket(split.personal.length > 0 ? "personal" : "domain");
        setExtracted(true);
        const ms = Math.round(performance.now() - start);
        if (emails.length === 0) toast.info("No email addresses found");
        else toast.success(`${emails.length.toLocaleString()} email(s) in ${ms}ms`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Extraction failed");
    } finally {
      setProcessing(false);
      setProgress(100);
    }
  };

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

  return (
    <div className="gmail-card-static space-y-5 p-4 sm:p-6">
      <ModeSwitcher value={mode} onChange={setMode} />

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
          void loadFiles(e.dataTransfer.files);
        }}
      >
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
            <i className="ri-upload-2-line text-lg" aria-hidden />
          </span>
          <span className="text-sm font-medium text-foreground">Drop files or click to browse</span>
          <span className="text-xs text-muted-foreground">.txt, .csv, .pdf, .docx</span>
          <Input
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void loadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {fileNames.length > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{fileNames.join(", ")}</p>
        )}
      </div>

      <Textarea
        className="min-h-[140px] bg-card font-mono text-xs dark:bg-card"
        placeholder={
          mode === "emails"
            ? "Or paste raw text or an email list…"
            : "Or paste text containing URLs…"
        }
        value={bulkActive ? text : text}
        onChange={(e) => {
          setFileNames([]);
          setSource(e.target.value);
          setExtracted(false);
        }}
      />

      {mode === "emails" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("field-chip", unique && "field-chip-active")}
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
                onClick={() => setPersonalFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Emails per chunk
            <Input
              type="number"
              min={1}
              className="h-9 w-28"
              value={chunkSize}
              onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || DEFAULT_CHUNK_SIZE))}
            />
          </label>
        </div>
      )}

      <Button className="gmail-btn w-full" onClick={() => void extract()} disabled={processing}>
        {processing ? (
          <>
            <i className="ri-loader-4-line animate-spin" aria-hidden />
            Extracting…
          </>
        ) : (
          <>
            <i className={mode === "emails" ? "ri-mail-open-line" : "ri-search-line"} aria-hidden />
            {mode === "emails" ? "Extract emails" : "Extract domains"}
          </>
        )}
      </Button>

      {processing && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-loader-4-line animate-spin text-live" aria-hidden />
              Working…
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {extracted && !processing && mode === "emails" && (
        <div className="space-y-4 pt-1">
          <div className="flex gap-2">
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
              Domain ({domain.length.toLocaleString()})
            </button>
          </div>
          {bucket === "personal" ? (
            <ResultPane
              title={personalLabel}
              lines={filteredPersonal}
              fileSlug={personalFilter === "gmail" ? "gmail_emails" : "personal_emails"}
              chunkSize={chunkSize}
            />
          ) : (
            <ResultPane title="Domain emails" lines={domain} fileSlug="domain_emails" chunkSize={chunkSize} />
          )}
        </div>
      )}

      {extracted && !processing && mode === "urls" && (
        <ResultPane title="Domains" lines={urls} fileSlug="extracted_urls" chunkSize={chunkSize} />
      )}
    </div>
  );
}
