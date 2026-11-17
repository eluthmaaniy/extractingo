import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Workspace } from "@/components/Workspace";
import { Toaster } from "@/components/ui/sonner";
import { applyTheme, readStoredTheme, type Theme } from "@/lib/theme";

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
      <main className="container mx-auto px-4 py-4 sm:px-5 md:py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          <Workspace />
          <p className="px-1 pb-6 text-center text-xs text-muted-foreground">
            Free and local. Lists never leave this browser.
          </p>
        </div>
      </main>
      <Toaster theme={theme} />
    </div>
  );
}
