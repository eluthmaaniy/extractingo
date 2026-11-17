import { SCOUTIER_LOGO_URL, SCOUTIER_SITE_URL } from "@/lib/brand";
import type { Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function Header({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="relative z-[45] border-b border-border/60 bg-card/95 px-5 py-3.5 backdrop-blur-sm md:px-6 md:py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={SCOUTIER_LOGO_URL} alt="" className="h-6 w-6 shrink-0" width={24} height={24} />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold leading-none tracking-tight text-foreground">Extractingo</p>
            <a
              href={SCOUTIER_SITE_URL}
              className="mt-1 inline-flex items-center text-[11px] font-medium text-success hover:underline"
            >
              A Scoutier product
            </a>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onToggleTheme}
          className="h-11 w-11"
        >
          <i className={theme === "dark" ? "ri-sun-line text-xl" : "ri-moon-line text-xl"} aria-hidden />
        </Button>
      </div>
    </header>
  );
}
