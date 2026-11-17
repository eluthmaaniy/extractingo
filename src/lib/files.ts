import { yieldToMain } from "@/lib/extract";

export const ACCEPTED_EXTENSIONS = ".txt,.csv,.pdf,.docx";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function extractFromPdf(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
    onProgress?.(Math.round((i / pdf.numPages) * 100));
    await yieldToMain();
  }
  return pages.join("\n");
}

async function extractFromDocx(file: File): Promise<string> {
  const mammothMod = await import("mammoth");
  const mammoth = mammothMod.default ?? mammothMod;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

export async function readSourceFile(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const ext = extOf(file.name);
  const type = file.type;
  if (ext === ".pdf" || type === "application/pdf") return extractFromPdf(file, onProgress);
  if (
    ext === ".docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractFromDocx(file);
  }
  return readFileAsText(file);
}

export async function readSourceFiles(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<{ text: string; names: string[] }> {
  const parts: string[] = [];
  const names: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    names.push(file.name);
    const text = await readSourceFile(file, (pct) => {
      onProgress?.(Math.round(((i + pct / 100) / files.length) * 100));
    });
    if (text) parts.push(text);
    await yieldToMain();
  }
  return { text: parts.join("\n"), names };
}
