import { toast } from "sonner";
import { downloadLinesAsFile, linesUnsuitableForClipboard, toCsvLines } from "@/lib/extract";

export async function copyLines(lines: string[], label: string) {
  if (lines.length === 0) {
    toast.error("Nothing to copy");
    return;
  }
  if (linesUnsuitableForClipboard(lines)) {
    toast.error("List is too large for the clipboard. Use Download instead.");
    return;
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(label);
  } catch {
    toast.error("Could not copy. Use Download instead.");
  }
}

export function downloadTxt(lines: string[], filename: string) {
  if (lines.length === 0) {
    toast.error("Nothing to download");
    return;
  }
  downloadLinesAsFile(lines, filename);
  toast.success("Download started");
}

export function downloadCsv(lines: string[], filename: string, column = "value") {
  if (lines.length === 0) {
    toast.error("Nothing to download");
    return;
  }
  downloadLinesAsFile(toCsvLines(lines, column), filename, "text/csv");
  toast.success("CSV download started");
}
