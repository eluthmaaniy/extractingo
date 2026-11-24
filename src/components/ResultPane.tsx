import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_DISPLAY, chunkList, parseChunkSize } from "@/lib/extract";
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
  const size = parseChunkSize(chunkSize);
  const chunks = useMemo(() => chunkList(lines, size), [lines, size]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const safeIndex = Math.min(chunkIndex, Math.max(chunks.length - 1, 0));
  const active = chunks[safeIndex] ?? [];

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing here. Try another filter, or paste a different file.
      </div>
    );
  }

  const manyChunks = chunks.length > 1;

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
            All .txt
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(lines, `${fileSlug}.csv`, csvColumn)}>
            <i className="ri-file-excel-2-line" aria-hidden />
            All .csv
          </Button>
        </div>
      </div>

      {manyChunks && (
        <div className="space-y-2">
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
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => copyLines(active, `Chunk ${safeIndex + 1} copied`)}>
              Copy chunk
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTxt(active, `${fileSlug}_chunk_${safeIndex + 1}.txt`)}
            >
              <i className="ri-download-line" aria-hidden />
              Chunk .txt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(active, `${fileSlug}_chunk_${safeIndex + 1}.csv`, csvColumn)}
            >
              <i className="ri-file-excel-2-line" aria-hidden />
              Chunk .csv
            </Button>
          </div>
        </div>
      )}

      <ul className="max-h-[46vh] overflow-auto rounded-xl border border-border/70 bg-muted/40 font-mono text-xs leading-5 text-foreground">
        {(active.length ? active : lines).slice(0, MAX_DISPLAY).map((line, index) => (
          <li key={`${index}-${line}`} className="border-b border-border/50 px-3 py-1.5 break-all last:border-b-0">
            {line}
          </li>
        ))}
        {(active.length ? active : lines).length > MAX_DISPLAY && (
          <li className="px-3 py-2 text-muted-foreground">
            … and {((active.length ? active : lines).length - MAX_DISPLAY).toLocaleString()} more (use Download for the
            full list)
          </li>
        )}
      </ul>
    </div>
  );
}
