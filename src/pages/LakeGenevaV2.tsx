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
import HappeningTodayWidget from "@/components/HappeningTodayWidget";
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
// Includes freshness timestamp for credibility
const LiveColumnHeader = () => {
  const { data: incidentStatus, dataUpdatedAt } = useQuery({
    queryKey: ["has-active-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id")
        .eq("status", "active")
        .limit(1);
      if (error) return { hasActive: false };
      return { hasActive: (data?.length || 0) > 0 };
    },
    refetchInterval: 30000,
  });

  const isActive = incidentStatus?.hasActive === true;
  
  // Calculate relative time since last update
  const getRelativeUpdateTime = () => {
    if (!dataUpdatedAt) return null;
    const now = Date.now();
    const diffMs = now - dataUpdatedAt;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hr ago';
    return `${diffHours} hrs ago`;
  };

  // Re-render every minute to keep timestamp fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const updateTime = getRelativeUpdateTime();

  return (
    <div className="mb-4">
      {/* Bold dark LIVE header - warmer than pure black */}
      <div className="bg-slate-800 text-white px-3 py-2.5 mb-3 rounded-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest">[LIVE]</span>
          <span className={`w-1.5 h-1.5 ${isActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
          {!isActive && (
            <span className="text-[10px] font-mono text-emerald-400 uppercase">All Clear</span>
          )}
        </div>
      </div>
      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
        {updateTime ? `Updated ${updateTime}` : 'Real-time status'}
      </p>
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

// Tier-0 cap thresholds
const THIN_FEED_THRESHOLD = 15;
const DEFAULT_TIER0_CAP = 0.30;
const THIN_FEED_TIER0_CAP = 0.40;

const LakeGenevaV2 = () => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    document.title = "Lake Geneva Brief – V2 Layout";
    getReferralSource();
  }, []);

  // Phase 1 Config: Smart geo_tier expansion with caps
  const MIN_FEED_ITEMS = 12; // Thin-feed threshold
  const EXTENDED_WINDOW_DAYS = 21; // Fallback window

  // Fetch stories with priority ordering + tier-0 cap + thin-feed fallback
  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["public-stories-v2"],
    queryFn: async () => {
      const nowMs = Date.now();
      const twoWeeksAgo = new Date(nowMs - 14 * 24 * 60 * 60 * 1000).toISOString();
      const threeWeeksAgo = new Date(nowMs - EXTENDED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const todayStr = new Date().toISOString().split('T')[0];
      const freshThresholdMs = 48 * 60 * 60 * 1000; // 48 hours

      // Helper: filter and process stories
      const processStories = (data: any[]) => {
        return data
          .filter((story: any) => {
            // Exclude past events
            if (story.event_date && story.event_date < todayStr) return false;
            // Exclude nightlife vertical
            const vertical = (story.metadata?.vertical || '').toLowerCase();
            if (vertical === 'nightlife') return false;
            
            const category = (story.category || '').toLowerCase();
            // Normalize curly apostrophes to straight
            const title = (story.title || '').toLowerCase().replace(/['']/g, "'");
            
            // Pure entertainment patterns → LATER column only
            const isPureEntertainment = 
              title.includes('live music') || 
              title.includes('concert at') ||
              title.includes('music at') ||
              title.includes('music @') ||
              title.includes('band at') ||
              title.includes('karaoke') || 
              title.includes('trivia') ||
              title.includes('open mic') ||
              title.includes('dj at') ||
              title.includes("ladies' night") ||
              title.includes("ladies night") ||
              title.includes("dueling pianos");
            
            if (category === 'events' && isPureEntertainment) return false;
            return true;
          })
          .map((story: any) => {
            const createdMs = new Date(story.created_at).getTime();
            const isFresh = (nowMs - createdMs) < freshThresholdMs;
            const imageUrl = story.image_url || getCategoryFallbackImage(story.id, story.category);
            // Normalize title - fix HTML entities + curly quotes
            const normalizedTitle = (story.title || '')
              .replace(/&#8217;/g, "'")
              .replace(/&#8216;/g, "'")
              .replace(/['']/g, "'")
              .replace(/&#8220;/g, '"')
              .replace(/&#8221;/g, '"')
              .replace(/[""]/g, '"');
            return { ...story, title: normalizedTitle, image_url: imageUrl, _isFresh: isFresh };
          });
      };

      // Fetch: include geo_tier 0-2 (was 1-2)
      const { data, error } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .gte("geo_tier", 0)  // Phase 1: Include regional
        .lte("geo_tier", 2)
        .gte("created_at", twoWeeksAgo)
        .gte("publish_date", twoWeeksAgo)
        .lte("publish_date", now)
        .order("geo_tier", { ascending: true })  // Tier 1 first, then 2, then 0 (but 0 comes after in sort below)
        .order("created_at", { ascending: false })
        .limit(80);  // Fetch more to allow filtering

      if (error) throw error;

      let processed = processStories(data || []);

      // Thin-feed fallback: if under threshold, expand window
      if (processed.length < MIN_FEED_ITEMS) {
        console.log(`[PHASE1] Thin feed (${processed.length} items), expanding to ${EXTENDED_WINDOW_DAYS}-day window`);
        const { data: extendedData, error: extError } = await supabase
          .from("content_queue")
          .select("*, source:sources(name)")
          .in("status", ["published", "auto_published"])
          .eq("safety_level", "safe")
          .gte("geo_tier", 0)
          .lte("geo_tier", 2)
          .gte("created_at", threeWeeksAgo)
          .gte("publish_date", threeWeeksAgo)
          .lte("publish_date", now)
          .order("geo_tier", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(100);

        if (!extError && extendedData) {
          processed = processStories(extendedData);
        }
      }

      // Sort: hyperlocal (tier 1-2) first, then fresh, then recency
      // Custom sort: tier 1 → tier 2 → tier 0, within each: fresh first, then by date
      const sorted = processed.sort((a: any, b: any) => {
        // Tier priority: 1 < 2 < 0 (we want 1 first, then 2, then 0)
        const tierPriority = (t: number | null) => {
          if (t === 1) return 0;
          if (t === 2) return 1;
          return 2; // tier 0 or null goes last
        };
        const tierDiff = tierPriority(a.geo_tier) - tierPriority(b.geo_tier);
        if (tierDiff !== 0) return tierDiff;
        
        // Within same tier: fresh first
        if (a._isFresh && !b._isFresh) return -1;
        if (!a._isFresh && b._isFresh) return 1;
        
        // Then by recency
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Apply tier-0 cap: dynamic based on feed health
      const hyperlocal = sorted.filter((s: any) => s.geo_tier === 1 || s.geo_tier === 2);
      const regional = sorted.filter((s: any) => s.geo_tier === 0 || s.geo_tier === null);
      
      // Use relaxed cap when hyperlocal feed is thin
      const tier0Cap = hyperlocal.length < THIN_FEED_THRESHOLD ? THIN_FEED_TIER0_CAP : DEFAULT_TIER0_CAP;
      const maxRegional = Math.floor(hyperlocal.length * (tier0Cap / (1 - tier0Cap)));
      const cappedRegional = regional.slice(0, Math.max(maxRegional, 3)); // At least 3 regional if available
      
      const finalFeed = [...hyperlocal, ...cappedRegional];

      // Dev logging
      if (import.meta.env.DEV) {
        console.log(`[PHASE1] Feed composition: ${hyperlocal.length} hyperlocal + ${cappedRegional.length}/${regional.length} regional (${Math.round(cappedRegional.length / finalFeed.length * 100)}% tier-0)`);
      }

      return finalFeed;
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
      {/* Three-Column Layout - Full width responsive with generous spacing */}
      <div className="w-full px-4 sm:px-6 lg:px-6 xl:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_260px] 2xl:grid-cols-[300px_1fr_300px] gap-6">
          
          {/* ========== LEFT COLUMN: LIVE (LOCKED) ========== */}
          <aside className="hidden xl:block border-r border-slate-200">
            <div className="sticky top-20 space-y-4">
              {/* LIVE Header with dynamic indicator */}
              <LiveColumnHeader />
              
              {/* Weather at top of LIVE */}
              <div className="bg-stone-50 rounded-md border border-slate-200 p-4">
                <WeatherWidget />
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <WeatherForecast />
                </div>
              </div>
              
              {/* Live Incidents */}
              <LiveIncidentsSidebar />
            </div>
          </aside>

          {/* ========== CENTER COLUMN: LATEST (SCROLLABLE) ========== */}
          <main className="min-w-0 w-full px-6 xl:px-10">
            {/* Mobile: LIVE section */}
            <div className="xl:hidden mb-8">
              <LiveColumnHeader />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-sm border border-slate-200 p-3">
                  <WeatherWidget />
                </div>
                <LiveIncidentsSidebar />
              </div>
            </div>

            {/* Mobile: Quick "Tonight" teaser - hidden on desktop where sidebar handles this */}
            <div className="xl:hidden mt-6 mb-6 p-5 bg-stone-50 border border-slate-200 rounded-md">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">[TONIGHT]</span>
                <a href="#later-mobile" className="text-xs font-mono text-blue-600 hover:underline py-2 -my-2">
                  See all plans →
                </a>
              </div>
              <NightlifeWidget tonightOnly />
            </div>

            {/* LATEST Header - L-L-L mnemonic consistency */}
            <div className="pb-3 border-b-4 border-blue-600 mb-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-black">LATEST</h2>
                <span className="text-[10px] font-mono text-blue-600 uppercase">[LOCAL BRIEFING]</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                What locals should know · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
              </p>
            </div>

            {/* Lead stories - first one full width, second half */}
            {!storiesLoading && stories.length > 0 && (
              <div className="mb-6 space-y-5">
                {/* First story - FULL WIDTH, dominant */}
                {stories[0] && (() => {
                  const story = stories[0];
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
                      id={story.id}
                      title={story.title}
                      summary={story.content_website || story.content_lg_base || story.summary}
                      imageUrl={story.image_url}
                      category={story.category}
                      url={story.original_url}
                      geoTier={story.geo_tier}
                      geoLabel={story.geo_label}
                      meta={{ time, source }}
                      featured
                    />
                  );
                })()}

                {/* Second story - half width on desktop */}
                {stories[1] && (
                  <div className="sm:w-1/2">
                    {(() => {
                      const story = stories[1];
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
                          id={story.id}
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
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Horizontal rule after lead stories */}
            {!storiesLoading && stories.length > 2 && (
              <div className="border-t border-border mb-6" />
            )}

            {/* HAPPENING TODAY - Commit B: local pulse module */}
            {!storiesLoading && (
              <HappeningTodayWidget />
            )}

            {/* Sponsor Section */}
            {sponsor && (
              <div className="mb-8">
                <PresentedBySectionCompact sponsor={sponsor} marketData={marketData} />
              </div>
            )}

            {/* Quiet day notice - shows when lead stories are stale */}
            {!storiesLoading && stories.length > 0 && stories.filter((s: any) => s._isFresh).length < 2 && (
              <div className="text-center py-10 mb-6 bg-stone-50 border border-slate-200 rounded-md">
                <p className="text-slate-700 text-base mb-1">It's a quiet day in Lake Geneva</p>
                <p className="text-slate-500 text-sm">— and that's usually a good thing.</p>
                <p className="text-xs font-mono text-slate-500 mt-5 uppercase tracking-wider">
                  Recent stories below ↓
                </p>
              </div>
            )}

            {/* All Story Cards (stories 3+) as unified visual grid */}
            {storiesLoading ? (
              <div className="text-center py-16 text-slate-500">Loading today's stories...</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-900 font-medium mb-2">No stories yet</p>
                <p className="text-slate-500 text-sm">Check back later for updates.</p>
              </div>
            ) : stories.length > 2 ? (
              <div className="grid gap-5 sm:grid-cols-2">
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
                      {/* Inline subscribe CTA after every 6th story */}
                      {(idx + 1) % 6 === 0 && idx < stories.length - 3 && (
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
          <aside className="hidden xl:block border-l border-slate-200">
            <div className="sticky top-20 space-y-4">
              {/* LATER Header - Commit B: amber accent for Plans */}
              <div className="pb-3 border-b-2 border-amber-500 mb-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">LATER</h2>
                  <span className="text-[10px] font-mono text-amber-600 uppercase">[PLANS]</span>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">Tonight → Next 3 Days</p>
              </div>
              
              {/* Nightlife Widget - with Tonight/Weekend toggle */}
              <NightlifeWidget showLaterPick showModeToggle />
            </div>
          </aside>
        </div>

        {/* Mobile: LATER section */}
        <div className="xl:hidden mt-10 pt-6 border-t border-slate-200">
          <div className="pb-3 border-b-2 border-amber-500 mb-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">LATER</h2>
              <span className="text-[10px] font-mono text-amber-600 uppercase">[PLANS]</span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">Tonight → Next 3 Days</p>
          </div>
          <NightlifeWidget showLaterPick showModeToggle />
        </div>
      </div>
    </PageShell>
  );
};

export default LakeGenevaV2;
