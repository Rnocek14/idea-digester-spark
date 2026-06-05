import { Link } from "react-router-dom";

/**
 * Soft, editorial real-estate CTA. Never a lead-magnet form.
 * Used at the bottom of resident-intent guides.
 */
type Variant = "neighborhoods" | "housing" | "market";

const COPY: Record<Variant, { headline: string; body: string; cta: string; to: string }> = {
  neighborhoods: {
    headline: "Thinking about living here?",
    body: "Every shoreline town around Geneva Lake has its own rhythm. Our neighborhood guide walks through Lake Geneva, Fontana, Williams Bay and Genoa City — what they feel like, who lives there, and what changes through the year.",
    cta: "Explore the neighborhoods",
    to: "/guides/lake-geneva-neighborhoods",
  },
  housing: {
    headline: "Curious what life here is really like?",
    body: "If you're starting to picture yourself here, our local housing guide is a good next read. No forms, no pressure — just an honest look at the market from people who live in it.",
    cta: "Read the housing guide",
    to: "/selling-lake-geneva",
  },
  market: {
    headline: "Wondering what your place is worth?",
    body: "Gina Nocek has helped families buy and sell around Geneva Lake for years. When you're ready for a real conversation — not a form — start here.",
    cta: "Talk with Gina",
    to: "/selling-lake-geneva",
  },
};

export function SoftRealEstateCTA({ variant = "neighborhoods" }: { variant?: Variant }) {
  const { headline, body, cta, to } = COPY[variant];
  return (
    <aside className="mt-12 rounded-md border border-slate-200 bg-stone-50 p-6 sm:p-8">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        From the editors
      </p>
      <h3 className="font-display text-2xl text-slate-900 mt-2">{headline}</h3>
      <p className="text-slate-700 mt-3 leading-relaxed">{body}</p>
      <Link
        to={to}
        className="inline-block mt-4 text-sm font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
      >
        {cta} →
      </Link>
    </aside>
  );
}