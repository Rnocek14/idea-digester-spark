import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";

type Entry = { title: string; path: string; blurb: string };

const businesses: Entry[] = [
  {
    title: "Stinebrink's Piggly Wiggly",
    path: "/businesses/stinebrinks-piggly-wiggly",
    blurb: "The main grocery at Geneva Square — meat counter, and the in-store DMV kiosk.",
  },
  {
    title: "Bruno's Liquors",
    path: "/businesses/brunos-liquors",
    blurb: "Broad Street liquor store — wine, spirits, kegs and event catering.",
  },
  {
    title: "Yogeeze Frozen Yogurt",
    path: "/businesses/yogeeze-frozen-yogurt",
    blurb: "Self-serve frozen yogurt downtown, plus the yogurt pies people order ahead.",
  },
];

/**
 * Hub for the individual business pages. Search Console shows steady
 * impressions for business-name queries with no page of ours to land on; this
 * gives those pages a parent and an internal link path from /guides.
 */
export default function BusinessesIndex() {
  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title="Lake Geneva Local Businesses — Hours, Addresses & What They're For"
        description="Straight answers on the Lake Geneva places people look up most: the Piggly Wiggly at Geneva Square, Bruno's Liquors on Broad Street, and Yogeeze downtown."
        path="/businesses"
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Local businesses", path: "/businesses" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Lake Geneva local businesses",
            itemListElement: businesses.map((b, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: b.title,
              url: b.path,
            })),
          },
        ]}
      />
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-blue-700">Home</Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-900">Local businesses</span>
        </nav>
        <h1 className="font-display text-3xl sm:text-4xl text-slate-900 tracking-tight">
          Lake Geneva local businesses
        </h1>
        <p className="mt-3 text-slate-700 max-w-2xl">
          Where to go, when they're open, and what people around here actually
          use them for. No rankings, no paid placement — just the everyday
          places that come up in conversation.
        </p>

        <ul className="mt-8 space-y-4">
          {businesses.map((b) => (
            <li key={b.path} className="rounded-lg border border-stone-200 bg-white p-5">
              <Link
                to={b.path}
                className="font-display text-xl text-slate-900 hover:text-blue-700"
              >
                {b.title}
              </Link>
              <p className="mt-1 text-sm text-slate-700">{b.blurb}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-slate-600">
          Looking for something bigger?{" "}
          <Link to="/guides" className="text-blue-700 hover:underline">
            Browse the Lake Geneva guides
          </Link>
          .
        </p>
      </main>
    </div>
  );
}