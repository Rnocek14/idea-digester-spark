import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";
import { loadCollection, loadSignals, withinDays, type VenueSignals } from "@/lib/communitySignals";
import { Heart, Mic, Newspaper } from "lucide-react";

const COLLECTION = "restaurants-lake-geneva";
const PATH = "/best-of/restaurants-lake-geneva";
const TITLE = "Restaurants Lake Geneva Locals Actually Talk About";
const META_DESC =
  "The Lake Geneva restaurants that keep showing up in Local Love notes, Community Voices essays, and conversations around Geneva Lake — not a ranked top-25 list.";

function SourcePill({ source }: { source: VenueSignals["recent"][number]["source"] }) {
  if (source === "local_love")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
        <Heart className="h-3 w-3" /> Local Love
      </span>
    );
  if (source === "voices")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
        <Mic className="h-3 w-3" /> Voices
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
      <Newspaper className="h-3 w-3" /> The Brief
    </span>
  );
}

function SignalLine({ s }: { s: VenueSignals }) {
  const parts: string[] = [];
  if (s.counts.local_love > 0)
    parts.push(`${s.counts.local_love} Local Love mention${s.counts.local_love === 1 ? "" : "s"}`);
  if (s.counts.voices > 0)
    parts.push(`${s.counts.voices} Community Voices reference${s.counts.voices === 1 ? "" : "s"}`);
  if (s.counts.brief > 0)
    parts.push(`${s.counts.brief} Brief feature${s.counts.brief === 1 ? "" : "s"}`);
  if (parts.length === 0) return null;
  return <p className="text-sm text-slate-600 leading-relaxed">{parts.join(" · ")}</p>;
}

export default function RestaurantsLakeGeneva() {
  const { data: venues = [] } = useQuery({
    queryKey: ["community-venues", COLLECTION],
    queryFn: () => loadCollection(COLLECTION),
  });

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ["venue-signals", COLLECTION, venues.map((v) => v.id).join(",")],
    queryFn: () => loadSignals(venues, { windowDays: 365, recentPerVenue: 1 }),
    enabled: venues.length > 0,
  });

  const picks = signals.filter((s) => s.venue.is_editorial_pick);
  const withMentions = signals.filter((s) => s.counts.total > 0);
  const recentMentions = signals
    .filter((s) => withinDays(s.lastMentionAt, 90) && s.counts.total > 0)
    .sort((a, b) => (a.lastMentionAt! < b.lastMentionAt! ? 1 : -1))
    .slice(0, 8);

  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Best of Lake Geneva", path: "/best-of" },
      { name: "Restaurants", path: PATH },
    ]),
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta title={TITLE} description={META_DESC} path={PATH} ogType="article" jsonLd={jsonLd} />
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-blue-700">Home</Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-700">Best Of</span>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-900">Restaurants</span>
        </nav>

        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight leading-tight">
            {TITLE}
          </h1>
          <p className="text-slate-700 mt-4 text-lg leading-relaxed">
            These aren't the highest-rated restaurants on a travel site. They're the places that
            keep showing up in <Link to="/community/local-love" className="text-rose-700 hover:underline">Local Love</Link>{" "}
            notes, <Link to="/community/voices" className="text-indigo-700 hover:underline">Community Voices</Link>{" "}
            essays, and the day-to-day Brief — the rooms people in Geneva Lake actually mention
            when someone asks where to eat.
          </p>
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mt-3">
            The Brief Editors · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </header>

        {/* Section 1 — The Brief Picks */}
        <section className="mt-10 scroll-mt-24" id="picks">
          <h2 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2 pb-2 border-b border-slate-200">
            The Brief Picks
          </h2>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            A curated short list — not ranked. The places we'd send a friend visiting for the
            first time, in no particular order.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {picks.map((s) => (
              <article key={s.venue.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg text-slate-900">{s.venue.canonical_name}</h3>
                  {s.venue.neighborhood && (
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
                      {s.venue.neighborhood}
                    </span>
                  )}
                </div>
                {s.venue.short_descriptor && (
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">{s.venue.short_descriptor}</p>
                )}
                {s.venue.editor_note && (
                  <p className="text-sm italic text-slate-600 mt-2 leading-relaxed">"{s.venue.editor_note}"</p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Section 2 — What Locals Are Saying */}
        <section className="mt-12 scroll-mt-24" id="signals">
          <h2 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2 pb-2 border-b border-slate-200">
            What Locals Are Saying
          </h2>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Evidence, not conclusions. Each line below is a real count from{" "}
            <Link to="/community/local-love" className="text-rose-700 hover:underline">Local Love</Link>,{" "}
            <Link to="/community/voices" className="text-indigo-700 hover:underline">Community Voices</Link>, and Brief
            stories from the last year. We only show places with at least one recorded mention.
          </p>

          {isLoading ? (
            <p className="text-slate-500 text-sm">Reading the signals…</p>
          ) : withMentions.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-slate-700 text-sm leading-relaxed">
                No community mentions yet for these spots. As neighbors write in,
                this section fills itself.
              </p>
              <Link to="/submit" className="text-sm text-blue-700 hover:underline mt-2 inline-block">
                Send a Local Love note →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {withMentions.map((s) => {
                const recent = s.recent[0];
                return (
                  <article key={s.venue.id} className="rounded-md border border-slate-200 bg-white p-5">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <h3 className="font-display text-lg text-slate-900">{s.venue.canonical_name}</h3>
                      {s.venue.neighborhood && (
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                          {s.venue.neighborhood}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-3">
                      Community Signals
                    </p>
                    <div className="mt-1">
                      <SignalLine s={s} />
                    </div>
                    {recent && (
                      <div className="mt-3 pl-3 border-l-2 border-slate-200">
                        <div className="mb-1">
                          <SourcePill source={recent.source} />
                        </div>
                        <p className="text-sm text-slate-700 italic leading-relaxed">
                          "{recent.snippet}"
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {recent.byline ? `— ${recent.byline}` : "— from a recent mention"}
                          {" · "}
                          {new Date(recent.at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3 — Recently Mentioned */}
        {recentMentions.length > 0 && (
          <section className="mt-12 scroll-mt-24" id="recent">
            <h2 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2 pb-2 border-b border-slate-200">
              Recently Mentioned
            </h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Names that have come up around Geneva Lake in the last 90 days.
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {recentMentions.map((s) => (
                <li key={s.venue.id} className="rounded-md border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{s.venue.canonical_name}</span>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    {s.lastMentionAt &&
                      new Date(s.lastMentionAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 4 — Explore the Area */}
        <section className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
            Explore the area
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Things to do in Lake Geneva", path: "/guides/things-to-do-lake-geneva", blurb: "The full guide — lake, downtown, year-round." },
              { title: "This weekend in Lake Geneva", path: "/guides/things-to-do-lake-geneva-this-weekend", blurb: "What's actually happening this Friday through Sunday." },
              { title: "Lake Geneva neighborhoods", path: "/guides/lake-geneva-neighborhoods", blurb: "How locals describe Williams Bay, Fontana, Linn, and the city itself." },
              { title: "Moving to Lake Geneva", path: "/guides/moving-to-lake-geneva", blurb: "A neighborly relocation guide — schools, taxes, daily rhythms." },
            ].map((r) => (
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

        <p className="text-[11px] text-slate-500 mt-10 leading-relaxed">
          A note on method: this page does not aggregate stars or rankings from anywhere else.
          Community Signals are counted from public submissions to The Brief, edited essays in
          Community Voices, and stories that have run on the site in the last year. Names are
          matched against a curated alias list — never fuzzy matching — so the counts stay honest.
        </p>
      </main>
    </div>
  );
}