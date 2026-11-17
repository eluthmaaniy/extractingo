import { SCOUTIER_LOGO_URL, SCOUTIER_SITE_URL } from "@/lib/brand";
import { THEME_ICON, THEME_LABEL, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function Header({
  preference,
  onCycleTheme,
}: {
  preference: ThemePreference;
  onCycleTheme: () => void;
}) {
  return (
    <header className="relative z-[45] border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={SCOUTIER_LOGO_URL} alt="" className="h-6 w-6 shrink-0" width={24} height={24} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-none tracking-tight text-foreground">Extractingo</p>
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
          aria-label={`${THEME_LABEL[preference]}. Cycle light, dark, or system.`}
          title={`${THEME_LABEL[preference]} — click to cycle`}
          onClick={onCycleTheme}
          className="h-11 w-11"
        >
          <i className={`${THEME_ICON[preference]} text-xl`} aria-hidden />
        </Button>
      </div>
    </header>
  );
}
