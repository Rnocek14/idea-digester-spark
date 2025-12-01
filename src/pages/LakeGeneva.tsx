import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { BriefHero } from "@/components/BriefHero";
import { StoryCard } from "@/components/StoryCard";

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
};

const categoryOrder = ["news", "schools", "events", "dining", "real_estate", "community"];

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
        .limit(20);

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
          business:business_profiles(name, logo_url, website)
        `)
        .eq("slot_id", "newsletter_header")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (error) throw error;
      return data ? { ...data.business, placementId: data.id, businessId: data.business_id } as Sponsor & { placementId: string; businessId: string } : null;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <main>
        {/* Featured Story Spotlight */}
        {featured && (
          <section className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
              <div className="grid gap-6 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch">
                {/* Featured Story with Image Overlay */}
                <article className="relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
                  {featured.image_url && (
                    <div className="relative h-64 sm:h-80">
                      <img
                        src={featured.image_url}
                        alt={featured.title}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 text-white">
                    <p className="mb-2 text-xs font-semibold tracking-[0.22em] uppercase text-blue-200">
                      Top story
                    </p>
                    <h1 className="font-display text-2xl sm:text-3xl leading-tight">
                      {featured.title}
                    </h1>
                    {(featured.content_website || featured.content_lg_base || featured.summary) && (
                      <p className="mt-2 text-sm text-gray-100 line-clamp-3">
                        {featured.content_website || featured.content_lg_base || featured.summary}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-200">
                      {featured.category && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5">
                          {getCategoryEmoji(featured.category)}
                          <span className="capitalize">
                            {featured.category.replace('_', ' ')}
                          </span>
                        </span>
                      )}
                      <span>{getRelativeTime(featured.publish_date || featured.created_at) || 'Today'} • 3 min read</span>
                      {featured.original_url && (
                        <a
                          href={featured.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-blue-200 hover:text-white transition-colors"
                        >
                          Read more
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>

                {/* Also Today Mini List */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-3">
                      Also today
                    </p>
                    <ul className="space-y-3">
                      {restStories.slice(0, 4).map((story) => (
                        <li key={story.id}>
                          <button
                            onClick={() =>
                              document.getElementById(
                                (story.category || 'other').toLowerCase(),
                              )?.scrollIntoView({ behavior: 'smooth' })
                            }
                            className="text-left group"
                          >
                            <p className="text-sm text-brand group-hover:text-brand-accent transition-colors line-clamp-2">
                              {story.title}
                            </p>
                            {story.category && (
                              <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                                {getCategoryEmoji(story.category)}
                                <span className="capitalize">{story.category.replace('_', ' ')}</span>
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Hero Section */}
        {stories.length > 0 && <BriefHero stories={stories} />}

        {/* Sponsor Block */}
        {sponsor && (
          <section className="border-b border-gray-100 bg-white">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
              <Card className="p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-blue-100">
                <div className="flex items-center gap-4">
                  {sponsor.logo_url && (
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className="h-14 w-14 object-contain rounded-lg bg-white p-2"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-brand-accent uppercase tracking-[0.15em] mb-1">
                      Presented By
                    </p>
                    <p className="text-base font-semibold text-brand">{sponsor.name}</p>
                    {sponsor.website && (
                      <a
                        href={`https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.website)}&source=web_brief&bid=${sponsor.businessId}&pid=${sponsor.placementId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-accent hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                      >
                        Visit Website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* Stories by Category */}
        {storiesLoading ? (
          <div className="text-center py-16 text-gray-500">
            Loading today's stories...
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No stories published yet. Check back soon!
          </div>
        ) : (
          <section className="bg-gray-50 border-t border-gray-100">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-10">
              {sortedCategories.map((category) => (
                <div key={category} id={category} className="scroll-mt-24">
                  <div className="flex items-baseline justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryEmoji(category)}</span>
                      <h2 className="font-display text-lg sm:text-xl capitalize text-brand">
                        {category.replace('_', ' ')}
                      </h2>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-gray-500 border border-gray-200">
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
            </div>
          </section>
        )}

        {/* Subscribe CTA */}
        <section id="subscribe" className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Newsletter
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl tracking-tight text-brand">
              Get the Lake Geneva Brief in your inbox
            </h2>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
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
                className="flex-1 max-w-sm rounded-full border-gray-300 bg-gray-50 px-4 py-2.5 text-sm focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-blue-100"
                disabled={isSubscribing}
              />
              <Button
                type="submit"
                disabled={isSubscribing}
                className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {isSubscribing ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </form>

            <p className="mt-3 text-[11px] text-gray-400">
              2–4 emails per week. Unsubscribe anytime.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default LakeGeneva;
