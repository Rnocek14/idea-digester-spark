import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Play, Heart, MapPin, Bath, Footprints, Sun, Clock, Backpack } from "lucide-react";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, stopsItemListJsonLd } from "@/lib/seo/jsonLd";
import { LG_LANDMARK_KEYWORDS, LG_CORE_KEYWORDS } from "@/lib/seoKeywords";
import { useShorePathStops, type ShorePathStopRow } from "@/hooks/useShorePathStops";
import { ShorePathMap } from "@/components/shore-path/ShorePathMap";
import { StickyMapStrip } from "@/components/shore-path/StickyMapStrip";
import { StoryPlayer } from "@/components/shore-path/StoryPlayer";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { PassportProgress } from "@/components/shore-path/PassportProgress";
import { RegisterMilestoneCard } from "@/components/shore-path/RegisterMilestoneCard";
import { ConditionsPrompt } from "@/components/shore-path/ConditionsPrompt";
import { PathAlmanac } from "@/components/shore-path/PathAlmanac";
import { usePathRegister } from "@/hooks/usePathRegister";

// The walking-mode dialog and the guided-walk controller (geolocation, wake
// lock, audio) are the heaviest things on the page and matter only to readers
// who opt in. Everything that ranks here is text, so defer the JavaScript
// until someone actually presses a button.
const ShorePathWalkingMode = lazy(() =>
  import("@/components/shore-path/ShorePathWalkingMode").then((m) => ({
    default: m.ShorePathWalkingMode,
  })),
);
const GuidedWalkController = lazy(() =>
  import("@/components/shore-path/GuidedWalkController").then((m) => ({
    default: m.GuidedWalkController,
  })),
);

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
  {
    question: "What is the easiest section of the Shore Path for first-time walkers?",
    answer:
      "Start in downtown Lake Geneva at Library Park and walk west toward Flat Iron Park and the Riviera. The path is flat, paved in stretches, has benches, restrooms, and clear sightlines of the lake. It's the friendliest 30–60 minutes on the whole path.",
  },
  {
    question: "What's a good shorter section to walk with kids?",
    answer:
      "Williams Bay Lakefront Park to Edgewater Park is the family pick — flat, short, public beach access, restrooms, and a playground at the trailhead. Fontana Beach to Reid Park is the other easy win on the west end.",
  },
  {
    question: "Can I bike the Shore Path?",
    answer:
      "No. The path is for walking only. Sections cross private property under a foot-traffic easement; bikes, scooters, and strollers are not permitted on most of it. For cycling, the public roads paralleling the lake are the alternative.",
  },
  {
    question: "Are there public restrooms on the Shore Path?",
    answer:
      "Yes, at seven public locations: Edgewater Park and the Lakefront Recreation Building in Williams Bay; Elm Park, the Riviera, and the Lake Geneva Visitor Center in Lake Geneva; Big Foot Beach State Park on the south shore; and Reid Park in Fontana. Hours vary by season, so don't count on one being open outside the summer months. Plan your turnaround points around them.",
  },
  {
    question: "How far is Williams Bay to Fontana on the Shore Path?",
    answer:
      "3.5 miles one way, according to the official leg distances on the Williams Bay Recreation Department map. Most walkers take two to three hours at an unhurried pace with stops. It's the single segment we get asked about most.",
  },
  {
    question: "What are the individual leg distances on the Shore Path?",
    answer:
      "Seven legs add up to the full 21 miles: Williams Bay to Fontana 3.5, Fontana to Shadow Lane 2.3, Shadow Lane to Linn Road 2.9, Linn Road to Big Foot Beach 3.3, Big Foot Beach to Lake Geneva 2.0, Lake Geneva to Chapin Road 3.5, and Chapin Road back to Williams Bay 3.5. Pick two endpoints and add the legs between them to plan a section.",
  },
  {
    question: "Is there a shorter walk than the full 21 miles?",
    answer:
      "Most people never walk the whole loop. Four common section walks: Library Park out and back toward Big Foot Beach (about four miles round-trip), Williams Bay Lakefront Park to Edgewater Park and back (about a mile and a half), Fontana Beach to Reid Park and back for sunset (about two miles), and Williams Bay to Fontana one-way (3.5 miles, half a day with lunch).",
  },
  {
    question: "Do I need a map to walk the Shore Path?",
    answer:
      "The path itself is easy to follow — it hugs the water and is worn in by daily use. What a map gives you is the access points, the restrooms, and the distances between them, which is what you actually need to plan a turnaround. The Williams Bay Recreation Department publishes the official Geneva Lake Shore Path map (williamsbay.org/recreation-department); the leg distances and restroom locations on this page come from it.",
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

// On-page contents. Each id must match a <section id> below.
const SECTIONS: { id: string; label: string }[] = [
  { id: "before-you-go", label: "Before you go" },
  { id: "what-it-is", label: "What the Shore Path is" },
  { id: "stops", label: "The walk, stop by stop" },
  { id: "register", label: "The Shore Path Register" },
  { id: "distances", label: "Leg distances and restrooms" },
  { id: "which-section", label: "Which section should you walk?" },
  { id: "parking", label: "Parking and access points" },
  { id: "seasons", label: "Walking it through the year" },
  { id: "plan", label: "Plan your walk" },
  { id: "faqs", label: "Common questions" },
];

// Static index of the stops, in walking order. The detailed write-ups below
// are loaded from the database; this list is rendered unconditionally so the
// page — and its ItemList schema — never depends on that fetch succeeding.
const STOP_INDEX: {
  slug: string;
  name: string;
  community: string;
  mile: number;
}[] = [
  { slug: "library-park", name: "Library Park", community: "Lake Geneva", mile: 0.0 },
  { slug: "flat-iron-park", name: "Flat Iron Park", community: "Lake Geneva", mile: 0.4 },
  { slug: "riviera-beach", name: "Riviera Beach & Pier", community: "Lake Geneva", mile: 0.6 },
  { slug: "lake-geneva-public-beach", name: "Lake Geneva Public Beach", community: "Lake Geneva", mile: 0.9 },
  { slug: "maple-lawn-area", name: "Maple Lawn Walking Section", community: "Lake Geneva", mile: 1.6 },
  { slug: "black-point-estate", name: "Black Point Estate", community: "Lake Geneva", mile: 5.5 },
  { slug: "south-shore-club-area", name: "South Shore Path Stretch", community: "Linn", mile: 8.5 },
  { slug: "linn-pier", name: "Linn Pier Public Access", community: "Linn", mile: 10.5 },
  { slug: "fontana-beach", name: "Fontana Beach", community: "Fontana", mile: 13.0 },
  { slug: "reid-park", name: "Reid Park", community: "Fontana", mile: 13.4 },
  { slug: "abbey-harbor-view", name: "Abbey Harbor View", community: "Fontana", mile: 13.9 },
  { slug: "kishwauketoe-edge", name: "Kishwauketoe Nature Conservancy Edge", community: "Williams Bay", mile: 15.5 },
  { slug: "edgewater-park", name: "Edgewater Park", community: "Williams Bay", mile: 16.3 },
  { slug: "williams-bay-lakefront", name: "Williams Bay Lakefront Park", community: "Williams Bay", mile: 16.6 },
  { slug: "yerkes-area", name: "Yerkes Observatory Area", community: "Williams Bay", mile: 17.5 },
  { slug: "cedar-point-park", name: "Cedar Point Park", community: "Williams Bay", mile: 18.5 },
];

// Public access points with parking. Fees and hours are deliberately not
// stated here — they change season to season; the access guide is the
// place we keep that detail.
const ACCESS_POINTS: { name: string; where: string; note: string }[] = [
  {
    name: "Library Park & downtown Lake Geneva",
    where: "East end of the lake",
    note: "The default start. City lots and metered street parking near the water, and the first place to fill on a summer weekend.",
  },
  {
    name: "Riviera & Lake Geneva Public Beach",
    where: "Downtown lakefront",
    note: "Restrooms, the tour-boat pier, and the flattest walking on the whole path. Day-use fee at the beach in season for non-residents.",
  },
  {
    name: "Big Foot Beach State Park",
    where: "South of downtown Lake Geneva",
    note: "A Wisconsin state park entry sticker is required. Parking here is the easiest way to reach the south-shore stretch without circling downtown.",
  },
  {
    name: "Williams Bay Lakefront Park & Edgewater Park",
    where: "North shore",
    note: "Parking at the lakefront, restrooms at both parks, and a playground at the trailhead — the family end of the path.",
  },
  {
    name: "Fontana Beach & Reid Park",
    where: "West end of the lake",
    note: "Public lot and street parking, restrooms at Reid Park, and the village's restaurants a short walk back from the beach.",
  },
  {
    name: "Linn Pier",
    where: "South shore",
    note: "A small public access with a small parking area. Useful as a turnaround on the south shore, where public access points sit farther apart than they do on the north side.",
  },
];

// Suggested section walks — built from the official leg distances so we
// never claim a mileage we can't source. Each starts and ends at a public
// access point with parking.
const SECTION_WALKS: {
  name: string;
  audience: string;
  from: string;
  to: string;
  miles: string;
  time: string;
  why: string;
}[] = [
  {
    name: "First-timer downtown loop",
    audience: "First visit · 60–90 min",
    from: "Library Park (Lake Geneva)",
    to: "Big Foot Beach State Park & back",
    miles: "~4 mi round-trip",
    time: "60–90 min",
    why: "Flat, paved stretches, benches, restrooms at the Riviera and Visitor Center, and the prettiest in-town views of the lake.",
  },
  {
    name: "Family-friendly bay walk",
    audience: "With kids · 30–45 min",
    from: "Williams Bay Lakefront Park",
    to: "Edgewater Park & back",
    miles: "~1.5 mi round-trip",
    time: "30–45 min",
    why: "Short, flat, with a beach and playground at the trailhead. Restrooms at both ends. Easy to bail out if little legs tire.",
  },
  {
    name: "Sunset on the west shore",
    audience: "Evening walk · 90 min",
    from: "Fontana Beach",
    to: "Reid Park & back",
    miles: "~2 mi round-trip",
    time: "75–90 min",
    why: "West-facing shoreline catches the sunset over the water. Park at Fontana Beach, walk the path, and come back for dinner in the village.",
  },
  {
    name: "Half-day section",
    audience: "Steady walker · half day",
    from: "Williams Bay",
    to: "Fontana (one-way)",
    miles: "3.5 mi one-way",
    time: "2–3 hours",
    why: "The single most-recommended segment of the path. Estate views, the quiet middle stretch, and a meal in Fontana at the end. Arrange a car at each end or call a ride.",
  },
];

export default function LakeGenevaShorePath() {
  const { data: stops = [], isLoading } = useShorePathStops();
  const [walkingOpen, setWalkingOpen] = useState(false);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [walkingInitialIndex, setWalkingInitialIndex] = useState<number | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [arrivedStopId, setArrivedStopId] = useState<string | null>(null);
  const [mapInView, setMapInView] = useState(true);
  const mapRef = useRef<HTMLDivElement | null>(null);
  // One instance for the page: the passport panel and the guided walk share it,
  // so a stop stamped mid-walk updates the panel without a second fetch.
  const register = usePathRegister();

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
      // Always emit the ItemList. If the stop fetch hasn't resolved (or a
      // crawler never runs it), fall back to the static stop index so the
      // page's richest schema doesn't disappear with the data.
      stopsItemListJsonLd({
        parentPath: PATH,
        parentName: "Lake Geneva Shore Path Stops",
        stops: stops.length
          ? stops.map((s) => ({
              slug: s.slug,
              name: s.name,
              description: s.short_label ?? s.description ?? null,
              latitude: s.latitude,
              longitude: s.longitude,
              image: s.hero_image_url,
            }))
          : STOP_INDEX.map((s) => ({
              slug: s.slug,
              name: s.name,
              description: `${s.community} · about mile ${s.mile.toFixed(1)} of the 21-mile Lake Geneva Shore Path.`,
            })),
      }),
    ],
    [stops],
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
          <span className="mx-2 text-slate-500">/</span>
          <span className="text-slate-700">Guides</span>
          <span className="mx-2 text-slate-500">/</span>
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
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mt-3">
            Updated{" "}
            {new Date(`${TODAY}T12:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · The Brief Editors
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => setGuidedOpen(true)}
              disabled={isLoading || stops.length === 0}
            >
              <Play className="h-4 w-4 mr-2 fill-current" />
              Start Guided Walk
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setWalkingOpen(true)}
              disabled={isLoading || stops.length === 0}
            >
              Use manual mode
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            <strong>Guided Walk</strong> uses your location to gently alert
            you when you reach a stop and play a short narrated story.
            Location stays on your device. <strong>Manual mode</strong> works
            anywhere — tap "Next stop" as you go.
          </p>
        </div>

        {/* Contents — mobile. Desktop gets the sticky sidebar below. */}
        <nav
          aria-label="On this page"
          className="lg:hidden rounded-md border border-slate-200 bg-white p-4 mb-8"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            On this page
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-blue-700 hover:underline leading-snug">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10">
          <article className="min-w-0">

          {/* Before you go — the whole page in one screen, and the part that
              stands on its own if the interactive pieces never load. */}
          <section id="before-you-go" className="scroll-mt-24 mb-10">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              Before you go
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Most of what a first-time walker needs, in one screen. Everything
              here is expanded on further down the page.
            </p>
            <ul className="rounded-md border border-slate-200 bg-white p-5 space-y-3 text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900">21 miles, seven legs.</strong>{" "}
                The path circles Geneva Lake in seven measured segments, the
                longest 3.5 miles. Walking the whole thing takes 8–10 hours, and
                almost nobody does it in one push.
              </li>
              <li>
                <strong className="text-slate-900">Public, but it runs through front yards.</strong>{" "}
                A continuous easement keeps the path open across private
                lakefront property. Treat it as a sidewalk that happens to pass
                a few feet from someone's porch, because that is what it is.
              </li>
              <li>
                <strong className="text-slate-900">Walking only.</strong> No
                bikes or scooters, and most of the path will not take a stroller
                — expect stone steps, tree roots, and narrow stretches between
                the paved bits downtown.
              </li>
              <li>
                <strong className="text-slate-900">Stay on the path.</strong> Not
                the lawns, not the piers, not the private beaches. Keep voices
                down and don't photograph people on their own property.
              </li>
              <li>
                <strong className="text-slate-900">Dogs on leash.</strong> Always
                leashed, always picked up after, and turn around if a stretch
                posts a no-pets notice.
              </li>
              <li>
                <strong className="text-slate-900">Swim only at public beaches.</strong>{" "}
                Lake Geneva, Williams Bay, Fontana, and Big Foot Beach State
                Park. The shoreline in front of private homes is private
                waterfront.
              </li>
              <li>
                <strong className="text-slate-900">Seven public restrooms, not much water.</strong>{" "}
                The restrooms are listed below and their hours change with the
                season. Carry your own water; drinking fountains are scarce and
                phone service drops off in the coves.
              </li>
              <li>
                <strong className="text-slate-900">Plan a section, not a loop.</strong>{" "}
                Pick two access points with parking, add the legs between them,
                and decide your turnaround before you start walking.
              </li>
            </ul>
          </section>

          {/* Editorial intro */}
          <section id="what-it-is" className="scroll-mt-24 prose prose-slate max-w-none text-slate-700 leading-relaxed mb-10">
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
              <strong>A note on that history.</strong> The 1870s date and the
              "more than 150 years" framing are the account as it is handed down
              around the lake and repeated by the shoreline communities; this
              desk has not reproduced a deed, plat, or court record here. Read it
              as the traditional account rather than a citation. The numbers
              further down this page — the seven leg distances and the public
              restroom locations — do come from a published source, and we say
              which one.
            </p>
            <p>
              <strong>What it feels like underfoot.</strong> Because the path
              crosses dozens of separate properties, the surface changes
              constantly: pavement in the downtown stretches, then grass,
              gravel, tree roots, and short flights of stone steps. Nothing about
              it is strenuous, but it is uneven enough that shoes matter and a
              stroller doesn't work, and in places it narrows to single file
              between the water and someone's yard.
            </p>
            <p>
              <strong>How to walk it well.</strong> Stay on the path. Keep
              voices down — people live here, and many of these are
              single-family homes, not historic estates. Don't step onto
              lawns, piers, or beach areas. Leash your dog. Don't
              photograph people on their own property. If a section is
              blocked for maintenance, turn around and try another segment.
              The path stays open because generations of walkers have treated
              it carefully; that is the whole arrangement.
            </p>
          </section>

          {/* Stops */}
          <section id="stops" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
              The walk, stop by stop
            </h2>

            <p className="text-slate-700 leading-relaxed mb-4">
              Sixteen stops, in walking order, beginning downtown at Library
              Park and heading west along the south shore, around the west end
              at Fontana, and back east through Williams Bay. Every one is a
              public landmark — a park, a public beach, a public pier, or a
              historic site open to visitors. The mile figures are approximate
              positions along the 21-mile path, useful for judging how far apart
              two stops are rather than for navigation.
            </p>

            <ol className="rounded-md border border-slate-200 bg-white p-5 mb-8 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {STOP_INDEX.map((s, i) => (
                <li key={s.slug} className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-slate-500 w-5 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">
                    <Link
                      to={`/guides/lake-geneva-shore-path/${s.slug}`}
                      className="text-blue-700 hover:underline font-medium"
                    >
                      {s.name}
                    </Link>
                    <span className="text-slate-500">
                      {" "}
                      · {s.community} · mile {s.mile.toFixed(1)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <h3 className="font-display text-xl text-slate-900 tracking-tight mb-3">
              The full write-ups
            </h3>

            {isLoading && (
              <p className="text-sm text-slate-500">Loading stops…</p>
            )}

            {!isLoading && stops.length === 0 && (
              <p className="text-sm text-slate-600 leading-relaxed">
                The detailed write-ups aren't loading right now. The list above
                is the walking order — each stop has its own page with the
                history, what to look for, and where the nearest parking and
                restrooms are.
              </p>
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
                      {stop.story_long && stop.story_long !== stop.description && (
                        <p className="text-slate-700 leading-relaxed mt-2">
                          {stop.story_long}
                        </p>
                      )}
                      {stop.audio_url && (
                        <div className="mt-3">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
                            Listen · narrated by The Brief
                          </p>
                          <StoryPlayer
                            audioUrl={stop.audio_url}
                            transcript={stop.audio_transcript}
                            durationSec={stop.audio_duration_sec}
                          />
                        </div>
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
                        {stop.local_love_prompt && (
                          <p className="w-full text-sm italic text-slate-600 leading-snug mb-1">
                            {stop.local_love_prompt}
                          </p>
                        )}
                        <Link
                          to={`/submit?kind=local_love&stop=${encodeURIComponent(stop.slug)}&stop_name=${encodeURIComponent(stop.name)}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          <Heart className="h-3.5 w-3.5" />
                          Share a memory from this spot
                        </Link>
                        <Link
                          to={`/guides/lake-geneva-shore-path/${stop.slug}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          Read the full story →
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

          {/* The register. A stamp book, not a scoreboard — see the reasoning in
              the register migration. Nothing here is timed and nothing is ranked;
              the number is issued in finishing order and that is the whole prize. */}
          <section id="register" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              The Shore Path Register
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Walk all sixteen stops and you're entered on the register with a
              permanent walker number, issued in the order people finish. There is
              no timing and no leaderboard, and there never will be — this is a
              footpath through other people's front yards, and the arrangement
              only holds because walkers treat it that way. Take five years if you
              like. The number is the same.
            </p>

            <PassportProgress
              hasPassport={register.hasPassport}
              walker={register.walker}
              progress={register.progress}
              entries={register.entries}
              pendingCount={register.pendingCount}
              isLoading={register.isLoading}
              error={register.error}
              onStart={() => void register.startPassport()}
              onUpdateProfile={register.updateProfile}
            />

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <h3 className="font-display text-base text-slate-900 mb-1">
                  How a stop gets stamped
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Start a Guided Walk and your phone confirms each stop as you
                  reach it. Stops confirmed by location are marked{" "}
                  <strong>verified</strong>; anything we can't confirm is listed
                  honestly as self-reported rather than quietly counted the same.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <h3 className="font-display text-base text-slate-900 mb-1">
                  Prefer paper?
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  <Link
                    to="/guides/lake-geneva-shore-path/passport"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Print a passport
                  </Link>{" "}
                  and carry it instead. It works at zero battery, in the coves
                  where service drops, and it's the better souvenir.
                </p>
              </div>
            </div>
          </section>

          {/* Restrooms + leg distances — practical planning info, sourced from
              the official Williams Bay Recreation Department map. */}
          <section id="distances" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              Leg distances and restrooms
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              These are the two numbers that decide a walk: how far apart the
              access points are, and where you can stop. Both come from the
              official Geneva Lake Shore Path map published by the Williams Bay
              Recreation Department. To plan a section, pick two endpoints and
              add the legs between them — the seven legs total 21 miles.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
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
            </div>
          </section>

          {/* Suggested section walks — captures long-tail intent like
              "shore path short walk", "shore path with kids", "shore path sunset". */}
          <section id="which-section" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              Which section should you walk?
            </h2>
            <p className="text-slate-700 leading-relaxed mb-3">
              Almost nobody walks all 21 miles, and the question we actually get
              is narrower: which piece of it is worth an afternoon? The answer
              depends less on scenery — it is beautiful nearly everywhere — than
              on who you're walking with and how much daylight you have.
            </p>
            <p className="text-slate-700 leading-relaxed mb-3">
              <strong>First visit to the lake?</strong> Start downtown, where the
              path is flat and the landmarks come quickly.{" "}
              <strong>Walking with kids?</strong> Stay in Williams Bay, where the
              distance between a beach and a bathroom is short.{" "}
              <strong>Out for sunset?</strong> Go west, where the shoreline faces
              the light.{" "}
              <strong>Have half a day and a second driver?</strong> Walk a full
              leg one-way and eat at the other end. Each of the four below starts
              and finishes at a public access point with parking.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {SECTION_WALKS.map((w) => (
                <article
                  key={w.name}
                  className="rounded-md border border-slate-200 bg-white p-5"
                >
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
                    {w.audience}
                  </p>
                  <h3 className="font-display text-lg text-slate-900 tracking-tight mb-2">
                    {w.name}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">
                    {w.why}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-slate-500 font-mono uppercase tracking-wider">Start</dt>
                    <dd className="text-slate-900">{w.from}</dd>
                    <dt className="text-slate-500 font-mono uppercase tracking-wider">End</dt>
                    <dd className="text-slate-900">{w.to}</dd>
                    <dt className="text-slate-500 font-mono uppercase tracking-wider">Distance</dt>
                    <dd className="text-slate-900 font-mono">{w.miles}</dd>
                    <dt className="text-slate-500 font-mono uppercase tracking-wider">Time</dt>
                    <dd className="text-slate-900 font-mono">{w.time}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          {/* Parking and access — pulled out of the FAQ because "shore path
              parking" is one of the highest-intent searches this page gets. */}
          <section id="parking" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              Parking and access points
            </h2>
            <p className="text-slate-700 leading-relaxed mb-3">
              The Shore Path has no single trailhead. You join it wherever a
              public park, beach, or pier touches the water, which is why
              planning a walk really means planning where to leave the car. The
              six below are the practical ones — each has parking, each puts you
              on the path within a minute or two of the lot, and most have a
              restroom.
            </p>
            <ul className="space-y-3 mb-4">
              {ACCESS_POINTS.map((a) => (
                <li
                  key={a.name}
                  className="rounded-md border border-slate-200 bg-white p-4"
                >
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                    {a.where}
                  </p>
                  <p className="font-display text-lg text-slate-900 leading-snug">
                    {a.name}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed mt-1">
                    {a.note}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-slate-700 leading-relaxed mb-3">
              Two rules that keep the arrangement working. Don't block private
              driveways or park on the narrow lakefront lanes that serve the
              homes the path crosses — those are residential streets, not
              overflow lots. And check fees and hours before you go: beach
              day-use charges, state park stickers, and municipal lot rates all
              change seasonally, and non-resident rates differ from village to
              village.
            </p>
            <p className="text-slate-700 leading-relaxed">
              For the full detail on each beach and boat launch — addresses,
              what's charged, when the lifeguards are on — see our{" "}
              <Link to="/guides/lake-geneva-public-access-guide" className="text-blue-700 hover:underline font-medium">
                public access guide
              </Link>
              . For the south-shore trailhead specifically, the{" "}
              <Link to="/guides/big-foot-beach-state-park" className="text-blue-700 hover:underline font-medium">
                Big Foot Beach State Park guide
              </Link>{" "}
              covers the sticker, the trails behind the beach, and the
              campground.
            </p>
          </section>

          {/* Seasonal guidance, consolidated. This material used to be
              scattered across FAQ answers and a PlanCard bullet. */}
          <section id="seasons" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-3 pb-2 border-b border-slate-200">
              Walking the path through the year
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              The walking season runs from late spring through October. The path
              is open year-round in the sense that the easement doesn't close,
              but conditions decide the experience more than the calendar does.
            </p>

            {/* Measured crowding, from logged walks. Sits above the seasonal
                write-ups because it either supports what they claim or corrects
                them, and the reader should see the data first. */}
            <div className="mb-6">
              <PathAlmanac />
            </div>

            <h3 className="font-display text-xl text-slate-900 tracking-tight mb-1.5">
              Late spring
            </h3>
            <p className="text-slate-700 leading-relaxed mb-4">
              The quiet stretch before the season starts. Foot traffic is light
              and the lake is still visible through trees that haven't fully
              leafed out. Low spots hold water after rain, and the lake is cold
              enough that the wind coming off it will surprise you — layers
              matter more in May than in July.
            </p>
            <h3 className="font-display text-xl text-slate-900 tracking-tight mb-1.5">
              Summer
            </h3>
            <p className="text-slate-700 leading-relaxed mb-4">
              The busiest months, and the ones where timing pays. Weekday
              mornings are markedly quieter than weekend afternoons, downtown
              parking fills first, and the open shoreline offers very little
              shade in the middle of the day. Start early, carry water, and if
              you only have a weekend, walk before the boat traffic builds.
            </p>
            <h3 className="font-display text-xl text-slate-900 tracking-tight mb-1.5">
              October
            </h3>
            <p className="text-slate-700 leading-relaxed mb-4">
              The local pick, and not a close call — clear light, cool air, the
              crowds gone, and the far shore visible across the water in a way it
              rarely is in August haze. Daylight is the constraint; plan the
              turnaround so you're not finishing a wooded stretch in the dark.
            </p>
            <h3 className="font-display text-xl text-slate-900 tracking-tight mb-1.5">
              Winter
            </h3>
            <p className="text-slate-700 leading-relaxed mb-4">
              Walkable in places, but the path is not maintained for snow. What
              gets cleared, when anything does, is the paved downtown stretch
              near Library Park and the Riviera; the grass, gravel, and
              stone-step sections do not, and ice forms first along the edge
              closest to the water. Treat a winter walk as an out-and-back on a
              section you can see, and turn around rather than pushing through an
              unbroken stretch.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Before any walk, two pages on this site are worth a glance: the{" "}
              <Link to="/lake-geneva-weather" className="text-blue-700 hover:underline font-medium">
                Lake Geneva weather page
              </Link>{" "}
              for the forecast and water temperature, and the{" "}
              <Link to="/lake-geneva-webcams" className="text-blue-700 hover:underline font-medium">
                lake webcams
              </Link>{" "}
              for what the shoreline actually looks like right now — the fastest
              way to know whether the wind is up before you drive over.
            </p>
          </section>

          {/* Plan your walk — practical block. Captures "what to bring",
              "what to wear", "best time", and reinforces etiquette. */}
          <section id="plan" className="scroll-mt-24 mb-12">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight mb-4 pb-2 border-b border-slate-200">
              Plan your walk
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <PlanCard
                icon={<Backpack className="h-4 w-4 text-blue-700" />}
                title="What to bring"
                items={[
                  "Water — limited fountains",
                  "Sunscreen (open shoreline)",
                  "Cash or card for a stop",
                  "Phone — service is spotty in coves",
                ]}
              />
              <PlanCard
                icon={<Footprints className="h-4 w-4 text-blue-700" />}
                title="What to wear"
                items={[
                  "Closed-toe walking shoes",
                  "Layers — lake wind is real",
                  "No flip-flops on rocky stretches",
                  "Leash for the dog",
                ]}
              />
              <PlanCard
                icon={<Clock className="h-4 w-4 text-blue-700" />}
                title="When to go"
                items={[
                  "Mornings: quiet, soft light",
                  "Summer weekdays beat weekends",
                  "Sunset on the west shore",
                  "October is the local secret",
                ]}
              />
              <PlanCard
                icon={<Sun className="h-4 w-4 text-blue-700" />}
                title="Path etiquette"
                items={[
                  "Stay on the path — no lawns",
                  "Keep voices down (homes)",
                  "Don't photograph people",
                  "Pick up after your dog",
                ]}
              />
            </div>
            <p className="text-xs text-slate-500 italic mt-4">
              The path is a public easement through people's front yards.
              How you walk it is how it stays open.
            </p>
          </section>

          {/* FAQs */}
          <section id="faqs" className="scroll-mt-24 mb-12">
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

          {/* Resident-intent block sits above the related grid on purpose:
              people who love the lake enough to walk all of it are the readers
              most likely to want the living-here cluster. */}
          <SoftRealEstateCTA variant="neighborhoods" />
          <p className="text-sm text-slate-600 leading-relaxed mt-3">
            If you've gotten as far as walking the whole shoreline, the two next
            reads are the{" "}
            <Link to="/guides/lake-geneva-neighborhoods" className="text-blue-700 hover:underline font-medium">
              neighborhood guide
            </Link>{" "}
            — which town each stretch of the path belongs to and what living
            there is like — and the{" "}
            <Link to="/guides/moving-to-lake-geneva" className="text-blue-700 hover:underline font-medium">
              guide to moving here
            </Link>
            , for the practical side: schools, winters, commutes, and what
            year-round life on the lake actually asks of you.
          </p>

          {/* Related guides */}
          <section className="mt-12 mb-12 pt-8 border-t border-slate-200">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
              Keep reading
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <RelatedCard
                to="/guides/lake-geneva-public-access-guide"
                title="Public beaches & boat launches"
                blurb="Every public access point on the lake — parking, fees, and what to expect."
              />
              <RelatedCard
                to="/guides/big-foot-beach-state-park"
                title="Big Foot Beach State Park"
                blurb="The south-shore trailhead: trails, beach, campground, and the state park sticker."
              />
              <RelatedCard
                to="/lake-geneva-weather"
                title="Lake Geneva weather"
                blurb="Forecast and water temperature — worth a look before you commit to a leg."
              />
              <RelatedCard
                to="/lake-geneva-webcams"
                title="Lake Geneva webcams"
                blurb="What the shoreline looks like right now, before you drive over."
              />
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

          </article>

          {/* Contents — desktop sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
                On this page
              </p>
              <nav aria-label="On this page">
                <ul className="space-y-2 text-sm">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="text-slate-600 hover:text-blue-700 leading-snug block"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        </div>
      </main>

      {walkingOpen && (
        <Suspense fallback={null}>
          <ShorePathWalkingMode
            open={walkingOpen}
            onOpenChange={setWalkingOpen}
            stops={stops}
            initialIndex={walkingInitialIndex}
          />
        </Suspense>
      )}

      {guidedOpen && (
        <Suspense fallback={null}>
          <GuidedWalkController
            open={guidedOpen}
            onClose={() => setGuidedOpen(false)}
            stops={stops}
            onJumpToStop={handleJumpToStop}
            onArrival={(arrival) => void register.recordVisit(arrival)}
          />
        </Suspense>
      )}

      {/* Three things want the bottom of the screen — the guided-walk sheet, the
          arrival card it raises, and the conditions question — so they take
          strict precedence rather than stacking into an unreadable pile.
          The conditions question also waits for the walk to END: asked at stop 1
          of 16 it would collect an answer about one stop and label the whole
          outing with it. */}
      {register.newlyEarned ? (
        <RegisterMilestoneCard
          entry={register.newlyEarned}
          onDismiss={register.dismissNewlyEarned}
        />
      ) : (
        !guidedOpen &&
        register.conditionsPrompt && (
          <ConditionsPrompt
            onAnswer={(answer) => void register.recordConditions(answer)}
            onDismiss={register.dismissConditionsPrompt}
          />
        )
      )}
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

function PlanCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-display text-base text-slate-900">{title}</h3>
      </div>
      <ul className="space-y-1 text-sm text-slate-700">
        {items.map((it) => (
          <li key={it} className="leading-snug">• {it}</li>
        ))}
      </ul>
    </div>
  );
}