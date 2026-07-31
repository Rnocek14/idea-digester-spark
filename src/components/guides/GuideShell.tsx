import { usePageView } from "@/lib/trackStoryEvent";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonLd";

export type GuideSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

export type RelatedGuide = {
  title: string;
  path: string;
  blurb: string;
};

export type GuideFAQ = {
  question: string;
  answer: string;
};

export type GuideShellProps = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  path: string;
  intro: ReactNode;
  sections: GuideSection[];
  related?: RelatedGuide[];
  faqs?: GuideFAQ[];
  datePublished?: string;
  dateModified?: string;
  heroImage?: string;
  heroAlt?: string;
  heroCaption?: string;
  /** Slot rendered between the intro and the first section (e.g. live data widgets). */
  introExtra?: ReactNode;
  /** Slot rendered after all sections, before related guides. */
  bottomExtra?: ReactNode;
};

/**
 * Shared layout for cornerstone SEO guides. Handles head/JSON-LD,
 * breadcrumbs, a sticky TOC on desktop, related guides, and FAQ schema.
 *
 * Keep the prose voice warm and neighborly — never "our/us" branding,
 * never lead-magnet copy. Real-estate CTAs go through SoftRealEstateCTA.
 */
export function GuideShell({
  title,
  metaTitle,
  metaDescription,
  path,
  intro,
  sections,
  related,
  faqs,
  datePublished,
  dateModified,
  heroImage,
  heroAlt,
  heroCaption,
  introExtra,
  bottomExtra,
}: GuideShellProps) {
  // The guides are the entire SEO bet; until now nothing recorded whether a human
  // ever reached one. View plus read-through, so we can tell crawlers from readers.
  usePageView({ pillar: "other", entityType: "guide", slug: path });

  const jsonLd: Record<string, unknown>[] = [
    articleJsonLd({
      title: metaTitle,
      description: metaDescription,
      path,
      datePublished,
      dateModified,
      image: heroImage,
    }),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: title, path },
    ]),
  ];
  if (faqs && faqs.length > 0) jsonLd.push(faqJsonLd(faqs));

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title={metaTitle}
        description={metaDescription}
        path={path}
        ogType="article"
        ogImage={heroImage}
        jsonLd={jsonLd}
      />
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-blue-700">Home</Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-700">Guides</span>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-900">{title}</span>
        </nav>

        {/* Title block */}
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          {dateModified && (
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mt-3">
              Updated{" "}
              {new Date(dateModified).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · The Brief Editors
            </p>
          )}
        </header>

        {/* Hero image (optional). Real photos preferred over AI illustration. */}
        {heroImage && (
          <figure className="mb-8 overflow-hidden rounded-md border border-slate-200 bg-white">
            <img
              src={heroImage}
              alt={heroAlt || title}
              className="w-full max-h-[420px] object-cover"
              loading="eager"
            />
            {heroCaption && (
              <figcaption className="px-4 py-2 text-xs text-slate-500 italic border-t border-slate-100">
                {heroCaption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Two-column layout: TOC sidebar on desktop, prose main */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10">
          <article className="min-w-0">
            {/* Intro */}
            <div className="guide-prose max-w-none text-slate-700 leading-relaxed text-lg">
              {intro}
            </div>

            {introExtra && <div className="mt-8">{introExtra}</div>}

            {/* Sections */}
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
                <h2 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
                  {s.heading}
                </h2>
                <div className="guide-prose max-w-none text-slate-700 leading-relaxed">
                  {s.body}
                </div>
              </section>
            ))}

            {/* FAQs (rendered + JSON-LD via faqs prop) */}
            {faqs && faqs.length > 0 && (
              <section id="faqs" className="mt-12 scroll-mt-24">
                <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
                  Common questions
                </h2>
                <dl className="space-y-5">
                  {faqs.map((q) => (
                    <div key={q.question}>
                      <dt className="font-semibold text-slate-900">{q.question}</dt>
                      <dd className="text-slate-700 mt-1 leading-relaxed">{q.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {bottomExtra && <div className="mt-10">{bottomExtra}</div>}

            {/* Related guides */}
            {related && related.length > 0 && (
              <section className="mt-12 pt-8 border-t border-slate-200">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
                  Keep reading
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {related.map((r) => (
                    <Link
                      key={r.path}
                      to={r.path}
                      className="block rounded-md border border-slate-200 bg-white p-4 hover:border-blue-500 hover:shadow-sm transition-all"
                    >
                      <p className="font-display text-lg text-slate-900">{r.title}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{r.blurb}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* TOC sidebar — desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
                On this page
              </p>
              <nav>
                <ul className="space-y-2 text-sm">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="text-slate-600 hover:text-blue-700 leading-snug block"
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                  {faqs && faqs.length > 0 && (
                    <li>
                      <a href="#faqs" className="text-slate-600 hover:text-blue-700 leading-snug block">
                        Common questions
                      </a>
                    </li>
                  )}
                </ul>
              </nav>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}