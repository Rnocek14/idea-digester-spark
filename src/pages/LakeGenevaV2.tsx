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
import { Link } from "react-router-dom";
import { Home, Star, Phone } from "lucide-react";

// Dynamic LIVE column header - shows green when all clear, red when active incidents
const LiveColumnHeader = () => {
  const { data: hasActiveIncidents } = useQuery({
    queryKey: ["has-active-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id")
        .eq("status", "active")
        .limit(1);
      if (error) return false;
      return (data?.length || 0) > 0;
    },
    refetchInterval: 30000,
  });

  const isActive = hasActiveIncidents === true;

  return (
    <div className="px-1 pb-3 border-b border-border">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {isActive ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          )}
        </span>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live</h2>
        {!isActive && (
          <span className="text-xs text-emerald-600/80">· All clear</span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-1">Real-time status</p>
    </div>
  );
};

// Compact sponsor section - half height version for V2
const PresentedBySectionCompact = ({ sponsor, marketData }: { sponsor: any; marketData: any }) => {
  const yoyChangeText = marketData?.yoy_change 
    ? `${marketData.yoy_change > 0 ? '+' : ''}${marketData.yoy_change.toFixed(1)}%`
    : null;
  const medianPriceText = marketData?.median_price
    ? `$${Math.round(marketData.median_price / 1000)}K`
    : null;

  return (
    <div className="rounded-xl bg-gradient-to-r from-muted/30 via-background to-primary/5 border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Photo + Name */}
        <Link 
          to="/selling-lake-geneva"
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm">
            {sponsor.logo_url ? (
              <img src={sponsor.logo_url} alt={sponsor.name} className="w-full h-full object-cover" />
            ) : (
              <Home className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Presented by</p>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {sponsor.name}
            </h3>
            {sponsor.zillow_rating && (
              <div className="flex items-center gap-1">
                <div className="flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`w-2.5 h-2.5 ${i < Math.round(sponsor.zillow_rating) ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{sponsor.zillow_review_count} reviews</span>
              </div>
            )}
          </div>
        </Link>

        {/* Right: Phone */}
        {sponsor.phone && (
          <a
            href={`tel:+1${sponsor.phone.replace(/\D/g, '')}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{sponsor.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
          </a>
        )}
      </div>
      
      {/* Market data footer - optional, very compact */}
      {(yoyChangeText || medianPriceText) && (
        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
          Lake Geneva homes
          {medianPriceText && <> · <span className="text-foreground font-medium">{medianPriceText}</span> median</>}
          {yoyChangeText && <> · <span className={marketData?.yoy_change > 0 ? 'text-emerald-600' : ''}>{yoyChangeText}</span> YoY</>}
        </p>
      )}
    </div>
  );
};

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
    <PageShell fullWidth>
      <WelcomeModal />
      <StickySubscribeBanner />
      
      {/* V2 Layout Toggle Banner */}
      <div className="bg-primary text-primary-foreground text-center py-2 text-sm">
        <span className="font-medium">🧪 Experimental Layout</span>
        <span className="mx-2">·</span>
        <NavLink to="/" className="underline hover:no-underline">
          Switch to current layout →
        </NavLink>
      </div>

      {/* Three-Column Layout - Full width responsive with generous spacing */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] 2xl:grid-cols-[340px_1fr_340px] gap-6 xl:gap-12 2xl:gap-20">
          
          {/* ========== LEFT COLUMN: LIVE (LOCKED) ========== */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-5 overflow-hidden">
              {/* LIVE Header with dynamic indicator */}
              <LiveColumnHeader />
              
              {/* Weather at top of LIVE */}
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <WeatherWidget />
                <div className="mt-3">
                  <WeatherForecast />
                </div>
              </div>
              
              {/* Live Incidents */}
              <LiveIncidentsSidebar />
            </div>
          </aside>

          {/* ========== CENTER COLUMN: LATEST (SCROLLABLE) ========== */}
          <main className="min-w-0 w-full">
            {/* Mobile: LIVE section */}
            <div className="xl:hidden mb-8">
              <LiveColumnHeader />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <WeatherWidget />
                </div>
                <LiveIncidentsSidebar />
              </div>
            </div>

            {/* LATEST Header - matches sidebar header style */}
            <div className="px-1 pb-3 border-b border-border mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Latest</h2>
                <span className="text-xs text-muted-foreground/70">· Your daily briefing</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* First 2 stories above the fold */}
            {!storiesLoading && stories.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 mb-8">
                {stories.slice(0, 2).map((story: Story) => {
                  const time = getRelativeTime(story.publish_date || story.created_at);
                  let source: string | null = (story as any).source?.name || null;
                  if (!source && story.original_url) {
                    try {
                      const url = new URL(story.original_url);
                      source = url.hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <StoryCard
                      key={story.id}
                      title={story.title}
                      summary={story.content_website || story.content_lg_base || story.summary}
                      imageUrl={story.image_url}
                      category={story.category}
                      url={story.original_url}
                      geoTier={story.geo_tier}
                      geoLabel={story.geo_label}
                      meta={{ time, source }}
                    />
                  );
                })}
              </div>
            )}

            {/* Sponsor Section - NOW below first 2 stories */}
            {sponsor && (
              <div className="mb-8">
                <PresentedBySectionCompact sponsor={sponsor} marketData={marketData} />
              </div>
            )}

            {/* Remaining Stories Grid (after first 2) */}
            {storiesLoading ? (
              <div className="text-center py-16 text-muted-foreground">Loading today's stories...</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-foreground font-medium mb-2">No new stories today</p>
                <p className="text-muted-foreground text-sm">It's a quiet day — and that's usually a good thing.</p>
              </div>
            ) : stories.length > 2 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {stories.slice(2).map((story: Story, idx: number) => {
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
                      {/* Inline subscribe CTA after every 6th story (accounting for first 2) */}
                      {(idx + 3) % 6 === 0 && idx < stories.length - 3 && (
                        <div className="mt-5 sm:col-span-2">
                          <InlineSubscribeCTA />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Now Hiring (moved to bottom of TODAY) */}
            <div className="mt-10">
              <NowHiringWidget />
            </div>

            {/* Subscribe Section */}
            <section id="subscribe" className="mt-14 py-12 border-t border-border">
              <div className="max-w-md mx-auto text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">Get the Brief in your inbox</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Join locals who start their day with Lake Geneva Brief — free, 5-minute read.
                </p>
                <form onSubmit={handleSubscribe} className="flex gap-3">
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

          {/* ========== RIGHT COLUMN: LATER (LOCKED) ========== */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-5 overflow-hidden">
              {/* LATER Header with time window */}
              <div className="px-1 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Later</h2>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1 ml-6">Next 72 hours</p>
              </div>
              
              {/* Nightlife Widget - Extended window with Pick */}
              <NightlifeWidget showLaterPick />
            </div>
          </aside>
        </div>

        {/* Mobile: LATER section */}
        <div className="xl:hidden mt-10">
          <div className="mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Later</h2>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1 ml-6">Next 72 hours</p>
          </div>
          <NightlifeWidget showLaterPick />
        </div>
      </div>
    </PageShell>
  );
};

export default LakeGenevaV2;
