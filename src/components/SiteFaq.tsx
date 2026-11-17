import { FAQS } from "@/lib/seo";

export function SiteFaq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="space-y-3 px-0.5 pb-2">
      <div>
        <h2 id="faq-heading" className="text-base font-semibold tracking-tight text-foreground">
          Common questions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Short answers. Open one if you need it.</p>
      </div>
      <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/60 bg-card/80">
        {FAQS.map((item) => (
          <details key={item.q} className="group px-3 py-3 sm:px-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-left leading-snug">{item.q}</span>
                <i className="ri-add-line mt-0.5 shrink-0 text-muted-foreground transition group-open:rotate-45" aria-hidden />
              </span>
            </summary>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
