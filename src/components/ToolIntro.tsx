import type { WorkspaceMode } from "@/components/ModeSwitcher";

const COPY: Record<
  WorkspaceMode,
  { title: string; tagline: string; steps: string[]; hint: string }
> = {
  emails: {
    title: "Email extractor & separator",
    tagline: "Finds every address in the paste or file, then splits personal inboxes from company domains.",
    steps: ["Paste text, or drop a file", "Pick a personal filter", "Extract, then copy from results"],
    hint: "Unique drops repeats. The personal filter only changes the Personal bucket after you extract.",
  },
  urls: {
    title: "URL extractor",
    tagline: "Keeps only the URL itself — no nearby words, punctuation, or page copy.",
    steps: ["Paste or drop a file with links", "Extract URLs", "Copy or download the clean list"],
    hint: "Only http and https links are kept. Unique URLs removes repeats.",
  },
  clean: {
    title: "Duplicate remover",
    tagline: "One item per line. Exact duplicates are dropped, ignoring case, and you see how many were removed.",
    steps: ["Paste a finished list", "Remove duplicates", "Download the cleaned file"],
    hint: "Use this after extract if you already have a list and only need uniqueness.",
  },
  segment: {
    title: "List splitter",
    tagline: "Cuts a finished list into equal pieces so you can copy or send in batches.",
    steps: ["Paste one email per line", "Set emails per segment", "Split, then download all or each piece"],
    hint: "This does not extract emails. Paste a list that is already clean.",
  },
  stores: {
    title: "Store policy emails",
    tagline: "Paste Shopify store URLs. Extractingo reads each privacy policy and lists the contact emails.",
    steps: ["Drop or paste store URLs", "Find emails", "Copy or download the list"],
    hint: "Shopify stores only. A long list stays on one progress line. The policy text is not kept.",
  },
};

export function ToolIntro({ mode }: { mode: WorkspaceMode }) {
  const copy = COPY[mode];
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold tracking-[-0.016em] text-foreground">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.tagline}</p>
      </div>
      <ol className="flex max-w-full flex-wrap gap-2">
        {copy.steps.map((step, index) => (
          <li
            key={step}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs leading-snug text-muted-foreground"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.hint}</p>
    </div>
  );
}
