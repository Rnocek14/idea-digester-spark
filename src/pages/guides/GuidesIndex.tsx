import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";

type GuideEntry = {
  title: string;
  path: string;
  blurb: string;
};

type GuideGroup = {
  heading: string;
  description: string;
  guides: GuideEntry[];
};

const groups: GuideGroup[] = [
  {
    heading: "Places & landmarks",
    description: "The actual spots people drive over to see.",
    guides: [
      {
        title: "The Lake Geneva Shore Path",
        path: "/guides/lake-geneva-shore-path",
        blurb: "The 21-mile public path that circles Geneva Lake, stop by stop.",
      },
      {
        title: "Yerkes Observatory",
        path: "/guides/yerkes-observatory",
        blurb: "Williams Bay's 1897 observatory — tours, hours, and what to expect.",
      },
      {
        title: "Big Foot Beach State Park",
        path: "/guides/big-foot-beach-state-park",
        blurb: "Beach, campground, trails, fees, and parking for Lake Geneva's state park.",
      },
      {
        title: "Public access to the lake",
        path: "/guides/lake-geneva-public-access-guide",
        blurb: "Every public beach, boat launch, and shoreline entry point.",
      },
      {
        title: "Streblow boats",
        path: "/guides/streblow-boats-geneva-lake",
        blurb: "The classic wooden boats built on Geneva Lake since the 1940s.",
      },
    ],
  },
  {
    heading: "Things to do",
    description: "Plan a day, a weekend, or a season.",
    guides: [
      {
        title: "Things to do in Lake Geneva",
        path: "/guides/things-to-do-lake-geneva",
        blurb: "Our running list of what's actually worth doing.",
      },
      {
        title: "This weekend in Lake Geneva",
        path: "/guides/things-to-do-lake-geneva-this-weekend",
        blurb: "What's on Friday through Sunday, refreshed each week.",
      },
      {
        title: "Lake Geneva with kids",
        path: "/guides/things-to-do-lake-geneva-with-kids",
        blurb: "Family-friendly picks across the lake.",
      },
      {
        title: "Lake Geneva in summer",
        path: "/guides/best-things-to-do-lake-geneva-in-summer",
        blurb: "Peak-season picks — water, festivals, patios, evenings.",
      },
      {
        title: "Lake Geneva in winter",
        path: "/guides/things-to-do-lake-geneva-in-winter",
        blurb: "Ice castles, snow trails, cozy bars, and the off-season pace.",
      },
      {
        title: "Lake Geneva webcams",
        path: "/lake-geneva-webcams",
        blurb: "Every working live cam pointed at the lake.",
      },
      {
        title: "Lake Geneva weather",
        path: "/lake-geneva-weather",
        blurb: "Live conditions, marine forecast, and seasonal outlook.",
      },
    ],
  },
  {
    heading: "Moving to Lake Geneva",
    description: "What to know before you make the move.",
    guides: [
      {
        title: "Moving to Lake Geneva",
        path: "/guides/moving-to-lake-geneva",
        blurb: "The honest move-here guide — pace, costs, neighborhoods, schools.",
      },
      {
        title: "Lake Geneva neighborhoods",
        path: "/guides/lake-geneva-neighborhoods",
        blurb: "How the lake's neighborhoods actually differ.",
      },
      {
        title: "Lake Geneva schools",
        path: "/guides/lake-geneva-schools",
        blurb: "Public and private schools serving the lake.",
      },
      {
        title: "Cost of living in Lake Geneva",
        path: "/guides/cost-of-living-lake-geneva",
        blurb: "Housing, taxes, utilities, and the line items that surprise newcomers.",
      },
      {
        title: "Why people love Lake Geneva",
        path: "/guides/why-people-love-lake-geneva",
        blurb: "The pull of the lake — and what keeps people here.",
      },
    ],
  },
  {
    heading: "Town comparisons",
    description: "If you're choosing between lake towns.",
    guides: [
      {
        title: "Lake Geneva vs. Williams Bay",
        path: "/guides/lake-geneva-vs-williams-bay",
        blurb: "Pace, schools, real estate, and what each town is known for.",
      },
      {
        title: "Fontana vs. Lake Geneva",
        path: "/guides/fontana-vs-lake-geneva",
        blurb: "The quieter west end vs. the busier east end.",
      },
    ],
  },
  {
    heading: "Reference",
    description: "Quick answers, kept current.",
    guides: [
      {
        title: "Lake Geneva FAQ",
        path: "/guides/lake-geneva-faq",
        blurb: "The questions visitors and newcomers actually ask.",
      },
      {
        title: "Lake Geneva market report",
        path: "/market-report",
        blurb: "What's happening in the real estate market right now.",
      },
    ],
  },
];

export default function GuidesIndex() {
  const path = "/guides";
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Lake Geneva Guides",
      description:
        "Cornerstone guides to Lake Geneva, Wisconsin — landmarks, things to do, moving, neighborhoods, and reference.",
      url: `https://lakegenevabrief.com${path}`,
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title="Lake Geneva Guides — Local Brief"
        description="Cornerstone guides to Lake Geneva, Wisconsin: the Shore Path, Yerkes Observatory, Big Foot Beach, neighborhoods, schools, things to do, and more — written by people who actually live here."
        path={path}
        ogType="website"
        jsonLd={jsonLd}
      />
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-blue-700">
            Home
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-900">Guides</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight leading-tight">
            Lake Geneva Guides
          </h1>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed max-w-3xl">
            Cornerstone guides to the places, decisions, and questions
            that come up around Lake Geneva, Wisconsin — kept current and
            written by people who actually live on the lake.
          </p>
        </header>

        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.heading}>
              <h2 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">
                {g.heading}
              </h2>
              <p className="text-slate-600 mt-1 mb-5">{g.description}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {g.guides.map((guide) => (
                  <Link
                    key={guide.path}
                    to={guide.path}
                    className="block rounded-md border border-slate-200 bg-white p-5 hover:border-blue-500 hover:shadow-sm transition-all"
                  >
                    <p className="font-display text-lg text-slate-900">
                      {guide.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {guide.blurb}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}