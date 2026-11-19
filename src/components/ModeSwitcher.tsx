export type WorkspaceMode = "emails" | "urls" | "clean" | "segment" | "stores";

const TABS: { id: WorkspaceMode; icon: string; label: string; hint: string }[] = [
  { id: "emails", icon: "ri-mail-line", label: "Emails", hint: "Extract and separate addresses" },
  { id: "urls", icon: "ri-links-line", label: "URLs", hint: "Keep only clean http(s) links" },
  { id: "clean", icon: "ri-delete-bin-line", label: "Clean", hint: "Remove duplicate lines" },
  { id: "segment", icon: "ri-scissors-line", label: "Split", hint: "Cut a list into segments" },
  { id: "stores", icon: "ri-store-2-line", label: "Stores", hint: "Read privacy-policy emails from Shopify stores" },
];

export function ModeSwitcher({
  value,
  onChange,
}: {
  value: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  return (
    <div
      className="flex w-full items-center overflow-x-auto rounded-full border border-border/60 bg-muted/35 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
      role="tablist"
      aria-label="Choose a tool"
    >
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={tab.hint}
            aria-label={`${tab.label}: ${tab.hint}`}
            className={`flex min-h-11 min-w-0 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-[11px] font-semibold transition-colors min-[400px]:text-xs sm:flex-1 sm:gap-1.5 sm:px-0.5 sm:text-sm ${
              selected
                ? "bg-card text-foreground shadow-md dark:bg-white/15"
                : "text-muted-foreground hover:text-foreground/90"
            }`}
            onClick={() => onChange(tab.id)}
          >
            <i className={`${tab.icon} hidden min-[360px]:inline`} aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
