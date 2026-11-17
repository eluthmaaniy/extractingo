import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { PageIntro } from "@/components/PageIntro";
import { SiteFaq } from "@/components/SiteFaq";
import { SiteFooter } from "@/components/SiteFooter";
import { Workspace } from "@/components/Workspace";
import { Toaster } from "@/components/ui/sonner";
import {
  applyTheme,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

export default function App() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : resolveTheme(readStoredPreference()),
  );

  useEffect(() => {
    setResolved(applyTheme(preference));
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <JsonLd />
      <a href="#tool" className="skip-link">
        Skip to tools
      </a>
      <Header preference={preference} onCycleTheme={() => setPreference((current) => nextPreference(current))} />
      <main className="container mx-auto px-4 py-5 sm:px-5 md:py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <PageIntro />
          <Workspace />
          <SiteFaq />
        </div>
      </main>
      <SiteFooter />
      <Toaster theme={resolved} />
    </div>
  );
}
