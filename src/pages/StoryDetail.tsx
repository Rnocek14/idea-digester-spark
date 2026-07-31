import { usePageView, pillarFromCategory } from "@/lib/trackStoryEvent";
import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { PageMeta } from "@/components/PageMeta";
import { StoryReactions } from "@/components/StoryReactions";
import { extractStoryId, storyPath } from "@/lib/slug";
import { format } from "date-fns";

/**
 * Map of category → in-house guides we can deep-link from a story's
 * context block. Keeps thin story pages from being dead-ends and
 * funnels link equity to our cornerstone guides.
 */
const CATEGORY_GUIDES: Record<string, { title: string; path: string }[]> = {
  events: [
    { title: "This weekend at Lake Geneva", path: "/guides/things-to-do-lake-geneva-this-weekend" },
    { title: "Full Lake Geneva events calendar", path: "/events" },
  ],
  dining: [
    { title: "Best restaurants in Lake Geneva", path: "/best-of/restaurants-lake-geneva" },
    { title: "Friday fish fry guide", path: "/eats/fish-fry" },
  ],
  food: [
    { title: "Best restaurants in Lake Geneva", path: "/best-of/restaurants-lake-geneva" },
    { title: "Friday fish fry guide", path: "/eats/fish-fry" },
  ],
  real_estate: [
    { title: "Lake Geneva market report", path: "/market-report" },
    { title: "Moving to Lake Geneva", path: "/guides/moving-to-lake-geneva" },
  ],
  weather: [
    { title: "Lake Geneva weather & 7-day forecast", path: "/lake-geneva-weather" },
    { title: "Live Lake Geneva webcams", path: "/lake-geneva-webcams" },
  ],
  incidents: [
    { title: "Recent incidents in Lake Geneva", path: "/incidents" },
  ],
  civic: [
    { title: "Lake Geneva FAQ", path: "/guides/lake-geneva-faq" },
  ],
  community: [
    { title: "Community voices", path: "/community/voices" },
    { title: "Local love", path: "/community/local-love" },
  ],
  jobs: [
    { title: "Lake Geneva job board", path: "/jobs" },
  ],
};

function sourceDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Per-story permalink. Exists primarily for SEO: a stable, indexable URL
 * with NewsArticle + BreadcrumbList JSON-LD per story so Google can place
 * the page in Top Stories / News carousels. The body is a short summary
 * card — the canonical article still lives at the original source URL,
 * which we link to prominently.
 */
export default function StoryDetail() {
  const { idOrSlug = "" } = useParams();
  const id = extractStoryId(idOrSlug);

  const { data: story, isLoading, error } = useQuery({
    queryKey: ["story", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select(
          "id, title, summary, content, category, image_url, original_url, publish_date, created_at, updated_at, event_date, event_time, geo_label, geo_tier, author, metadata"
        )
        .eq("id", id)
        .in("status", ["published", "auto_published", "approved"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  // Record the read. Gated on the story having loaded so a failed fetch is not
  // counted as a view, and keyed on the story id so a slug change is not a new read.
  usePageView({
    pillar: pillarFromCategory(story?.category),
    entityType: "content_queue",
    entityId: story?.id ?? null,
    slug: idOrSlug,
    enabled: !!story?.id,
  });

  const { data: related = [] } = useQuery({
    queryKey: ["story-related", story?.category, id],
    queryFn: async () => {
      if (!story?.category) return [];
      const { data } = await supabase
        .from("content_queue")
        .select("id, title, category")
        .in("status", ["published", "auto_published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .eq("category", story.category)
        .neq("id", id)
        .order("publish_date", { ascending: false, nullsFirst: false })
        .limit(5);
      return data || [];
    },
    enabled: !!story?.category,
  });

  // Canonical redirect: if the URL is missing the slug prefix, replace it
  // in-place with the pretty version (no extra render trip for crawlers).
  useEffect(() => {
    if (!story) return;
    const pretty = storyPath(story.id, story.title);
    if (`/stories/${idOrSlug}` !== pretty && typeof window !== "undefined") {
      window.history.replaceState({}, "", pretty);
    }
  }, [story, idOrSlug]);

  if (!id) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PublicHeader />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="h-6 w-24 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="h-10 w-3/4 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-4 w-full bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
        </main>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <PublicHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Story not found</h1>
          <p className="text-slate-600 mb-6">
            This story may have been removed or hasn't been published yet.
          </p>
          <Link to="/" className="text-blue-700 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to the Brief
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const path = storyPath(story.id, story.title);
  const publishedISO = story.publish_date || story.created_at;
  const modifiedISO = story.updated_at || publishedISO;
  const description =
    story.summary ||
    (story.content ? story.content.slice(0, 180).replace(/\s+/g, " ").trim() + "…" : story.title);

  const guides = CATEGORY_GUIDES[story.category || ""] || [];
  const domain = sourceDomain(story.original_url);
  const categoryLabel = (story.category || "news").replace(/_/g, " ");
  const placeLabel = story.geo_label || "Lake Geneva, Wisconsin";
  const dateLong = publishedISO
    ? format(new Date(publishedISO), "MMMM d, yyyy")
    : null;

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: story.title,
      description,
      url: `https://lakegenevabrief.com${path}`,
      mainEntityOfPage: `https://lakegenevabrief.com${path}`,
      datePublished: publishedISO,
      dateModified: modifiedISO,
      image: story.image_url ? [story.image_url] : undefined,
      articleSection: story.category || "News",
      author: story.author
        ? { "@type": "Person", name: story.author }
        : { "@type": "Organization", name: "Lake Geneva Brief" },
      publisher: {
        "@type": "NewsMediaOrganization",
        name: "Lake Geneva Brief",
        url: "https://lakegenevabrief.com",
      },
      isAccessibleForFree: true,
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["h1", ".story-lede"],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Lake Geneva Brief", item: "https://lakegenevabrief.com/" },
        { "@type": "ListItem", position: 2, name: story.category || "Stories", item: `https://lakegenevabrief.com/?category=${story.category || ""}` },
        { "@type": "ListItem", position: 3, name: story.title, item: `https://lakegenevabrief.com${path}` },
      ],
    },
  ];

  // NOTE: a story-level FAQPage used to be emitted here, asking "Where can I read the
  // full story about {title}?" and "When was this story published?". It was removed
  // deliberately. Neither question contains a fact about the world — they restate the
  // page's own metadata — and Google restricted FAQ rich results to government and
  // health domains in 2023, so it earned nothing. Emitted on every story across every
  // city it is machine-generated schema padding, which is the one thing on this site
  // that looked like a spam signal. Do not add it back.

  const dateLabel = publishedISO
    ? format(new Date(publishedISO), "EEEE, MMMM d, yyyy")
    : null;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <PageMeta
        title={`${story.title} — Lake Geneva Brief`}
        description={description}
        path={path}
        ogType="article"
        ogImage={story.image_url || undefined}
        jsonLd={jsonLd}
      />
      <PublicHeader />

      <main className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-8 flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[13px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> The Brief
        </Link>

        <div className="flex items-center gap-2 mb-3 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
          {story.category && <span>{story.category.replace(/_/g, " ")}</span>}
          {story.geo_label && (
            <>
              <span className="text-slate-500">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {story.geo_label}
              </span>
            </>
          )}
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-4"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {story.title}
        </h1>

        {dateLabel && (
          <p className="text-[13px] text-slate-500 flex items-center gap-1.5 mb-6">
            <Calendar className="h-3.5 w-3.5" />
            {dateLabel}
            {story.author && <span className="ml-1">· by {story.author}</span>}
          </p>
        )}

        {story.image_url && (
          <img
            src={story.image_url}
            alt={story.title}
            className="w-full rounded-md mb-6 aspect-[16/9] object-cover bg-stone-100"
            loading="eager"
          />
        )}

        {story.summary && (
          <p
            className="story-lede text-lg text-slate-700 leading-relaxed mb-5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic" }}
          >
            {story.summary}
          </p>
        )}

        {story.content && (
          <div className="prose prose-slate max-w-none text-[15.5px] leading-relaxed text-slate-800 mb-8 whitespace-pre-line">
            {story.content}
          </div>
        )}

        {/* About this story — always rendered. Adds on-page context and
            internal links so the page isn't thin when content is empty,
            and gives Google something to summarize for AI Overviews. */}
        <aside className="rounded-md border border-slate-200 bg-white px-5 py-4 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            About this story
          </p>
          <p className="text-[14.5px] text-slate-700 leading-relaxed">
            This is a Lake Geneva Brief summary of a{" "}
            <span className="capitalize">{categoryLabel}</span> story affecting{" "}
            {placeLabel}
            {domain ? (
              <>
                , as reported by{" "}
                <a
                  href={story.original_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  {domain}
                </a>
              </>
            ) : null}
            {dateLong ? <> on {dateLong}</> : null}. We track local coverage
            across {placeLabel} and surface what matters in one daily read — the{" "}
            <Link to="/today" className="text-blue-700 hover:underline">
              Lake Report
            </Link>
            .
          </p>
          {guides.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
              <span className="text-slate-500">Related:</span>
              {guides.map((g, i) => (
                <span key={g.path} className="text-slate-700">
                  <Link to={g.path} className="text-blue-700 hover:underline">
                    {g.title}
                  </Link>
                  {i < guides.length - 1 ? <span className="text-slate-500 ml-3">·</span> : null}
                </span>
              ))}
            </div>
          )}
        </aside>

        {story.event_date && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-amber-700 mb-1">
              On the calendar
            </p>
            <p className="text-sm text-amber-900">
              {format(new Date(story.event_date), "EEEE, MMMM d")}
              {story.event_time ? ` · ${story.event_time}` : ""}
            </p>
          </div>
        )}

        {story.original_url && (
          <a
            href={story.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Read the full story at the source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {related.length > 0 && (
          <section className="mt-12 pt-6 border-t border-slate-200">
            <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
              More {story.category?.replace(/_/g, " ") || "stories"}
            </h2>
            <ul className="space-y-2.5">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    to={storyPath(r.id, r.title)}
                    className="text-[15px] text-slate-800 hover:text-blue-700 leading-snug"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <StoryReactions storyId={story.id} />
      </main>

      <PublicFooter />
    </div>
  );
}