import { COPYRIGHT_NAME, copyrightYear, SCOUTIER_SITE_URL } from "@/lib/brand";

export function SiteFooter() {
  const year = copyrightYear();
  return (
    <footer className="border-t border-border/60 bg-card/60 px-4 py-6 sm:px-5 md:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl space-y-3 text-center">
        <p className="text-sm text-foreground">
          © {year} {COPYRIGHT_NAME}. All rights reserved.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A{" "}
          <a href={SCOUTIER_SITE_URL} className="font-medium text-success hover:underline">
            Scoutier
          </a>{" "}
          product. Free email extractor, URL extractor, duplicate remover, and list splitter — processed only in your
          browser.
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          <kbd className="rounded-md border border-border bg-muted/70 px-1.5 py-0.5">Ctrl</kbd>
          {" + "}
          <kbd className="rounded-md border border-border bg-muted/70 px-1.5 py-0.5">Enter</kbd>
          {" runs the current tool."}
        </p>
      </div>
    </footer>
  );
}
