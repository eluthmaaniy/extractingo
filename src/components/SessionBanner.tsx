import { formatSavedAgo } from "@/lib/session";
import { Button } from "@/components/ui/button";

export function SessionBanner({
  updatedAt,
  fileNames,
  onRemove,
}: {
  updatedAt: number;
  fileNames: string[];
  onRemove: () => void;
}) {
  const names = fileNames.length > 0 ? fileNames.join(", ") : "pasted text";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">Saved in this browser · {formatSavedAgo(updatedAt)}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {names}. New files replace this list — they are not merged. Nothing is uploaded.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full" onClick={onRemove}>
        <i className="ri-delete-bin-line" aria-hidden />
        Remove
      </Button>
    </div>
  );
}

export function ReplaceConfirm({
  names,
  onReplace,
  onKeep,
}: {
  names: string[];
  onReplace: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-live/40 bg-live/10 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Replace the current list?</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {names.join(", ")} will take its place. The two lists will not be combined, so you do not get mixed or
          duplicate jobs.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="gmail-btn h-9 px-4" onClick={onReplace}>
          Replace
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onKeep}>
          Keep current
        </Button>
      </div>
    </div>
  );
}
