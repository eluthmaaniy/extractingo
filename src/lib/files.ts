import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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

async function extractFromPdf(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n");
}

async function extractFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

export async function readSourceFile(file: File): Promise<string> {
  const ext = extOf(file.name);
  const type = file.type;
  if (ext === ".pdf" || type === "application/pdf") return extractFromPdf(file);
  if (
    ext === ".docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractFromDocx(file);
  }
  return readFileAsText(file);
}

export async function readSourceFiles(files: File[]): Promise<{ text: string; names: string[] }> {
  const parts: string[] = [];
  const names: string[] = [];
  for (const file of files) {
    names.push(file.name);
    const text = await readSourceFile(file);
    if (text) parts.push(text);
  }
  return { text: parts.join("\n"), names };
}
