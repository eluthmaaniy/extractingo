export type WorkspaceMode = "emails" | "urls" | "clean" | "segment";

const TABS: { id: WorkspaceMode; icon: string; label: string; hint: string }[] = [
  { id: "emails", icon: "ri-mail-line", label: "Emails", hint: "Extract and separate addresses" },
  { id: "urls", icon: "ri-links-line", label: "URLs", hint: "Keep only clean http(s) links" },
  { id: "clean", icon: "ri-delete-bin-line", label: "Clean", hint: "Remove duplicate lines" },
  { id: "segment", icon: "ri-scissors-line", label: "Split", hint: "Cut a list into segments" },
];

export function ModeSwitcher({
  value,
  onChange,
}: {
  value: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  const active = Math.max(0, TABS.findIndex((tab) => tab.id === value));

  return (
    <div
      className="relative flex w-full items-center rounded-full border border-border/60 bg-muted/35 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
      role="tablist"
      aria-label="Choose a tool"
    >
      <span
        className="pointer-events-none absolute top-1 bottom-1 rounded-full border border-white/15 bg-card shadow-md transition-[left] duration-150 ease-out dark:border-white/20 dark:bg-white/15"
        style={{
          width: "calc((100% - 8px) / 4)",
          left: `calc(4px + ${active} * (100% - 8px) / 4)`,
        }}
        aria-hidden
      />
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
            className={`relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-0.5 py-2.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:text-sm ${
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground/90"
            }`}
            onClick={() => onChange(tab.id)}
          >
            <i className={tab.icon} aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
