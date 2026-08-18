import { Link, useParams, Navigate } from "react-router-dom";
import { getSiteOrigin } from "@/lib/cityId";
import { ArrowLeft, ArrowRight, MapPin, Heart } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { StoryPlayer } from "@/components/shore-path/StoryPlayer";
import { StopSources, ThenAndNow } from "@/components/shore-path/StopSources";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";
import { useShorePathStopBySlug } from "@/hooks/useShorePathStopBySlug";

const PARENT_PATH = "/guides/lake-geneva-shore-path";
// Resolved per request — a literal host here would make every fleet city claim city #1.
const SITE = getSiteOrigin();

function buildMeta(stop: {
  name: string;
  community: string | null;
  approx_mile: number | null;
  description: string | null;
  story_long: string | null;
  short_label: string | null;
}) {
  const title = `${stop.name} — Lake Geneva Shore Path Guide`;
  // Description: first ~155 chars of story_long, or fall back to description.
  const source = (stop.story_long || stop.description || "")
    .replace(/\s+/g, " ")
    .trim();
  const desc =
    source.length > 0
      ? source.length <= 158
        ? source
        : `${source.slice(0, 155).trimEnd()}…`
      : `${stop.name} on the Lake Geneva Shore Path${
          stop.community ? ` in ${stop.community}` : ""
        }. History, what to look for, and how to find it.`;
  return { title, description: desc };
}

export default function LakeGenevaShorePathStop() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useShorePathStopBySlug(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-sm text-slate-500">Loading stop…</p>
        </div>
      </div>
    );
  }

  if (!data?.stop) {
    return <Navigate to={PARENT_PATH} replace />;
  }

  const { stop, prev, next } = data;
  const path = `${PARENT_PATH}/${stop.slug}`;
  const meta = buildMeta(stop);

  const attraction: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: stop.name,
    description: meta.description,
    url: `${SITE}${path}`,
    isAccessibleForFree: true,
    publicAccess: stop.is_public_landmark,
    containedInPlace: {
      "@type": "Place",
      name: stop.community || "Geneva Lake, Wisconsin",
    },
  };
  if (typeof stop.latitude === "number" && typeof stop.longitude === "number") {
    attraction.geo = {
      "@type": "GeoCoordinates",
      latitude: stop.latitude,
      longitude: stop.longitude,
    };
  }
  if (stop.hero_image_url) attraction.image = stop.hero_image_url;

  const jsonLd = [
    attraction,
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Lake Geneva Shore Path", path: PARENT_PATH },
      { name: stop.name, path },
    ]),
  ];

  const storyParagraphs = (stop.story_long || stop.description || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title={meta.title}
        description={meta.description}
        path={path}
        ogType="article"
        ogImage={stop.hero_image_url || undefined}
        jsonLd={jsonLd}
        keywords={[
          stop.name,
          `${stop.name} Lake Geneva`,
          `${stop.name} Shore Path`,
          stop.community ? `${stop.community} Wisconsin` : "Lake Geneva Wisconsin",
          "Lake Geneva Shore Path",
          "Geneva Lake walking path",
        ]}
      />
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-slate-700">Home</Link>
          <span className="mx-1.5">/</span>
          <Link to={PARENT_PATH} className="hover:text-slate-700">
            Lake Geneva Shore Path
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{stop.name}</span>
        </nav>

        {/* Header */}
        <header className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Stop {stop.order_index} of 16
            {stop.community && ` · ${stop.community}`}
            {stop.approx_mile != null && ` · Mile ${stop.approx_mile}`}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-slate-900 tracking-tight mt-1">
            {stop.name}
          </h1>
          {stop.description && (
            <p className="text-lg text-slate-700 leading-relaxed mt-3">
              {stop.description}
            </p>
          )}
        </header>

        {/* The same view a century earlier, beside the one you're looking at.
            Falls back to the modern image alone until an archive image has both
            a credit and a recorded rights status. */}
        <ThenAndNow
          historicalUrl={stop.historical_image_url}
          year={stop.historical_image_year}
          credit={stop.historical_image_credit}
          sourceUrl={stop.historical_image_source_url}
          rights={stop.historical_image_rights}
          modernUrl={stop.hero_image_url}
          stopName={stop.name}
        />

        {/* Audio */}
        {stop.audio_url && (
          <section className="mb-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
              Listen · narrated by The Brief
            </p>
            <StoryPlayer
              audioUrl={stop.audio_url}
              transcript={stop.audio_transcript}
              durationSec={stop.audio_duration_sec}
            />
          </section>
        )}

        {/* Story */}
        {storyParagraphs.length > 0 && (
          <section className="mb-8 space-y-4 text-slate-700 leading-relaxed">
            {storyParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {/* Look for */}
        {stop.look_for && (
          <section className="mb-6 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700 mb-1">
              Look for
            </p>
            <p className="text-sm text-amber-900 leading-snug">{stop.look_for}</p>
          </section>
        )}

        {/* Where the history came from. Sits directly under the story it backs,
            not buried at the foot of the page. */}
        <StopSources
          sources={stop.sources ?? []}
          confidence={stop.history_confidence}
        />

        {/* Local love prompt */}
        {stop.local_love_prompt && (
          <section className="mb-8 rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm italic text-slate-600 leading-snug mb-2">
              {stop.local_love_prompt}
            </p>
            <Link
              to="/community/local-love"
              className="inline-flex items-center gap-1.5 text-sm text-rose-700 hover:text-rose-900"
            >
              <Heart className="h-4 w-4" /> Share a memory
            </Link>
          </section>
        )}

        {/* Location */}
        {typeof stop.latitude === "number" && typeof stop.longitude === "number" && (
          <section className="mb-8">
            <a
              href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 underline"
            >
              <MapPin className="h-4 w-4" />
              Open in Google Maps
            </a>
          </section>
        )}

        {/* Prev / Next */}
        <nav className="mt-10 grid grid-cols-2 gap-3 border-t border-slate-200 pt-6">
          {prev ? (
            <Link
              to={`${PARENT_PATH}/${prev.slug}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-3 hover:border-slate-400"
            >
              <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <ArrowLeft className="h-3 w-3" /> Previous stop
              </span>
              <span className="block text-sm text-slate-800 mt-1">{prev.name}</span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              to={`${PARENT_PATH}/${next.slug}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-3 hover:border-slate-400 text-right"
            >
              <span className="flex items-center justify-end gap-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Next stop <ArrowRight className="h-3 w-3" />
              </span>
              <span className="block text-sm text-slate-800 mt-1">{next.name}</span>
            </Link>
          ) : (
            <div />
          )}
        </nav>

        {/* Back to full guide */}
        <div className="mt-6 text-center">
          <Link
            to={PARENT_PATH}
            className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to the full Shore Path guide
          </Link>
        </div>

        {/* Next-step links — a stop page was a dead end for search traffic
            arriving straight from Google. */}
        <section className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
            Keep reading
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                to: "/guides/things-to-do-lake-geneva",
                title: "Things to do in Lake Geneva",
                blurb: "What else is worth your time beyond the shoreline.",
              },
              {
                to: "/guides/where-to-stay-lake-geneva",
                title: "Where to stay",
                blurb: "Resorts, inns, and rentals — some of them right on the path.",
              },
              {
                to: "/lake-geneva-eats",
                title: "Where to eat after the walk",
                blurb: "Restaurants and patios near the downtown trailhead.",
              },
              {
                to: "/guides/lake-geneva-public-access-guide",
                title: "Beaches & boat launches",
                blurb: "Every public access point on Geneva Lake.",
              },
            ].map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="block rounded-md border border-slate-200 bg-white p-4 hover:border-blue-500 hover:shadow-sm transition-all"
              >
                <p className="font-display text-lg text-slate-900">{r.title}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{r.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-12">
          <SoftRealEstateCTA />
        </div>

        {/* Spacer so the sticky bar never covers the last block on phones. */}
        <div className="h-20 sm:h-0" aria-hidden="true" />
      </div>

      {/* Sticky "next stop" bar — lets a walker chain through the 16 stops
          without scrolling to the bottom of every page. */}
      {next && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-2 flex items-center gap-3">
            {prev && (
              <Link
                to={`${PARENT_PATH}/${prev.slug}`}
                aria-label={`Previous stop: ${prev.name}`}
                className="flex-shrink-0 rounded-md border border-slate-200 p-2 text-slate-600 hover:text-slate-900 hover:border-slate-400"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 leading-none">
                Stop {stop.order_index} of 16 · Up next
              </p>
              <p className="text-sm text-slate-900 truncate mt-0.5">{next.name}</p>
            </div>
            <Link
              to={`${PARENT_PATH}/${next.slug}`}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Next stop <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}