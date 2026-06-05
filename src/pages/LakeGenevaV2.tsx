import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollableContainer } from "@/components/ui/ScrollableContainer";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { StoryCard } from "@/components/StoryCard";
import WeatherWidget from "@/components/WeatherWidget";
import WeatherForecast from "@/components/WeatherForecast";
import LiveIncidentsSidebar from "@/components/LiveIncidentsSidebar";
import NightlifeWidget from "@/components/NightlifeWidget";
import HappeningTodayWidget from "@/components/HappeningTodayWidget";
import ComingUpRail from "@/components/ComingUpRail";
import EditorialLaterRail from "@/components/EditorialLaterRail";
import CommunityDeskBlock from "@/components/CommunityDeskBlock";
import NowHiringWidget from "@/components/NowHiringWidget";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import { StickySubscribeBanner } from "@/components/StickySubscribeBanner";
import { WelcomeModal } from "@/components/WelcomeModal";
import { PresentedBySection } from "@/components/PresentedBySection";
import { getSubscribeSource, getReferralSource } from "@/lib/referralTracking";
import { NavLink } from "@/components/NavLink";
import { Home, Star, Phone, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageMeta } from "@/components/PageMeta";
import { LG_ALL_KEYWORDS } from "@/lib/seoKeywords";

// Category order for topic mode filtering
const categoryOrder = ['news', 'civic', 'events', 'dining', 'community', 'schools', 'real_estate'];

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
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
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
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80", // newspaper
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80", // news desk
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80", // press
  ],
  events: [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80",
  ],
  civic: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
    "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80", // government building
    "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80", // american flag on building
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

// Geo-tier ranking configuration
// Hard quotas: ensure hyperlocal dominates top slots
const TOP_SLOTS_COUNT = 10;          // Number of "prime" slots for quota enforcement
const MIN_TIER1_IN_TOP = 5;          // Minimum tier-1 (Lake Geneva) in top 10
const MIN_TIER2_IN_TOP = 2;          // Minimum tier-2 (Walworth) in top 10
const MAX_TIER0_IN_TOP = 3;          // Maximum tier-0 (Regional) in top 10

// Score weights for tier-based ranking
const TIER_SCORE_WEIGHTS = {
  1: 100,   // Lake Geneva hyperlocal
  2: 70,    // Walworth County
  0: 20,    // Regional Wisconsin
} as const;

// Freshness boost
const FRESH_BOOST = 15;              // Added to score if < 48 hours old
const RECENCY_DECAY_PER_DAY = 2;     // Score decay per day old

// Legacy tier-0 cap thresholds (fallback)
const THIN_FEED_THRESHOLD = 15;
const DEFAULT_TIER0_CAP = 0.30;
const THIN_FEED_TIER0_CAP = 0.40;

// Geo label mapping for visual display
const GEO_TIER_LABELS = {
  1: { label: 'Lake Geneva', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  2: { label: 'Walworth', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  0: { label: 'Wisconsin', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500' },
} as const;

const LakeGenevaV2 = () => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const isMobile = useIsMobile();
  
  // View mode state for merged V1 features
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'topic' | 'recent'>('all');
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const previousFeedIdsRef = useRef<Set<string>>(new Set());
  const [mobileViewDropdownOpen, setMobileViewDropdownOpen] = useState(false);

  useEffect(() => {
    getReferralSource();
  }, []);

  // Deep linking: handle ?category=events URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam && categoryOrder.includes(categoryParam.toLowerCase())) {
      setActiveCategory(categoryParam.toLowerCase());
      setViewMode('topic');
    }
  }, [searchParams]);

  // Scroll to story helper
  const scrollToStory = (storyId: string) => {
    const el = document.getElementById(`story-${storyId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Phase 1 Config: Smart geo_tier expansion with caps
  const MIN_FEED_ITEMS = 12; // Thin-feed threshold
  const EXTENDED_WINDOW_DAYS = 21; // Fallback window
  
  // Content diversity caps - prevent any single category from dominating
  const CATEGORY_CAPS: Record<string, number> = {
    weather: 2,      // Max 2 weather alerts
    schools: 3,      // Max 3 school items
    events: 8,       // Allow more events as they're core content
  };
  
  // Minimum category targets - ensure feed diversity
  const CATEGORY_MINIMUMS: Record<string, number> = {
    news: 1,
    civic: 1, 
    community: 1,
  };

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
            const category = (story.category || '').toLowerCase();
            // Use AI-classified verticals to distinguish marquee local events
            // (e.g. Riviera concerts tagged ["local","nightlife"]) from pure
            // bar entertainment (Wednesday trivia tagged ["nightlife"]).
            const rawVerticals: string[] = Array.isArray(story.metadata?.verticals)
              ? story.metadata.verticals
              : (story.metadata?.vertical ? [story.metadata.vertical] : []);
            const verticals = rawVerticals.map((v: string) => (v || '').toLowerCase());
            const isNightlifeOnly = verticals.length > 0 && verticals.every((v) => v === 'nightlife');
            if (category === 'events' && isNightlifeOnly) return false;
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
        .in("safety_level", ["safe", "soft_sensitive"])
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
          .in("safety_level", ["safe", "soft_sensitive"])
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

      // === GEO-TIER SCORING ALGORITHM ===
      // Calculate composite score: tier_weight + freshness_boost - age_decay
      const calculateScore = (story: any): number => {
        const tierWeight = TIER_SCORE_WEIGHTS[story.geo_tier as keyof typeof TIER_SCORE_WEIGHTS] ?? TIER_SCORE_WEIGHTS[0];
        const ageMs = nowMs - new Date(story.created_at).getTime();
        const ageDays = ageMs / (24 * 60 * 60 * 1000);
        const freshBonus = story._isFresh ? FRESH_BOOST : 0;
        const ageDecay = Math.min(ageDays * RECENCY_DECAY_PER_DAY, 30); // Cap decay at 30 points
        
        return tierWeight + freshBonus - ageDecay;
      };

      // Add scores to all stories
      const scoredStories = processed.map((story: any) => ({
        ...story,
        _score: calculateScore(story),
      }));

      // Sort by score descending
      const sorted = scoredStories.sort((a: any, b: any) => b._score - a._score);

      // === HARD QUOTA ENFORCEMENT FOR TOP SLOTS ===
      // Ensure hyperlocal content dominates the top 10 positions
      // Key principle: tier blocks remain stable, no full re-sort after quota assembly
      const tier1Stories = sorted.filter((s: any) => s.geo_tier === 1);
      const tier2Stories = sorted.filter((s: any) => s.geo_tier === 2);
      // Note: tier0Stories not used directly, we filter inline

      const usedIds = new Set<string>();
      let tier0InTop = 0; // Tier-0 count in top slots (from remainder only, since tier1Top/tier2Top have none)

      // Step 1: Pick best tier-1 stories (with thin-feed fallback)
      const availableTier1 = Math.min(tier1Stories.length, MIN_TIER1_IN_TOP);
      const tier1Top = tier1Stories.slice(0, availableTier1);
      tier1Top.forEach((s: any) => usedIds.add(s.id));

      // Step 2: Pick best tier-2 stories (with thin-feed fallback)
      const availableTier2 = Math.min(tier2Stories.length, MIN_TIER2_IN_TOP);
      const tier2Top = tier2Stories.slice(0, availableTier2);
      tier2Top.forEach((s: any) => usedIds.add(s.id));

      // Step 3: Calculate shortfall and fill remainder slots
      const tier1Shortfall = MIN_TIER1_IN_TOP - availableTier1;
      const tier2Shortfall = MIN_TIER2_IN_TOP - availableTier2;
      const remainderSlotCount = TOP_SLOTS_COUNT - tier1Top.length - tier2Top.length;
      
      // Fill remainder from score-sorted candidates, respecting tier-0 cap
      const remainderCandidates = sorted.filter((s: any) => !usedIds.has(s.id));
      const remainder: any[] = [];
      
      for (const story of remainderCandidates) {
        if (remainder.length >= remainderSlotCount) break;
        
        const isTier0 = story.geo_tier === 0 || story.geo_tier === null;
        if (isTier0) {
          if (tier0InTop >= MAX_TIER0_IN_TOP) continue;
          tier0InTop++;
        }
        
        remainder.push(story);
        usedIds.add(story.id);
      }

      // Assemble top slots: tier-1 block + tier-2 block + remainder
      const topSlots = [...tier1Top, ...tier2Top, ...remainder];

      // Step 4: Build rest of feed with score-ordered regional interleaving
      const afterTopStories = sorted.filter((s: any) => !usedIds.has(s.id));
      const hyperlocalRestCount = afterTopStories.filter((s: any) => s.geo_tier === 1 || s.geo_tier === 2).length;
      const maxRegionalInRest = Math.max(Math.ceil(hyperlocalRestCount * 0.3), 2);
      
      let regionalInRest = 0;
      const restOfFeed: any[] = [];
      
      for (const story of afterTopStories) {
        const isTier0 = story.geo_tier === 0 || story.geo_tier === null;
        if (isTier0) {
          if (regionalInRest >= maxRegionalInRest) continue;
          regionalInRest++;
        }
        restOfFeed.push(story);
      }

      // === CATEGORY CAPS (STAGE 2: apply to rest only, protect top slots) ===
      const topSlotsProtected = [...topSlots]; // Top 10 are immutable
      
      const restCategoryCounts: Record<string, number> = {};
      const cappedRest: any[] = [];
      const categoryOverflow: any[] = [];
      const overflowUsedIds = new Set<string>(); // Guard against duplicate overflow pulls
      
      for (const story of restOfFeed) {
        const cat = (story.category || 'other').toLowerCase();
        const cap = CATEGORY_CAPS[cat];
        const currentCount = restCategoryCounts[cat] || 0;
        
        if (cap !== undefined && currentCount >= cap) {
          categoryOverflow.push(story);
          continue;
        }
        
        cappedRest.push(story);
        restCategoryCounts[cat] = currentCount + 1;
      }
      
      // Category minimums: pull from overflow if needed (with dedup guard)
      for (const [cat, minCount] of Object.entries(CATEGORY_MINIMUMS)) {
        const current = restCategoryCounts[cat] || 0;
        if (current < minCount) {
          const filler = categoryOverflow.find(s => 
            (s.category || '').toLowerCase() === cat && !overflowUsedIds.has(s.id)
          );
          if (filler) {
            cappedRest.push(filler);
            overflowUsedIds.add(filler.id);
            restCategoryCounts[cat] = current + 1;
          }
        }
      }
      
      // Final feed: protected top slots + capped rest
      const finalFeed = [...topSlotsProtected, ...cappedRest];

      // Dev logging for quota verification
      if (import.meta.env.DEV) {
        const topT1 = topSlots.filter((s: any) => s.geo_tier === 1).length;
        const topT2 = topSlots.filter((s: any) => s.geo_tier === 2).length;
        const topT0 = topSlots.filter((s: any) => s.geo_tier === 0 || s.geo_tier === null).length;
        const t1Total = finalFeed.filter((s: any) => s.geo_tier === 1).length;
        const t2Total = finalFeed.filter((s: any) => s.geo_tier === 2).length;
        const t0Total = finalFeed.filter((s: any) => s.geo_tier === 0 || s.geo_tier === null).length;
        const hyperlocalPct = Math.round(((t1Total + t2Total) / finalFeed.length) * 100);
        
        // Soft-fail warning if minimums weren't satisfied
        if (tier1Shortfall > 0 || tier2Shortfall > 0) {
          console.warn(`[GEO-TIER] Thin feed: tier1 shortfall=${tier1Shortfall}, tier2 shortfall=${tier2Shortfall}`);
        }
        console.log(`[GEO-TIER] Top 10: tier1=${topT1}/${MIN_TIER1_IN_TOP}min, tier2=${topT2}/${MIN_TIER2_IN_TOP}min, tier0=${topT0}/${MAX_TIER0_IN_TOP}max`);
        console.log(`[GEO-TIER] Full feed: tier1=${t1Total}, tier2=${t2Total}, tier0=${t0Total} (${hyperlocalPct}% hyperlocal)`);
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
      if (data) {
        return { 
          ...data.business, 
          placementId: data.id, 
          businessId: data.business_id 
        } as Sponsor & { placementId: string; businessId: string };
      }
      // Fallback: always-on Gina Nocek card when no paid placement is active.
      // The site is a real-estate funnel; "Presented by" should never be empty.
      const { data: fallback } = await supabase
        .from("business_profiles")
        .select("name, logo_url, website, category, phone, description, email, zillow_url, zillow_rating, zillow_review_count, testimonial_quote")
        .eq("id", "db06b0ce-2fe3-4a01-a870-7f2aef1913a6")
        .maybeSingle();
      return fallback ? {
        ...fallback,
        placementId: "fallback-gina",
        businessId: "db06b0ce-2fe3-4a01-a870-7f2aef1913a6",
        _isFallback: true,
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

  // Track new updates for "Recent" badge
  useEffect(() => {
    if (stories.length === 0) return;
    
    const currentIds = new Set(stories.map((s: Story) => s.id));
    const previousIds = previousFeedIdsRef.current;
    
    if (previousIds.size > 0) {
      const newItems = [...currentIds].filter(id => !previousIds.has(id));
      if (newItems.length > 0 && viewMode !== 'recent') {
        setNewUpdatesCount(prev => prev + newItems.length);
      }
    }
    
    previousFeedIdsRef.current = currentIds;
  }, [stories, viewMode]);

  // Categories that shouldn't dominate the hero slot — routine recurring bar/dining specials
  const LOW_PRIORITY_LEAD_CATEGORIES = new Set(['nightlife', 'dining', 'entertainment']);

  // Filter stories based on view mode and category
  const getFilteredStories = () => {
    if (viewMode === 'topic' && activeCategory !== 'all') {
      return stories.filter((s: Story) =>
        (s.category || '').toLowerCase() === activeCategory.toLowerCase()
      );
    }
    if (viewMode === 'recent') {
      // Pure chronological by created_at
      return [...stories].sort((a: Story, b: Story) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    // 'all' mode: lift the first non-nightlife/dining story into the hero slot
    // so the front page doesn't lead with a recurring bar special.
    if (stories.length > 1) {
      const leadCat = (stories[0].category || '').toLowerCase();
      if (LOW_PRIORITY_LEAD_CATEGORIES.has(leadCat)) {
        const swapIdx = stories.findIndex(
          (s) => !LOW_PRIORITY_LEAD_CATEGORIES.has((s.category || '').toLowerCase())
        );
        if (swapIdx > 0) {
          const reordered = [...stories];
          const [promoted] = reordered.splice(swapIdx, 1);
          reordered.unshift(promoted);
          return reordered;
        }
      }
    }
    return stories;
  };

  const filteredStories = getFilteredStories();

  // Group stories by category for topic mode
  const getStoriesByCategory = () => {
    const grouped: Record<string, Story[]> = {};
    const cats = activeCategory === 'all' ? categoryOrder : [activeCategory];
    
    for (const cat of cats) {
      const catStories = stories.filter((s: Story) => 
        (s.category || '').toLowerCase() === cat.toLowerCase()
      );
      if (catStories.length > 0) {
        grouped[cat] = catStories;
      }
    }
    return grouped;
  };

  return (
    <PageShell fullWidth>
      <PageMeta
        title="Lake Geneva Brief – Today's Local News & Things To Do"
        description="Today's local news, civic updates, events, dining, and nightlife in Lake Geneva, Wisconsin — curated daily."
        path="/"
        keywords={LG_ALL_KEYWORDS}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Lake Geneva Brief",
          "url": "https://lakegeneva.citybrief.info/",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://lakegeneva.citybrief.info/?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <WelcomeModal />
      <StickySubscribeBanner />
      {/* Three-Column Layout - Full width responsive with generous spacing */}
      <div className="w-full px-4 sm:px-6 lg:px-6 xl:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_260px] 2xl:grid-cols-[300px_1fr_300px] gap-6">
          
          {/* ========== LEFT COLUMN: LIVE (LOCKED) ========== */}
          <aside className="hidden xl:block border-r border-slate-200">
            <div className="sticky top-20">
              <ScrollableContainer className="space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4">
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
              </ScrollableContainer>
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
              <p className="text-[10px] font-mono text-slate-500 mt-1">
                What locals should know · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
              </p>
              {stories.length > 0 && (() => {
                const newest = stories.reduce((acc: number, s: any) => {
                  const t = new Date(s.created_at).getTime();
                  return t > acc ? t : acc;
                }, 0);
                const hoursAgo = (Date.now() - newest) / 36e5;
                // Quiet-hours aware: overnight (8pm–8am) and weekends, sources
                // post less. Use 24h stale threshold then; 12h on business days.
                const now = new Date();
                const hour = now.getHours();
                const day = now.getDay(); // 0=Sun, 6=Sat
                const isQuietWindow = hour >= 20 || hour < 8 || day === 0 || day === 6;
                const threshold = isQuietWindow ? 24 : 12;
                const isStale = hoursAgo >= threshold;
                return (
                  <p className={`text-[10px] font-mono mt-1 ${isStale ? 'text-amber-700 font-semibold' : 'text-emerald-700'}`}>
                    {isStale ? '⚠ ' : '● '}Last new story: {getRelativeTime(new Date(newest).toISOString())}
                  </p>
                );
              })()}
            </div>

            {/* AT-A-GLANCE: Quick-scan bullet list (V1 feature) */}
            {!storiesLoading && stories.length > 0 && (() => {
              // Prefer news/civic/community/schools/events/weather over routine bar specials
              const newsFirst = [...stories].sort((a, b) => {
                const aLow = LOW_PRIORITY_LEAD_CATEGORIES.has((a.category || '').toLowerCase()) ? 1 : 0;
                const bLow = LOW_PRIORITY_LEAD_CATEGORIES.has((b.category || '').toLowerCase()) ? 1 : 0;
                return aLow - bLow;
              });
              return (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-sm">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">
                  AT A GLANCE
                </p>
                <ul className="space-y-2">
                  {newsFirst.slice(0, 5).map((story: Story) => (
                    <li key={story.id} className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <button
                        onClick={() => scrollToStory(story.id)}
                        className="text-left text-sm text-slate-800 hover:text-blue-700 line-clamp-1 flex-1"
                      >
                        {story.title}
                      </button>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {getRelativeTime(story.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })()}

            {/* VIEW MODE TOGGLE - sticky (V1 feature) */}
            <div className="sticky top-[73px] z-20 bg-background py-3 border-b border-slate-200 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Desktop: Toggle Pills */}
                {!isMobile ? (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-sm p-1">
                    <button
                      onClick={() => setViewMode('all')}
                      className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                        viewMode === 'all'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setViewMode('topic')}
                      className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                        viewMode === 'topic'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      By Topic
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('recent');
                        setNewUpdatesCount(0);
                      }}
                      className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                        viewMode === 'recent'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Recent
                      {newUpdatesCount > 0 && viewMode !== 'recent' && (
                        <span className="h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {newUpdatesCount > 9 ? '9+' : newUpdatesCount}
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Mobile: Dropdown */
                  <div className="relative">
                    <button
                      onClick={() => setMobileViewDropdownOpen(!mobileViewDropdownOpen)}
                      className="flex items-center gap-2 bg-slate-100 rounded-sm px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-700"
                    >
                      {viewMode === 'all' ? 'All Stories' : viewMode === 'topic' ? 'By Topic' : 'Most Recent'}
                      {newUpdatesCount > 0 && viewMode !== 'recent' && (
                        <span className="h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {newUpdatesCount > 9 ? '9+' : newUpdatesCount}
                        </span>
                      )}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {mobileViewDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-sm shadow-lg z-30">
                        {(['all', 'topic', 'recent'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => {
                              setViewMode(mode);
                              if (mode === 'recent') setNewUpdatesCount(0);
                              setMobileViewDropdownOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-xs font-mono uppercase tracking-wider ${
                              viewMode === mode ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {mode === 'all' ? 'All Stories' : mode === 'topic' ? 'By Topic' : 'Most Recent'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Category Pills (topic mode only) */}
                {viewMode === 'topic' && (
                  <div className="flex flex-wrap gap-2">
                    {['all', ...categoryOrder].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`rounded-sm px-2.5 py-1 text-[11px] font-mono uppercase border transition-colors ${
                          activeCategory === cat
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-500"
                        }`}
                      >
                        {cat === 'all' ? 'All' : cat.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lead stories - pyramid: first full-width, second+third side by side */}
            {/* Show pyramid only in 'all' mode, hide in 'recent' mode for pure chronological */}
            {!storiesLoading && filteredStories.length > 0 && viewMode !== 'recent' && viewMode !== 'topic' && (
              <div className="mb-6 space-y-5">
                {/* First story - FULL WIDTH, dominant header photo */}
                {filteredStories[0] && (() => {
                  const story = filteredStories[0];
                  const time = getRelativeTime(story.publish_date || story.created_at);
                  let source: string | null = (story as any).source?.name || null;
                  if (!source && story.original_url) {
                    try {
                      const url = new URL(story.original_url);
                      source = url.hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <div id={`story-${story.id}`}>
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
                    </div>
                  );
                })()}

                {/* Second + Third stories - side by side */}
                {filteredStories.length > 1 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[filteredStories[1], filteredStories[2]].filter(Boolean).map((story) => {
                      const time = getRelativeTime(story.publish_date || story.created_at);
                      let source: string | null = (story as any).source?.name || null;
                      if (!source && story.original_url) {
                        try {
                          const url = new URL(story.original_url);
                          source = url.hostname.replace(/^www\./, '');
                        } catch {}
                      }
                      return (
                        <div key={story.id} id={`story-${story.id}`}>
                          <StoryCard
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Horizontal rule after lead stories */}
            {!storiesLoading && filteredStories.length > 2 && viewMode === 'all' && (
              <div className="border-t border-border mb-6" />
            )}

            {/* HAPPENING TODAY - Commit B: local pulse module */}
            {!storiesLoading && viewMode === 'all' && (
              <HappeningTodayWidget />
            )}

            {/* COMMUNITY DESK — people contributing back, between editorial arc and utility */}
            {viewMode === 'all' && <CommunityDeskBlock />}

            {/* COMING UP — Tonight / This Weekend / Next Week */}
            {viewMode === 'all' && <ComingUpRail />}

            {/* Sponsor Section */}
            {sponsor && viewMode === 'all' && (
              <div className="mb-8">
                <PresentedBySectionCompact sponsor={sponsor} marketData={marketData} />
              </div>
            )}

            {/* Quiet day notice - shows when lead stories are stale */}
            {!storiesLoading && stories.length > 0 && stories.filter((s: any) => s._isFresh).length < 2 && viewMode === 'all' && (
              <div className="text-center py-10 mb-6 bg-stone-50 border border-slate-200 rounded-md">
                <p className="text-slate-700 text-base mb-1">It's a quiet day in Lake Geneva</p>
                <p className="text-slate-500 text-sm">— and that's usually a good thing.</p>
                <p className="text-xs font-mono text-slate-500 mt-5 uppercase tracking-wider">
                  Recent stories below ↓
                </p>
              </div>
            )}

            {/* Story Grid - respects viewMode */}
            {storiesLoading ? (
              <div className="text-center py-16 text-slate-500">Loading today's stories...</div>
            ) : filteredStories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-900 font-medium mb-2">No stories yet</p>
                <p className="text-slate-500 text-sm">Check back later for updates.</p>
              </div>
            ) : viewMode === 'all' && filteredStories.length > 3 ? (
              /* ALL MODE: Chronological grid (stories 4+) */
              <div className="grid gap-5 sm:grid-cols-2">
                {filteredStories.slice(3).map((story: Story, idx: number) => {
                  const time = getRelativeTime(story.publish_date || story.created_at);
                  let source: string | null = (story as any).source?.name || null;
                  if (!source && story.original_url) {
                    try {
                      const url = new URL(story.original_url);
                      source = url.hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <div key={story.id} id={`story-${story.id}`}>
                      <StoryCard
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
                      {/* Inline subscribe CTA after every 6th story */}
                      {(idx + 1) % 6 === 0 && idx < filteredStories.length - 3 && (
                        <div className="mt-5 sm:col-span-2">
                          <InlineSubscribeCTA />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'topic' ? (
              /* TOPIC MODE: Grouped by category with headers */
              <div className="space-y-8">
                {Object.entries(getStoriesByCategory()).map(([category, catStories]) => (
                  <div key={category}>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-4 pb-2 border-b border-slate-200">
                      {category.replace('_', ' ')} ({catStories.length})
                    </h3>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {catStories.map((story: Story) => {
                        const time = getRelativeTime(story.publish_date || story.created_at);
                        let source: string | null = (story as any).source?.name || null;
                        if (!source && story.original_url) {
                          try {
                            const url = new URL(story.original_url);
                            source = url.hostname.replace(/^www\./, '');
                          } catch {}
                        }
                        return (
                          <div key={story.id} id={`story-${story.id}`}>
                            <StoryCard
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'recent' ? (
              /* RECENT MODE: Pure chronological feed */
              <div className="grid gap-5 sm:grid-cols-2">
                {filteredStories.map((story: Story, idx: number) => {
                  const time = getRelativeTime(story.publish_date || story.created_at);
                  let source: string | null = (story as any).source?.name || null;
                  if (!source && story.original_url) {
                    try {
                      const url = new URL(story.original_url);
                      source = url.hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <div key={story.id} id={`story-${story.id}`}>
                      <StoryCard
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
                      {/* Inline subscribe CTA after every 6th story */}
                      {(idx + 1) % 6 === 0 && idx < filteredStories.length - 1 && (
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
            <div className="sticky top-20">
              <ScrollableContainer className="space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pl-4">
                {/* LATER Header - Commit B: amber accent for Plans */}
                <div className="pb-3 border-b-2 border-amber-500 mb-4">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">LATER</h2>
                    <span className="text-[10px] font-mono text-amber-600 uppercase">[PLANS]</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">What's worth looking forward to</p>
                </div>
                
                <EditorialLaterRail />

                {/* Nightlife Widget - with Tonight/Weekend toggle */}
                <NightlifeWidget showLaterPick showModeToggle />
              </ScrollableContainer>
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
            <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">What's worth looking forward to</p>
          </div>
          <EditorialLaterRail />
          <NightlifeWidget showLaterPick showModeToggle />
        </div>
      </div>
    </PageShell>
  );
};

export default LakeGenevaV2;
