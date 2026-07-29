import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { PageMeta } from "@/components/PageMeta";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonLd";
import { Utensils, Coffee, ShoppingBag, Wrench, Waves, Music, Sparkles, ArrowRight } from "lucide-react";

const PATH = "/best-of/lake-geneva";
const TITLE = "Best of Lake Geneva 2025 — Locals' Picks for Dining, Shops & Services";
const META_DESC =
  "The Best of Lake Geneva, chosen by the people who actually live here. Community-nominated favorites for restaurants, coffee, shops, and local services around Geneva Lake.";

type Category = {
  key: string;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  status: "live" | "voting";
};

const CATEGORIES: Category[] = [
  {
    key: "restaurants",
    label: "Best Restaurants",
    blurb: "Where locals keep going back — from lakefront patios to hidden supper clubs.",
    icon: Utensils,
    href: "/best-of/restaurants-lake-geneva",
    status: "live",
  },
  {
    key: "coffee",
    label: "Best Coffee & Bakery",
    blurb: "Morning-ritual shops, pastry counters, and the espresso locals actually order.",
    icon: Coffee,
    status: "voting",
  },
  {
    key: "shops",
    label: "Best Local Shops",
    blurb: "Downtown boutiques, bookstores, and the small businesses worth a Saturday walk.",
    icon: ShoppingBag,
    status: "voting",
  },
  {
    key: "services",
    label: "Best Professional Services",
    blurb: "The dentist, mechanic, realtor, and contractor names that keep coming up.",
    icon: Wrench,
    status: "voting",
  },
  {
    key: "on-the-water",
    label: "Best On the Water",
    blurb: "Boat rentals, cruise lines, marinas, and the spots that make summer, summer.",
    icon: Waves,
    status: "voting",
  },
  {
    key: "live-music",
    label: "Best Live Music & Nightlife",
    blurb: "Patios with a band, dive bars with regulars, and the venues locals name-check.",
    icon: Music,
    status: "voting",
  },
];

const FAQS = [
  {
    question: "How are Best of Lake Geneva winners chosen?",
    answer:
      "Winners are chosen by locals — nominations come from readers of the Lake Geneva Brief, Local Love notes, and Community Voices essays. We don't rank by paid placement or advertising.",
  },
  {
    question: "When do the 2025 Best of Lake Geneva winners get announced?",
    answer:
      "Category winners are updated on a rolling basis as nominations come in. The full 2025 list is finalized in late fall each year, in time for holiday planning.",
  },
  {
    question: "Can I nominate my favorite Lake Geneva business?",
    answer:
      "Yes — send a note through the suggestion box or reply to any Lake Geneva Brief email. Tell us the business, the category, and why you keep going back.",
  },
];

export default function BestOfLakeGeneva() {
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Best of Lake Geneva", path: PATH },
    ]),
    faqJsonLd(FAQS),
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta title={TITLE} description={META_DESC} path={PATH} ogType="article" jsonLd={jsonLd} />
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-700">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">Best of Lake Geneva</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-1 rounded mb-3">
            <Sparkles className="h-3 w-3" /> Community picks · 2025
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-slate-900 tracking-tight mb-3">
            Best of Lake Geneva 2025
          </h1>
          <p className="text-lg text-slate-700 leading-relaxed">
            The Lake Geneva businesses that locals actually name-check — not a paid list, not a ranked
            top-25. Restaurants, coffee shops, boutiques, marinas, and the professional services
            neighbors keep recommending around Geneva Lake, Fontana, Williams Bay, Delavan, and
            Elkhorn.
          </p>
        </header>

        <section aria-labelledby="categories" className="mb-12">
          <h2 id="categories" className="font-display text-2xl text-slate-900 mb-4">
            Browse by category
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const inner = (
                <div className="h-full flex flex-col justify-between p-5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 text-slate-700" aria-hidden />
                      <h3 className="font-display text-lg text-slate-900">{c.label}</h3>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{c.blurb}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono uppercase tracking-wider">
                    {c.status === "live" ? (
                      <span className="text-emerald-700">See the picks</span>
                    ) : (
                      <span className="text-slate-500">Nominations open</span>
                    )}
                    {c.href && <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />}
                  </div>
                </div>
              );
              return (
                <li key={c.key}>
                  {c.href ? (
                    <Link to={c.href} className="block h-full">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how" className="mb-12 p-6 rounded-lg bg-white border border-slate-200">
          <h2 id="how" className="font-display text-2xl text-slate-900 mb-3">
            How the Best of Lake Geneva list works
          </h2>
          <p className="text-slate-700 leading-relaxed mb-3">
            Every business on this list gets here because locals told us about it. We watch Local
            Love notes, Community Voices essays, and the businesses that keep coming up in reader
            replies to the daily Brief. No paid placement, no vendor buy-in — just what the people
            who live here actually recommend.
          </p>
          <p className="text-slate-700 leading-relaxed">
            Have a favorite that isn't on here yet? Send us a note through the{" "}
            <Link to="/submit" className="text-brand-accent underline hover:no-underline">
              tip box
            </Link>{" "}
            or reply to any Brief email. We read every one.
          </p>
        </section>

        <section aria-labelledby="faq" className="mb-12">
          <h2 id="faq" className="font-display text-2xl text-slate-900 mb-4">
            Frequently asked
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <details key={f.question} className="p-4 rounded-lg bg-white border border-slate-200 group">
                <summary className="font-medium text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  {f.question}
                  <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-slate-700 leading-relaxed">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="related" className="mb-8">
          <h2 id="related" className="font-display text-2xl text-slate-900 mb-4">
            Keep exploring
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <li>
              <Link to="/guides/things-to-do-lake-geneva" className="text-brand-accent hover:underline">
                Things to do in Lake Geneva →
              </Link>
            </li>
            <li>
              <Link to="/eats" className="text-brand-accent hover:underline">
                Where locals eat →
              </Link>
            </li>
            <li>
              <Link to="/guides/lake-geneva-shore-path" className="text-brand-accent hover:underline">
                The Lake Geneva Shore Path guide →
              </Link>
            </li>
            <li>
              <Link to="/directory" className="text-brand-accent hover:underline">
                Full local business directory →
              </Link>
            </li>
          </ul>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}