import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Play, Heart, MapPin, Bath } from "lucide-react";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonLd";
import { LG_LANDMARK_KEYWORDS, LG_CORE_KEYWORDS } from "@/lib/seoKeywords";
import { useShorePathStops, type ShorePathStopRow } from "@/hooks/useShorePathStops";
import { ShorePathMap } from "@/components/shore-path/ShorePathMap";
import { ShorePathWalkingMode } from "@/components/shore-path/ShorePathWalkingMode";
import { StickyMapStrip } from "@/components/shore-path/StickyMapStrip";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";

const TODAY = "2026-06-05";
const PATH = "/guides/lake-geneva-shore-path";
const META_TITLE = "Lake Geneva Shore Path: The Complete Guide & Walking Companion";
const META_DESCRIPTION =
  "The 21-mile public shoreline path around Geneva Lake — history, access points, parking, and a stop-by-stop walking companion through 16 verified landmarks.";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How long is the Lake Geneva Shore Path?",
    answer:
      "The Shore Path runs roughly 21 miles around Geneva Lake, following a public easement that has existed since the 1870s. Most walkers tackle it in sections rather than a single day.",
  },
  {
    question: "How long does it take to walk the whole Shore Path?",
    answer:
      "Walking the full 21 miles at a steady pace takes 8–10 hours. Most locals walk it in stages over several outings, often starting from Library Park in Lake Geneva, Fontana Beach, or Williams Bay Lakefront Park.",
  },
  {
    question: "Where can I park to access the Shore Path?",
    answer:
      "Public parking is available in downtown Lake Geneva (Library Park area), Fontana Beach, Williams Bay Lakefront Park, Big Foot Beach State Park (entry fee), and Linn Pier. Avoid blocking private driveways along the path.",
  },
  {
    question: "Is the Shore Path really public if it goes past private homes?",
    answer:
      "Yes. The path runs along a continuous public easement granted in the late 1800s. You're walking on what is effectively a public sidewalk in front of long-standing lakefront properties. Stay on the path, keep voices down, and don't step onto lawns or piers.",
  },
  {
    question: "Can I bring my dog on the Shore Path?",
    answer:
      "Dogs are generally welcome on leash, but some private stretches post no-pet notices. Always leash, always pick up, and turn around if a posted sign asks you to.",
  },
  {
    question: "When is the best time of year to walk the Shore Path?",
    answer:
      "Late spring through October. Locals quietly agree that October — clear light, cooler air, fewer walkers — is the best time. Winter walks are possible on cleared stretches but the path is not maintained for snow.",
  },
  {
    question: "Is the Shore Path accessible for strollers or wheelchairs?",
    answer:
      "Mostly no. The path includes stone steps, narrow stretches, tree roots, and uneven surfaces. The flattest, most accessible sections are around Library Park, Flat Iron Park, and the Williams Bay and Fontana lakefronts.",
  },
  {
    question: "Can I swim from the Shore Path?",
    answer:
      "Swim only at designated public beaches — Lake Geneva Public Beach, Williams Bay, Fontana, and Big Foot Beach State Park. The shoreline in front of private homes is private waterfront; swimming there is not permitted.",
  },
  {
    question: "Where did the distances and access points on this page come from?",
    answer:
      "Access point letters, public restroom locations, and the seven leg distances that add to 21 miles come from the official Geneva Lake Shore Path map published by the Williams Bay Recreation Department (williamsbay.org/recreation-department). The stop-by-stop walking companion, history, and editorial notes are our own.",
  },
];

// Public restrooms along the path — sourced from the official Williams Bay
// Recreation Department Geneva Lake Shore Path map.
const RESTROOMS: { name: string; community: string }[] = [
  { name: "Edgewater Park", community: "Williams Bay" },
  { name: "Lakefront Recreation Building", community: "Williams Bay" },
  { name: "Elm Park", community: "Lake Geneva" },
  { name: "The Riviera", community: "Lake Geneva" },
  { name: "Lake Geneva Visitor Center", community: "Lake Geneva" },
  { name: "Big Foot Beach State Park", community: "Lake Geneva (south shore)" },
  { name: "Reid Park", community: "Fontana" },
];

// Official leg distances around the lake, totaling 21 miles.
const LEG_DISTANCES: { from: string; to: string; miles: number }[] = [
  { from: "Williams Bay", to: "Fontana", miles: 3.5 },
  { from: "Fontana", to: "Shadow Lane", miles: 2.3 },
  { from: "Shadow Lane", to: "Linn Road", miles: 2.9 },
  { from: "Linn Road", to: "Big Foot Beach", miles: 3.3 },
  { from: "Big Foot Beach", to: "Lake Geneva", miles: 2.0 },
  { from: "Lake Geneva", to: "Chapin Road", miles: 3.5 },
  { from: "Chapin Road", to: "Williams Bay", miles: 3.5 },
];

export default function LakeGenevaShorePath() {
  const { data: stops = [], isLoading } = useShorePathStops();
  const [walkingOpen, setWalkingOpen] = useState(false);
  const [walkingInitialIndex, setWalkingInitialIndex] = useState<number | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [arrivedStopId, setArrivedStopId] = useState<string | null>(null);
  const [mapInView, setMapInView] = useState(true);
  const mapRef = useRef<HTMLDivElement | null>(null);

  // Observe the hero map so we know whether to show the sticky strip.
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setMapInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Clear the "just arrived" highlight after the animation finishes.
  useEffect(() => {
    if (!arrivedStopId) return;
    const t = window.setTimeout(() => setArrivedStopId(null), 1800);
    return () => window.clearTimeout(t);
  }, [arrivedStopId]);

  const jsonLd = useMemo(
    () => [
      articleJsonLd({
        title: META_TITLE,
        description: META_DESCRIPTION,
        path: PATH,
        datePublished: TODAY,
        dateModified: TODAY,
      }),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: "Lake Geneva Shore Path", path: PATH },
      ]),
      faqJsonLd(FAQS),
    ],
    [],
  );

  const handleJumpToStop = (s: ShorePathStopRow) => {
    setActiveStopId(s.id);
    setArrivedStopId(s.id);
    const el = document.getElementById(`stop-${s.slug}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleStartWalkFromStop = (s: ShorePathStopRow) => {
    const idx = stops.findIndex((x) => x.id === s.id);
    setWalkingInitialIndex(idx >= 0 ? idx : 0);
    setWalkingOpen(true);
  };

  const handleBackToMap = () => {
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeStop = activeStopId
    ? stops.find((s) => s.id === activeStopId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title={META_TITLE}
        description={META_DESCRIPTION}
        path={PATH}
        ogType="article"
        jsonLd={jsonLd}
        keywords={[
          "Lake Geneva Shore Path",
          "Shore Path map",
          "Shore Path parking",
          "Shore Path length",
          "Shore Path access points",
          "Shore Path guide",
          "Geneva Lake walking path",
          "Lake Geneva walking trail",
          "21 mile shore path",
          ...LG_LANDMARK_KEYWORDS,
          ...LG_CORE_KEYWORDS,
        ]}
      />
      <PublicHeader />

      {activeStop && (
        <StickyMapStrip
          stop={activeStop}
          totalStops={stops.length}
          visible={!mapInView}
          onBackToMap={handleBackToMap}
        />
      )}

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-slate-500 mb-4">
          <Link to="/" className="hover:text-blue-700">Home</Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-700">Guides</span>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-900">Lake Geneva Shore Path</span>
        </nav>

        {/* Hero */}
        <header className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            The Lake Geneva Brief · Walking Companion
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight leading-tight">
            The Lake Geneva Shore Path
          </h1>
          <p className="text-slate-600 mt-3 text-base sm:text-lg leading-relaxed max-w-3xl">
            21 miles of continuous public shoreline around Geneva Lake — one
            of the oldest publicly-walkable lakefronts in America. A guide
            and a stop-by-stop walking companion.
          </p>
        </header>

        {/* Stylized map */}
        <div className="mb-4" ref={mapRef}>
          <ShorePathMap
            stops={stops}
            activeStopId={activeStopId}
            onJumpToStop={handleJumpToStop}
            onStartWalkFromStop={handleStartWalkFromStop}
            size="hero"
          />
          <p className="text-xs text-slate-500 mt-2 italic">
            Tap any numbered marker for a quick preview, then jump to the
            full write-up. Illustrative — not a navigation map.
          </p>
        </div>

        {/* Stats + CTA */}
        <div className="rounded-md border border-slate-200 bg-white p-5 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <Stat label="Shoreline path" value="21 miles" />
            <Stat label="History" value="150+ years" />
            <Stat label="Featured stops" value={stops.length ? String(stops.length) : "16"} />
            <Stat label="Public access" value="Continuous" />
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setWalkingOpen(true)}
            disabled={isLoading || stops.length === 0}
          >
            <Play className="h-4 w-4 mr-2 fill-current" />
            Start Shore Path Experience
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            Manual mode — tap "Next stop" as you walk. No GPS, no location
            tracking. Your progress saves automatically.
          </p>
        </div>

        {/* Editorial intro */}
        <section className="prose prose-slate max-w-none text-slate-700 leading-relaxed mb-10">
          <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
            What the Shore Path actually is
          </h2>
          <p>
            The Shore Path is unusual. In the 1870s, when the railroad first
            brought Chicago families up to summer on Geneva Lake, the
            landowners around the lake agreed — informally, then formally —
            that a continuous footpath would stay open along the water in
            front of their properties. That easement has held for more than
            150 years.
          </p>
          <p>
            What it means in practice: you can walk all the way around
            Geneva Lake on what is, effectively, a public sidewalk that
            runs in front of private lakefront homes. It is one of very few
            stretches of private lake shoreline in America that the public
            has a continuous legal right to walk.
          </p>
          <p>
            <strong>How to walk it well.</strong> Stay on the path. Keep
            voices down — people live here, and many of these are
            single-family homes, not historic estates. Don't step onto
            lawns, piers, or beach areas. Leash your dog. Don't
            photograph people on their own property. If a section is
            blocked for maintenance, turn around and try another segment.
          </p>
        </section>

        {/* Stops */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
            The walk, stop by stop
          </h2>

          {isLoading && (
            <p className="text-sm text-slate-500">Loading stops…</p>
          )}

          <div className="space-y-6">
            {stops.map((stop) => (
              <article
                key={stop.id}
                id={`stop-${stop.slug}`}
                className={[
                  "scroll-mt-24 rounded-md border bg-white p-5 transition-all",
                  stop.id === activeStopId
                    ? "border-amber-400 border-l-4"
                    : "border-slate-200",
                  stop.id === arrivedStopId
                    ? "ring-2 ring-amber-300 ring-offset-2"
                    : "",
                ].join(" ")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                    {stop.order_index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      {stop.community || "Geneva Lake"}
                      {stop.approx_mile != null && ` · Mile ${stop.approx_mile}`}
                    </p>
                    <h3 className="font-display text-xl text-slate-900 tracking-tight">
                      {stop.name}
                    </h3>
                    {stop.description && (
                      <p className="text-slate-700 leading-relaxed mt-2">
                        {stop.description}
                      </p>
                    )}
                    {stop.look_for && (
                      <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700 mb-1">
                          Look for
                        </p>
                        <p className="text-sm text-amber-900 leading-snug">
                          {stop.look_for}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/submit?kind=local_love&stop=${encodeURIComponent(stop.slug)}&stop_name=${encodeURIComponent(stop.name)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        Share a memory from this spot
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="text-xs text-slate-500 italic mt-4">
            Every stop here is a public landmark — a park, public beach,
            public pier, or historic site open to visitors. We don't name
            private homes or owners.
          </p>
        </section>

        {/* Sparse-signal invitation, same pattern as Restaurants page */}
        <section className="mb-12 rounded-md border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-lg text-slate-900 mb-1">
                Know a Shore Path spot worth a story?
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Family tradition, a quiet bench you stop at every walk, a
                bit of history the guide misses — send us a{" "}
                <Link to="/submit?kind=local_love" className="text-blue-700 hover:underline font-medium">
                  Local Love note
                </Link>
                . We add the good ones to the stop they belong to.
              </p>
            </div>
          </div>
        </section>

        {/* Restrooms + leg distances — practical planning info, sourced from
            the official Williams Bay Recreation Department map. */}
        <section className="mb-12 grid md:grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bath className="h-4 w-4 text-blue-700" />
              <h3 className="font-display text-lg text-slate-900">
                Public restrooms along the path
              </h3>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {RESTROOMS.map((r) => (
                <li key={r.name} className="flex justify-between gap-3">
                  <span className="text-slate-900">{r.name}</span>
                  <span className="text-slate-500 text-xs whitespace-nowrap">
                    {r.community}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 italic mt-3">
              Hours vary by season. Source: Williams Bay Rec Dept.
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-blue-700" />
              <h3 className="font-display text-lg text-slate-900">
                Leg distances (official)
              </h3>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {LEG_DISTANCES.map((leg) => (
                <li
                  key={`${leg.from}-${leg.to}`}
                  className="flex justify-between gap-3"
                >
                  <span className="text-slate-900">
                    {leg.from} → {leg.to}
                  </span>
                  <span className="text-slate-600 font-mono text-xs whitespace-nowrap">
                    {leg.miles.toFixed(1)} mi
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 pt-2 mt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-mono font-semibold text-slate-900 text-xs">
                  21.0 mi
                </span>
              </li>
            </ul>
            <p className="text-[11px] text-slate-500 italic mt-3">
              Approximate — useful for planning a section walk.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
            Common questions
          </h2>
          <dl className="space-y-5">
            {FAQS.map((q) => (
              <div key={q.question}>
                <dt className="font-semibold text-slate-900">{q.question}</dt>
                <dd className="text-slate-700 mt-1 leading-relaxed">{q.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Related guides */}
        <section className="mb-12 pt-8 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
            Keep reading
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <RelatedCard
              to="/guides/things-to-do-lake-geneva"
              title="Things to do in Lake Geneva"
              blurb="A wider tour of the area — what's worth your time beyond the path."
            />
            <RelatedCard
              to="/guides/best-things-to-do-lake-geneva-in-summer"
              title="Lake Geneva in summer"
              blurb="When the Shore Path is busiest, and what else is happening on the water."
            />
            <RelatedCard
              to="/guides/things-to-do-lake-geneva-in-winter"
              title="Lake Geneva in winter"
              blurb="Walking the path off-season, plus what locals do when the lake freezes."
            />
            <RelatedCard
              to="/guides/lake-geneva-neighborhoods"
              title="The shoreline neighborhoods"
              blurb="A guide to the towns the path connects — Lake Geneva, Fontana, Williams Bay, Linn."
            />
          </div>
        </section>

        <SoftRealEstateCTA variant="neighborhoods" />
      </main>

      <ShorePathWalkingMode
        open={walkingOpen}
        onOpenChange={setWalkingOpen}
        stops={stops}
        initialIndex={walkingInitialIndex}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xl sm:text-2xl text-slate-900 leading-none">
        {value}
      </p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1.5">
        {label}
      </p>
    </div>
  );
}

function RelatedCard({ to, title, blurb }: { to: string; title: string; blurb: string }) {
  return (
    <Link
      to={to}
      className="block rounded-md border border-slate-200 bg-white p-4 hover:border-blue-500 hover:shadow-sm transition-all"
    >
      <p className="font-display text-lg text-slate-900">{title}</p>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{blurb}</p>
    </Link>
  );
}