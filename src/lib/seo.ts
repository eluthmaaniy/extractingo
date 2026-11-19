import type { WorkspaceMode } from "@/components/ModeSwitcher";
import { EXTRACTINGO_SITE_URL, SCOUTIER_LOGO_URL, SCOUTIER_SITE_URL } from "@/lib/brand";

export const SITE_NAME = "Extractingo";
export const DEFAULT_TITLE = "Free Email Extractor, Duplicate Remover & URL Extractor | Extractingo";
export const DEFAULT_DESCRIPTION =
  "Extract emails and URLs from text, CSV, or PDF. Separate Gmail from business domains, remove duplicates, and split large lists. Free, in your browser — nothing is uploaded.";

export const SITE_KEYWORDS = [
  "email extractor",
  "extract emails from pdf",
  "extract emails from text",
  "extract emails from csv",
  "extract emails from word",
  "free email extractor",
  "email list cleaner",
  "remove duplicate emails",
  "dedupe email list",
  "split email list",
  "email segmentation",
  "gmail extractor",
  "separate gmail from business emails",
  "personal vs business email",
  "url extractor",
  "extract urls from text",
  "clean url list",
  "bulk email list tool",
  "outreach list cleaner",
  "lead list cleaner",
  "crm email import",
  "large email list",
].join(", ");

export const TOOL_SEO: Record<WorkspaceMode, { title: string; description: string; hash: string }> = {
  emails: {
    title: "Email Extractor & Separator — Gmail vs Business | Extractingo",
    description:
      "Extract email addresses from text, CSV, or PDF and separate personal inboxes (Gmail, Yahoo, Outlook) from business domains. Free, local, no sign-up.",
    hash: "emails",
  },
  urls: {
    title: "URL Extractor — Clean Links From Any Text or File | Extractingo",
    description:
      "Pull only the URL itself from messy text, crawls, or documents. No nearby words. Free in-browser URL extractor for large files.",
    hash: "urls",
  },
  clean: {
    title: "Remove Duplicate Emails From a List | Extractingo",
    description:
      "Drop a list, one email per line, and remove exact duplicates (case-insensitive). Download a cleaned file. Free, nothing uploaded.",
    hash: "clean",
  },
  segment: {
    title: "Split a Large Email List Into Segments | Extractingo",
    description:
      "Cut a finished email list into equal pieces by emails per segment. Copy or download each batch for outreach, CRM import, or sending tools.",
    hash: "split",
  },
  stores: {
    title: "Store Privacy Policy Email Finder | Extractingo",
    description:
      "Paste Shopify store URLs. Extractingo reads each public privacy policy in your browser and lists the contact emails. Nothing is uploaded.",
    hash: "stores",
  },
};

export const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I extract email addresses from a PDF or Word file?",
    a: "Drop a .pdf, .docx, .txt, or .csv onto Extractingo, or paste the text. The Emails tool finds every address in the file. Extraction runs in your browser — the file is not uploaded to a server.",
  },
  {
    q: "Does Extractingo upload my email list?",
    a: "No. Extractingo is a free, client-side tool. Lists, PDFs, and results stay in this browser until you clear them. There is no account and no server-side processing.",
  },
  {
    q: "Will I lose my list if I refresh or close the tab?",
    a: "No. The current list and results are saved in this browser so a refresh or sudden close does not wipe them. Use Clear or Remove to delete the saved list. If you drop a new file while one is already here, the new file replaces the old one — the two are not merged.",
  },
  {
    q: "How do I separate Gmail from business emails?",
    a: "Open Emails, extract, then use the Personal bucket. Choose Gmail only, Yahoo, Outlook, or all personal inboxes. Company domains land in Business / other.",
  },
  {
    q: "How do I remove duplicate emails from a list?",
    a: "Open Clean, paste one email per line, and run Remove duplicates. Matches are case-insensitive. Download the unique list as .txt or .csv.",
  },
  {
    q: "How do I split a large email list into smaller files?",
    a: "Open Split, paste a finished list (one email per line), set emails per segment, and run Split list. Copy or download each segment for outreach, CRM import, or sending tools.",
  },
  {
    q: "Can I extract URLs from messy text?",
    a: "Yes. The URLs tool keeps only the http(s) link itself — no surrounding words or punctuation. It is built for large pastes, crawls, and documents.",
  },
  {
    q: "Who is Extractingo for?",
    a: "Anyone who works with large email or URL lists: outbound and lead generation, sales ops, virtual assistants, list brokers, researchers pulling contacts from documents, newsletter operators, recruiters, event teams, and people cleaning CRM imports. You do not need a Scoutier account.",
  },
  {
    q: "Is Extractingo free?",
    a: "Yes. Every tool is free: email extractor, URL extractor, duplicate remover, and list splitter. No sign-up.",
  },
  {
    q: "What files can I drop?",
    a: ".txt, .csv, .pdf, and .docx. Large files are read in the background so the page stays usable.",
  },
  {
    q: "How do I pull the contact email from a store privacy policy?",
    a: "Open Stores and paste Shopify store URLs, one per line. Find emails reads each store's public privacy policy in your browser and lists the addresses. You do not open the policy pages. Stores that are not on Shopify, or policies with no email address, are marked on that row. Nothing is uploaded.",
  },
];

export function applyDocumentSeo(mode: WorkspaceMode) {
  const seo = TOOL_SEO[mode];
  document.title = seo.title;
  const desc = document.querySelector('meta[name="description"]');
  desc?.setAttribute("content", seo.description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  ogTitle?.setAttribute("content", seo.title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  ogDesc?.setAttribute("content", seo.description);
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  twitterTitle?.setAttribute("content", seo.title);
  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  twitterDesc?.setAttribute("content", seo.description);
}

export function modeFromHash(hash = window.location.hash): WorkspaceMode {
  const id = hash.replace(/^#/, "").toLowerCase();
  if (id === "urls" || id === "url") return "urls";
  if (id === "clean" || id === "duplicates" || id === "dedupe") return "clean";
  if (id === "split" || id === "segment" || id === "segmentation") return "segment";
  if (id === "stores" || id === "store" || id === "policy" || id === "policies") return "stores";
  return "emails";
}

export function hashForMode(mode: WorkspaceMode): string {
  return TOOL_SEO[mode].hash;
}

export function buildJsonLd() {
  const faqEntities = FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${EXTRACTINGO_SITE_URL}/#website`,
        url: EXTRACTINGO_SITE_URL,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SCOUTIER_SITE_URL}/#organization` },
      },
      {
        "@type": ["WebApplication", "SoftwareApplication"],
        "@id": `${EXTRACTINGO_SITE_URL}/#app`,
        name: SITE_NAME,
        url: EXTRACTINGO_SITE_URL,
        image: SCOUTIER_LOGO_URL,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Email list extractor and cleaner",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Extract email addresses from text, CSV, PDF, and Word",
          "Separate Gmail, Yahoo, and Outlook from business domains",
          "Extract clean http(s) URLs with no surrounding words",
          "Remove duplicate emails from a list",
          "Split large email lists into segments",
          "Read contact emails from a public store privacy policy",
          "Copy or download results as TXT or CSV",
          "Runs entirely in the browser — lists are not uploaded",
        ],
        audience: {
          "@type": "Audience",
          audienceType:
            "Outbound teams, lead generation, sales ops, virtual assistants, researchers, recruiters, newsletter operators, and anyone cleaning large email or URL lists",
        },
        publisher: { "@id": `${SCOUTIER_SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SCOUTIER_SITE_URL}/#organization`,
        name: "Scoutier",
        url: SCOUTIER_SITE_URL,
        logo: SCOUTIER_LOGO_URL,
      },
      {
        "@type": "FAQPage",
        "@id": `${EXTRACTINGO_SITE_URL}/#faq`,
        mainEntity: faqEntities,
      },
      {
        "@type": "HowTo",
        name: "How to extract emails from a PDF or text file",
        description: "Extract email addresses in the browser with Extractingo, then separate personal inboxes from business domains.",
        totalTime: "PT1M",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Paste or drop a file",
            text: "Paste mixed text or drop a .txt, .csv, .pdf, or .docx file. Nothing is uploaded.",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Choose a personal filter",
            text: "Keep all personal inboxes, or limit the Personal bucket to Gmail, Yahoo, or Outlook.",
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Extract and export",
            text: "Run Extract emails, then copy or download personal and business lists as .txt or .csv.",
          },
        ],
      },
    ],
  };
}
