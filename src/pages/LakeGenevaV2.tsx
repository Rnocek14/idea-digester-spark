import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { StoryCard } from "@/components/StoryCard";
import WeatherWidget from "@/components/WeatherWidget";
import WeatherForecast from "@/components/WeatherForecast";
import LiveIncidentsSidebar from "@/components/LiveIncidentsSidebar";
import NightlifeWidget from "@/components/NightlifeWidget";
import NowHiringWidget from "@/components/NowHiringWidget";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import { StickySubscribeBanner } from "@/components/StickySubscribeBanner";
import { WelcomeModal } from "@/components/WelcomeModal";
import { PresentedBySection } from "@/components/PresentedBySection";
import { getSubscribeSource, getReferralSource } from "@/lib/referralTracking";
import { NavLink } from "@/components/NavLink";

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
  geo_tier?: number | null;
  geo_label?: string | null;
};

type Sponsor = {
  name: string;
  logo_url: string | null;
  website: string | null;
  placementId?: string;
  businessId?: string;
  category?: string | null;
  phone?: string | null;
  description?: string | null;
  email?: string | null;
  zillow_url?: string | null;
  zillow_rating?: number | null;
  zillow_review_count?: number | null;
  testimonial_quote?: string | null;
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
    case "civic": return "🏛️";
    default: return "📍";
  }
};

// Fallback images
const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  news: [
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80",
  ],
  events: [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80",
  ],
  civic: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
  ],
  default: [
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80",
    "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80",
  ],
};

const getCategoryFallbackImage = (storyId: string, category: string | null): string => {
  const cat = category?.toLowerCase() || 'default';
  const images = CATEGORY_FALLBACK_IMAGES[cat] || CATEGORY_FALLBACK_IMAGES.default;
  const hash = storyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return images[hash % images.length];
};

const LakeGenevaV2 = () => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    document.title = "Lake Geneva Brief – V2 Layout";
    getReferralSource();
  }, []);

  // Fetch stories
  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["public-stories-v2"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const todayStr = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .gte("geo_tier", 1)
        .lte("geo_tier", 2)
        .gte("created_at", weekAgo)
        .gte("publish_date", fourteenDaysAgo)
        .lte("publish_date", now)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      // Filter out past events and add fallback images
      return (data || [])
        .filter((story: any) => {
          if (story.event_date && story.event_date < todayStr) return false;
          return true;
        })
        .map((story: any) => {
          if (!story.image_url) {
            return { ...story, image_url: getCategoryFallbackImage(story.id, story.category) };
          }
          return story;
        });
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
          business:business_profiles(name, logo_url, website, category, phone, description, email, zillow_url, zillow_rating, zillow_review_count, testimonial_quote)
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

  // Query real estate market data
  const { data: marketData } = useQuery({
    queryKey: ["market-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("real_estate_metrics")
        .select("yoy_change, zip_code, median_price")
        .eq("zip_code", "53147")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 3600000,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (subscriberEmail: string) => {
      const source = getSubscribeSource("v2-footer");
      const { error } = await supabase
        .from("subscribers")
        .insert({ email: subscriberEmail, status: "active", source });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Successfully subscribed!");
      setEmail("");
      setIsSubscribing(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Already subscribed");
      } else {
        toast.error("Subscription failed");
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

  return (
    <PageShell
      title="Lake Geneva Brief – V2 Layout"
      description="Experimental NOW / TODAY / TONIGHT layout"
    >
      <WelcomeModal />
      <StickySubscribeBanner />
      
      {/* V2 Layout Toggle Banner */}
      <div className="bg-blue-600 text-white text-center py-2 text-sm">
        <span className="font-medium">🧪 Experimental Layout</span>
        <span className="mx-2">·</span>
        <NavLink to="/" className="underline hover:no-underline">
          Switch to current layout →
        </NavLink>
      </div>

      {/* Three-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-6">
          
          {/* ========== LEFT COLUMN: NOW (LOCKED) ========== */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-4 overflow-hidden">
              {/* NOW Header */}
              <div className="flex items-center gap-2 px-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Now</h2>
              </div>
              
              {/* Weather at top of NOW */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <WeatherWidget />
                <div className="mt-2">
                  <WeatherForecast />
                </div>
              </div>
              
              {/* Live Incidents */}
              <LiveIncidentsSidebar />
            </div>
          </aside>

          {/* ========== CENTER COLUMN: TODAY (SCROLLABLE) ========== */}
          <main className="min-w-0">
            {/* Hero Section */}
            <section className="mb-8">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
                  Good morning, Lake Geneva
                </p>
                <h1 className="font-semibold text-2xl sm:text-3xl text-slate-900 mb-2">
                  Here's what's happening today
                </h1>
                <p className="text-sm text-slate-600 max-w-xl">
                  Short, trustworthy updates on city hall, schools, events, and real estate — in under 5 minutes.
                </p>
              </div>
            </section>

            {/* Mobile: NOW section */}
            <div className="xl:hidden mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Now</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <WeatherWidget />
                </div>
                <LiveIncidentsSidebar />
              </div>
            </div>

            {/* Sponsor Section */}
            {sponsor && (
              <div className="mb-8">
                <PresentedBySection sponsor={sponsor} marketData={marketData} />
              </div>
            )}

            {/* TODAY Header */}
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Today</h2>
              <span className="text-xs text-slate-400">· Curated local news</span>
            </div>

            {/* Stories Grid */}
            {storiesLoading ? (
              <div className="text-center py-16 text-slate-500">Loading today's stories...</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-600 font-medium mb-2">No new stories today</p>
                <p className="text-slate-500 text-sm">It's a quiet day — and that's usually a good thing.</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {stories.map((story: Story, idx: number) => {
                  const time = getRelativeTime(story.publish_date || story.created_at);
                  let source: string | null = (story as any).source?.name || null;
                  if (!source && story.original_url) {
                    try {
                      const url = new URL(story.original_url);
                      source = url.hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <div key={story.id}>
                      <StoryCard
                        title={story.title}
                        summary={story.content_website || story.content_lg_base || story.summary}
                        imageUrl={story.image_url}
                        category={story.category}
                        url={story.original_url}
                        geoTier={story.geo_tier}
                        geoLabel={story.geo_label}
                        meta={{ time, source }}
                      />
                      {/* Inline subscribe CTA after every 6th story */}
                      {(idx + 1) % 6 === 0 && idx < stories.length - 1 && (
                        <div className="mt-5 sm:col-span-2">
                          <InlineSubscribeCTA />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Now Hiring (moved to bottom of TODAY) */}
            <div className="mt-10">
              <NowHiringWidget />
            </div>

            {/* Subscribe Section */}
            <section id="subscribe" className="mt-12 py-10 border-t border-slate-200">
              <div className="max-w-md mx-auto text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Get the Brief in your inbox</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Join locals who start their day with Lake Geneva Brief — free, 5-minute read.
                </p>
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isSubscribing}>
                    {isSubscribing ? "..." : "Subscribe"}
                  </Button>
                </form>
              </div>
            </section>
          </main>

          {/* ========== RIGHT COLUMN: TONIGHT (LOCKED) ========== */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-4 overflow-hidden">
              {/* TONIGHT Header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-base">🌙</span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Tonight</h2>
              </div>
              
              {/* Nightlife Widget - Tonight Only */}
              <NightlifeWidget tonightOnly />
            </div>
          </aside>
        </div>

        {/* Mobile: TONIGHT section */}
        <div className="xl:hidden mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🌙</span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Tonight</h2>
          </div>
          <NightlifeWidget tonightOnly />
        </div>
      </div>
    </PageShell>
  );
};

export default LakeGenevaV2;
