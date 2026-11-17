import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";
import type { ResolvedTheme } from "@/lib/theme";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ theme }: { theme: ResolvedTheme }) {
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
          cancelButton: "group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground",
        },
      }}
    />
  );
}
