import { FAQS } from "@/lib/seo";

export function SiteFaq() {
  return (
    <details id="faq" className="group rounded-2xl border border-border/60 bg-card/80">
      <summary className="cursor-pointer list-none px-3 py-2.5 sm:px-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span id="faq-heading" className="text-sm font-semibold tracking-tight text-foreground">
            Common questions
          </span>
          <i className="ri-arrow-down-s-line text-muted-foreground transition group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="divide-y divide-border/70 border-t border-border/60">
        {FAQS.map((item) => (
          <details key={item.q} className="group/q px-3 py-3 sm:px-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-left leading-snug">{item.q}</span>
                <i className="ri-add-line mt-0.5 shrink-0 text-muted-foreground transition group-open/q:rotate-45" aria-hidden />
              </span>
            </summary>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </details>
  );
}
