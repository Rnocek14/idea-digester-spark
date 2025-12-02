import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { StoryCard } from "@/components/StoryCard";
import WeatherWidget from "@/components/WeatherWidget";

type Story = {
  id: string;
  title: string;
  content_website: string | null;
  content_lg_base: string | null;
  summary: string | null;
  category: string | null;
  publish_date: string | null;
  original_url: string | null;
  image_url: string | null;
  created_at: string;
};

type Sponsor = {
  name: string;
  logo_url: string | null;
  website: string | null;
  placementId?: string;
  businessId?: string;
  category?: string | null;
  market_fact_override?: string | null;
};

const categoryOrder = ["news", "schools", "events", "dining", "real_estate", "community"];

// Real estate market insights for rotating display
const REAL_ESTATE_MARKET_FACTS = [
  "Median Lake Geneva home prices are up year-over-year, with limited inventory keeping it a seller's market.",
  "Well-kept homes near the lakefront are seeing strong demand and faster-than-average closings.",
  "Move-in-ready homes in the $400k–$700k range are some of the most competitive in the Lake Geneva area.",
  "Inventory remains low compared to pre-2020 levels, which is supporting higher sale prices.",
  "Homes that are priced correctly and well-presented often go under contract in a few weeks.",
];

const isRealEstateSponsor = (sponsor: Sponsor | null) => {
  if (!sponsor) return false;
  
  // Normalize: lowercase and convert underscores/hyphens to spaces
  const label = (sponsor.category || sponsor.name || "")
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
  
  return (
    label.includes("real estate") ||
    label.includes("realtor") ||
    label.includes("realty") ||
    label.includes("broker") ||
    label.includes("properties")
  );
};

const getRealEstateMarketFact = (sponsor: Sponsor | null) => {
  // If sponsor has a custom line, always prefer it
  if (sponsor?.market_fact_override) return sponsor.market_fact_override;

  // Simple, stable rotation: one fact per day
  if (REAL_ESTATE_MARKET_FACTS.length === 0) return null;

  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const idx = dayIndex % REAL_ESTATE_MARKET_FACTS.length;

  return REAL_ESTATE_MARKET_FACTS[idx];
};

const getRelativeTime = (dateString?: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

const getCategoryEmoji = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "news": return "📰";
    case "events": return "🎉";
    case "dining": return "🍽️";
    case "real_estate": return "🏡";
    case "community": return "🤝";
    case "schools": return "🏫";
    default: return "📍";
  }
};

const LakeGeneva = () => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');

  useEffect(() => {
    document.title = "Lake Geneva Brief – Today's Local News";
  }, []);

  // Fetch today's published stories
  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["public-stories"],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .gte("created_at", weekAgo.toISOString())
        .order("publish_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as any[];
    },
    staleTime: 60000,
  });

  // Query sponsor
  const { data: sponsor } = useQuery({
    queryKey: ["public-sponsor"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("ad_placements")
        .select(`
          id,
          business_id,
          business:business_profiles(name, logo_url, website, category)
        `)
        .eq("slot_id", "newsletter_header")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (error) throw error;
      return data ? { 
        ...data.business, 
        placementId: data.id, 
        businessId: data.business_id 
      } as Sponsor & { placementId: string; businessId: string } : null;
    },
    staleTime: 300000,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (subscriberEmail: string) => {
      const { error } = await supabase
        .from("subscribers")
        .insert({
          email: subscriberEmail,
          status: "active",
          source: "website",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Successfully subscribed!", {
        description: "You'll receive the Lake Geneva Brief in your inbox.",
      });
      setEmail("");
      setIsSubscribing(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Already subscribed", {
          description: "This email is already on our list.",
        });
      } else {
        toast.error("Subscription failed", {
          description: "Please try again later.",
        });
      }
      setIsSubscribing(false);
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }
    setIsSubscribing(true);
    subscribeMutation.mutate(email);
  };

  // Featured story and rest
  const featured = stories[0];
  const restStories = stories.slice(1);

  // Group remaining stories by category (excluding featured)
  const storiesByCategory = restStories.reduce((acc, story) => {
    const cat = story.category?.toLowerCase() || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  // Sort categories by predefined order
  const sortedCategories = categoryOrder
    .filter((cat) => storiesByCategory[cat]?.length > 0)
    .concat(Object.keys(storiesByCategory).filter((cat) => !categoryOrder.includes(cat)));

  // Filter visible categories based on active selection
  const visibleCategories =
    activeCategory === 'all'
      ? sortedCategories
      : sortedCategories.filter((c) => c === activeCategory);

  return (
    <PageShell
      title="Lake Geneva Brief – Local News, Simplified"
      description="Fast, trustworthy updates on Lake Geneva city hall, schools, events, and real estate."
    >
      {/* Unified Hero Section */}
      {featured && (
        <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
                {/* Left: greeting, headline, category links, featured card */}
                <div className="space-y-5">
                  {/* Greeting + headline */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Good morning, Lake Geneva
                    </p>
                    <h1 className="font-semibold text-2xl sm:text-3xl md:text-[32px] leading-tight text-slate-900">
                      Here's what's happening this week
                    </h1>
                    <p className="max-w-xl text-sm text-slate-600 leading-relaxed">
                      Short, trustworthy updates on city hall, schools, events, and real estate — in under 5 minutes.
                    </p>
                    <div className="mt-3">
                      <WeatherWidget />
                    </div>
                  </div>

                  {/* Category quick links */}
                  <div className="flex flex-wrap gap-2">
                    {sortedCategories.slice(0, 4).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(cat);
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <span>{getCategoryEmoji(cat)}</span>
                        <span className="capitalize font-medium">
                          {cat.replace('_', ' ')}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Featured story card */}
                  <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <div className="relative h-56 sm:h-60">
                      {featured.image_url && (
                        <img
                          src={featured.image_url}
                          alt={featured.title}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                          Top story
                        </p>
                        <h2 className="text-lg sm:text-xl font-semibold text-white">
                          {featured.title}
                        </h2>
                        {(featured.content_website || featured.content_lg_base || featured.summary) && (
                          <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-slate-100/90">
                            {featured.content_website || featured.content_lg_base || featured.summary}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-200/90">
                          {featured.category && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5">
                              {getCategoryEmoji(featured.category)}
                              <span className="capitalize">
                                {featured.category.replace('_', ' ')}
                              </span>
                            </span>
                          )}
                          <span className="opacity-80">
                            {getRelativeTime(featured.publish_date || featured.created_at) || 'Today'} · 3 min read
                          </span>
                        </div>
                      </div>
                      {featured.original_url && (
                        <a
                          href={featured.original_url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0"
                        >
                          <span className="sr-only">Read more</span>
                        </a>
                      )}
                    </div>
                  </article>
                </div>

                {/* Right: Also today */}
                <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Also today
                  </p>
                  <ul className="mt-3 space-y-3">
                    {restStories.slice(0, 5).map((story) => (
                      <li key={story.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(
                              (story.category || 'other').toLowerCase(),
                            );
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full text-left"
                        >
                          <p className="text-sm font-medium text-slate-900 line-clamp-2 hover:text-blue-700 transition-colors">
                            {story.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            {story.category && (
                              <>
                                <span>{getCategoryEmoji(story.category)}</span>
                                <span className="capitalize">
                                  {story.category.replace('_', ' ')}
                                </span>
                                <span className="opacity-40">•</span>
                              </>
                            )}
                            <span>{getRelativeTime(story.publish_date || story.created_at)}</span>
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
            </div>
          </section>
        )}

        {/* Sponsor Block */}
        {sponsor && (
          <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-8">
              <Card className="p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-blue-100">
                <div className="flex items-center gap-4">
                  {sponsor.logo_url && (
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className="h-14 w-14 object-contain rounded-lg bg-white p-2"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-[0.15em] mb-1">
                      Presented By
                    </p>
                    <p className="text-base font-semibold text-slate-900">{sponsor.name}</p>
                    {sponsor.website && (
                      <a
                        href={`https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.website)}&source=web_brief&bid=${sponsor.businessId}&pid=${sponsor.placementId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                      >
                        Visit Website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Market Insight for Real Estate Sponsors */}
                {isRealEstateSponsor(sponsor) && (
                  <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                    <span className="font-semibold mr-1">🏡 Lake Geneva Market Insight:</span>
                    <span>{getRealEstateMarketFact(sponsor)}</span>
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Stories by Category */}
          {storiesLoading ? (
            <div className="text-center py-16 text-slate-500">
              Loading today's stories...
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              No stories published yet. Check back soon!
            </div>
          ) : (
            <>
              {/* Category Filter Pills */}
              <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-4 sticky top-[73px] z-20">
                <div className="flex flex-wrap gap-2">
                  {['all', ...categoryOrder].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                        activeCategory === cat
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-500 hover:text-blue-700"
                      }`}
                    >
                      {cat === 'all' ? 'All stories' : `${getCategoryEmoji(cat)} ${cat.replace('_', ' ')}`}
                    </button>
                  ))}
                </div>
              </section>

              <section className="py-10">
                {visibleCategories.map((category) => (
                <div key={category} id={category} className="scroll-mt-24">
                  <div className="flex items-baseline justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryEmoji(category)}</span>
                      <h2 className="font-semibold text-lg sm:text-xl capitalize text-slate-900">
                        {category.replace('_', ' ')}
                      </h2>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-500 border border-slate-200">
                        {storiesByCategory[category].length} {storiesByCategory[category].length === 1 ? 'story' : 'stories'}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                    {storiesByCategory[category].map((story) => {
                      const time = getRelativeTime(story.publish_date || story.created_at);
                      let source: string | null = (story as any).source?.name || null;

                      // Fallback: derive domain from original_url
                      if (!source && story.original_url) {
                        try {
                          const url = new URL(story.original_url);
                          source = url.hostname.replace(/^www\./, '');
                        } catch {
                          // ignore parse error
                        }
                      }

                      return (
                        <StoryCard
                          key={story.id}
                          title={story.title}
                          summary={story.content_website || story.content_lg_base || story.summary}
                          imageUrl={story.image_url}
                          category={story.category}
                          url={story.original_url}
                          meta={{ time, source }}
                        />
                      );
                    })}
                  </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {/* Subscribe CTA */}
          <section id="subscribe" className="scroll-mt-24 -mx-4 sm:-mx-6 lg:-mx-8 border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Newsletter
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                Get the Lake Geneva Brief in your inbox
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                A fast, friendly rundown of what matters in Lake Geneva. No spam, no noise.
              </p>

            <form
              onSubmit={handleSubscribe}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 max-w-sm rounded-full border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                disabled={isSubscribing}
              />
              <Button
                type="submit"
                disabled={isSubscribing}
                className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {isSubscribing ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </form>

              <p className="mt-3 text-[11px] text-slate-400">
                2–4 emails per week. Unsubscribe anytime.
              </p>
          </div>
        </section>
      </PageShell>
    );
  };

export default LakeGeneva;
