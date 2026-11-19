export const VISIBLE_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export type PolicyHit = { store: string; policyUrl: string; email: string };

/** Same order as the bookmarklet: mailto first, then addresses in the text, unique and sorted. */
export function emailsInText(text: string): string[] {
  const emails = new Set<string>();
  const mailto = /mailto:([^\s"'<>]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = mailto.exec(text)) !== null) {
    let raw = match[1].split("?")[0] ?? "";
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* keep the raw address */
    }
    const email = raw.trim();
    if (email.includes("@")) emails.add(email.toLowerCase());
  }
  const found = text.match(new RegExp(VISIBLE_EMAIL_REGEX.source, "g")) ?? [];
  for (const email of found) emails.add(email.toLowerCase());
  return [...emails].sort();
}

export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function policyHitsToCsv(hits: PolicyHit[]): string[] {
  return ["store,policy_url,email", ...hits.map((hit) => [hit.store, hit.policyUrl, hit.email].map(csvCell).join(","))];
}
