import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedStoryImage } from "@/lib/imagePolicy";
import { runCityScoped } from "@/lib/cityId";
import { useCityConfig } from "@/hooks/useCityConfig";

// Shared local-feed ranking. Extracted from LakeGenevaV2 so the homepage and
// the mobile story reel always agree on which stories are surfaced and in what
// order. Query key is unchanged, so both surfaces share one react-query cache
// entry instead of double-fetching.


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

export const useLocalFeed = () => {
  const { id: cityId } = useCityConfig();

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
  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useQuery<any[]>({
    queryKey: ["public-stories-v2", cityId],
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
            // Drop empty-body stories — clicking through would show "nothing".
            // Events are allowed to be summary-light (date/time/venue carry the
            // story), but news/civic/etc. need at least a short deck.
            const hasBody =
              (story.content_website && story.content_website.trim().length > 20) ||
              (story.content_lg_base && story.content_lg_base.trim().length > 20) ||
              (story.summary && story.summary.trim().length > 20);
            if (!hasBody && category !== 'events') return false;
            return true;
          })
          .map((story: any) => {
            const createdMs = new Date(story.created_at).getTime();
            const isFresh = (nowMs - createdMs) < freshThresholdMs;
            // Image policy: drop TV-station weather screenshots and radar art
            // before falling back to the curated civic/category set.
            const candidate = isAllowedStoryImage(story.image_url, story.category)
              ? story.image_url
              : null;
            const imageUrl = candidate || getCategoryFallbackImage(story.id, story.category);
            // Normalize title — strip Patch.com's "🌱 " prefix, fix HTML entities + curly quotes
            const normalizedTitle = (story.title || '')
              .replace(/^[🌱🌿🌳]\s*/u, '')
              .replace(/&#8217;/g, "'")
              .replace(/&#8216;/g, "'")
              .replace(/['']/g, "'")
              .replace(/&#8220;/g, '"')
              .replace(/&#8221;/g, '"')
              .replace(/[""]/g, '"');
            return { ...story, title: normalizedTitle, image_url: imageUrl, _isFresh: isFresh, _hasRealImage: !!candidate };
          });
      };

      // Fetch: include geo_tier 0-2 (was 1-2). Built as a function so
      // runCityScoped can retry it unscoped if the city_id migration hasn't
      // landed yet — a missing column must never present as an empty town.
      const fetchWindow = (scoped: boolean, since: string, cap: number) => {
        let q = supabase.from("content_queue").select("*, source:sources(name)");
        if (scoped) q = q.eq("city_id", cityId);
        return q
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          // geo_tier 0 is what the ingester stamps on REGIONAL stories it could not
          // tie to the lake ("Non-local story detected, forcing tier 0"). Including it
          // was a launch crutch to fill the feed — and it filled the feed with
          // Milwaukee crime wearing a Lake Geneva byline. Local means tier 1-2.
          .gte("geo_tier", 1)
          .lte("geo_tier", 2)
          .gte("created_at", since)
          .gte("publish_date", since)
          .lte("publish_date", now)
          .order("geo_tier", { ascending: false })  // Tier 2 → 1 → 0 so hyperlocal fits inside LIMIT
          .order("created_at", { ascending: false })
          .limit(cap);
      };

      const { data, error } = await runCityScoped((scoped) =>
        fetchWindow(scoped, twoWeeksAgo, 80),  // Fetch more to allow filtering
      );

      if (error) throw error;

      let processed = processStories(data || []);

      // Thin-feed fallback: if under threshold, expand window
      if (processed.length < MIN_FEED_ITEMS) {
        console.log(`[PHASE1] Thin feed (${processed.length} items), expanding to ${EXTENDED_WINDOW_DAYS}-day window`);
        const { data: extendedData, error: extError } = await runCityScoped((scoped) =>
          fetchWindow(scoped, threeWeeksAgo, 100),
        );

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

  return { stories, storiesLoading, storiesError };
};

export { getCategoryFallbackImage };
