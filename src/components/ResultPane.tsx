import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_CHUNK_SIZE, chunkList, displayText } from "@/lib/extract";
import { copyLines, downloadCsv, downloadTxt } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function ResultPane({
  title,
  lines,
  fileSlug,
  chunkSize,
  csvColumn = "value",
}: {
  title: string;
  lines: string[];
  fileSlug: string;
  chunkSize: number;
  csvColumn?: string;
}) {
  const size = Math.max(1, chunkSize || DEFAULT_CHUNK_SIZE);
  const chunks = useMemo(() => chunkList(lines, size), [lines, size]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const active = chunks[Math.min(chunkIndex, Math.max(chunks.length - 1, 0))] ?? [];

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing here. Try another filter, or paste a different file.
      </div>
    );
  }

  const safeIndex = Math.min(chunkIndex, chunks.length - 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold tracking-tight">
          {title}{" "}
          <span className="font-medium text-muted-foreground">({lines.length.toLocaleString()})</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => copyLines(lines, `${title} copied`)}>
            <i className="ri-file-copy-line" aria-hidden />
            Copy all
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTxt(lines, `${fileSlug}.txt`)}>
            <i className="ri-download-line" aria-hidden />
            .txt
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(lines, `${fileSlug}.csv`, csvColumn)}>
            <i className="ri-file-excel-2-line" aria-hidden />
            .csv
          </Button>
        </div>
      </div>

      {chunks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Chunk {safeIndex + 1} of {chunks.length} ({active.length.toLocaleString()} in this chunk)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {chunks.slice(0, 24).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChunkIndex(i)}
                className={cn(
                  "field-chip",
                  i === safeIndex && "field-chip-active",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => copyLines(active, `Chunk ${safeIndex + 1} copied`)}>
            Copy chunk
          </Button>
        </div>
      )}

      <pre className="max-h-[46vh] overflow-auto rounded-xl border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-5 text-foreground">
        {displayText(active.length ? active : lines)}
      </pre>
    </div>
  );
}
