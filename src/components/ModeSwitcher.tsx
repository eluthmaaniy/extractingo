export type WorkspaceMode = "emails" | "urls";

export function ModeSwitcher({
  value,
  onChange,
}: {
  value: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  const isEmails = value === "emails";

  return (
    <div
      className="relative flex w-full items-center rounded-full border border-border/60 bg-muted/35 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
      role="tablist"
      aria-label="Extractor mode"
    >
      <span
        className="pointer-events-none absolute top-1 bottom-1 rounded-full border border-white/15 bg-card shadow-md transition-transform duration-150 ease-out dark:border-white/20 dark:bg-white/15"
        style={{
          width: "calc(50% - 4px)",
          left: "4px",
          transform: isEmails ? "translateX(0)" : "translateX(100%)",
        }}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={isEmails}
        className={`relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 py-2.5 text-sm font-semibold transition-colors ${
          isEmails ? "text-foreground" : "text-muted-foreground hover:text-foreground/90"
        }`}
        onClick={() => onChange("emails")}
      >
        <i className="ri-mail-line" aria-hidden />
        Emails
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!isEmails}
        className={`relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 py-2.5 text-sm font-semibold transition-colors ${
          !isEmails ? "text-foreground" : "text-muted-foreground hover:text-foreground/90"
        }`}
        onClick={() => onChange("urls")}
      >
        <i className="ri-links-line" aria-hidden />
        URLs
      </button>
    </div>
  );
}
