import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { StoryCard } from "@/components/StoryCard";
import WeatherWidget from "@/components/WeatherWidget";
import WeatherForecast from "@/components/WeatherForecast";
import LiveIncidentsSidebar from "@/components/LiveIncidentsSidebar";
import WeekendSidebarWidget from "@/components/WeekendSidebarWidget";
import NowHiringWidget from "@/components/NowHiringWidget";
import LiveMusicWidget from "@/components/LiveMusicWidget";
import AlsoTodayCard from "@/components/AlsoTodayCard";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import { StickySubscribeBanner } from "@/components/StickySubscribeBanner";
import { ReferralProgram } from "@/components/ReferralProgram";
import { WelcomeModal } from "@/components/WelcomeModal";
import { PresentedBySection } from "@/components/PresentedBySection";
import { getSubscribeSource, getReferralSource } from "@/lib/referralTracking";

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

const categoryOrder = ["news", "civic", "schools", "events", "dining", "real_estate", "community"];

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

type FeedItem = {
  id: string;
  type: 'story' | 'incident';
  title: string;
  summary: string | null;
  category: string | null;
  timestamp: string;
  url: string | null;
  image_url: string | null;
  incident_type?: string;
  status?: string;
};

const LakeGeneva = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'topic' | 'recent'>('all');
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const previousFeedIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Handle URL query parameters for deep linking (e.g., ?category=events)
  useEffect(() => {
    document.title = "Lake Geneva Brief – Today's Local News";
    getReferralSource();
    
    const categoryParam = searchParams.get('category');
    if (categoryParam && categoryOrder.includes(categoryParam.toLowerCase())) {
      setActiveCategory(categoryParam.toLowerCase());
      setViewMode('topic');
    }
  }, [searchParams]);

  // Fetch incidents for both sidebar and recent feed
  const { data: incidents = [] } = useQuery({
    queryKey: ["all-incidents-feed"],
    queryFn: async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("incidents")
        .select("id, title, incident_type, status, location, started_at, updated_at, slug")
        .in("status", ["active", "monitoring", "resolved"])
        .gte("updated_at", threeDaysAgo)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'monitoring');
  const activeIncidentCount = activeIncidents.length;
  const hasActiveIncidents = activeIncidentCount > 0;

  // Category-specific fallback images for all story types
  const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
    weather: [
      "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80", // Snowy winter scene
      "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80", // Winter snow
      "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80", // Storm clouds
    ],
    news: [
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80", // Newspaper
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80", // News desk
      "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80", // Breaking news
    ],
    events: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80", // Event crowd
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80", // Party lights
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&q=80", // Festival
    ],
    dining: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80", // Restaurant interior
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", // Fine dining
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80", // Cafe scene
    ],
    community: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80", // Community gathering
      "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80", // Town square
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80", // Local event
    ],
    schools: [
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80", // School building
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80", // Students
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80", // Graduation
    ],
    real_estate: [
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80", // House exterior
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80", // Residential home
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80", // Luxury home
    ],
    default: [
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80", // Lake waves
      "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80", // Calm lake
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", // Lake pier
    ],
  };

  // Get deterministic fallback image based on story ID and category
  const getCategoryFallbackImage = (storyId: string, category: string | null): string => {
    const cat = category?.toLowerCase() || 'default';
    const images = CATEGORY_FALLBACK_IMAGES[cat] || CATEGORY_FALLBACK_IMAGES.default;
    const hash = storyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return images[hash % images.length];
  };

  // Topic-specific civic image libraries for smart keyword mapping
  type CivicTopic = 'land_use' | 'historic' | 'council' | 'parks' | 'lakefront' | 'library' | 'safety' | 'tourism' | 'utilities' | 'finance' | 'default';

  const CIVIC_IMAGE_LIBRARIES: Record<CivicTopic, string[]> = {
    land_use: [
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
      "https://images.unsplash.com/photo-1486325212027-8a9ce835dc2e?w=800&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    ],
    historic: [
      "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80",
      "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
      "https://images.unsplash.com/photo-1594398028856-9b00722cefbc?w=800&q=80",
    ],
    council: [
      "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80",
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80",
      "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80",
    ],
    parks: [
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800&q=80",
    ],
    lakefront: [
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80",
      "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    ],
    library: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
    ],
    safety: [
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80",
      "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&q=80",
    ],
    tourism: [
      "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80",
      "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=800&q=80",
    ],
    utilities: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    ],
    finance: [
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    ],
    default: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Walworth_County_Courthouse.jpg/1280px-Walworth_County_Courthouse.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Lake_Geneva_Wisconsin_Riviera.jpg/1280px-Lake_Geneva_Wisconsin_Riviera.jpg",
    ],
  };

  const detectCivicTopic = (title: string): CivicTopic => {
    const t = title.toLowerCase();
    
    // Order matters: more specific matches first to avoid false positives
    // Land use/development catches Hillmoor, rezoning, subdivisions before historic
    if (t.includes('hillmoor') || t.includes('development') || t.includes('rezoning') || t.includes('zoning') || 
        t.includes('subdivision') || t.includes('neighborhood plan') || t.includes('annexation') || 
        t.includes('redevelopment') || t.includes('plat') || t.includes('land use')) return 'land_use';
    if (t.includes('historic') || t.includes('preservation')) return 'historic';
    // Council/governance catches general government meetings
    if (t.includes('common council') || t.includes('city council') || t.includes('council') || 
        t.includes('committee of the whole') || t.includes('governing body') || t.includes('board of aldermen')) return 'council';
    if (t.includes('park') || t.includes('cemetery') || t.includes('tree') || t.includes('avian')) return 'parks';
    if (t.includes('library')) return 'library';
    if (t.includes('police') || t.includes('fire') || t.includes('court') || t.includes('safety')) return 'safety';
    if (t.includes('tourism') || t.includes('visitor')) return 'tourism';
    // Utilities before lakefront so "Lake Geneva Utility Commission" → utilities, not lakefront
    if (t.includes('utility') || t.includes('utilities') || t.includes('water') || t.includes('sewer')) return 'utilities';
    if (t.includes('finance') || t.includes('licensing') || t.includes('regulation') || t.includes('budget')) return 'finance';
    // Lakefront last among specifics (catches piers, harbors, lake-related)
    if (t.includes('pier') || t.includes('harbor') || t.includes('harbour') || t.includes('lakefront')) return 'lakefront';
    
    return 'default';
  };

  const isGenericCivicImage = (imageUrl: string | null) => {
    if (!imageUrl) return false;
    const genericPatterns = ['IconModuleCalendar', 'calendar-icon', 'default-event', 'placeholder', 'no-image'];
    return genericPatterns.some(pattern => imageUrl.toLowerCase().includes(pattern.toLowerCase()));
  };

  const getCuratedCivicImage = (storyId: string, title: string) => {
    const topic = detectCivicTopic(title);
    const images = CIVIC_IMAGE_LIBRARIES[topic] ?? CIVIC_IMAGE_LIBRARIES.default;
    const pool = images.length > 0 ? images : CIVIC_IMAGE_LIBRARIES.default;
    
    // Deterministic hash using storyId + topic for consistency
    const key = `${storyId}:${topic}`;
    const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    return pool[hash % pool.length];
  };

  // Fetch today's published stories
  // Weighted category feed: 40% news/civic, 30% events, 30% community/dining
  const { data: stories = [], isLoading: storiesLoading, dataUpdatedAt: storiesUpdatedAt } = useQuery({
    queryKey: ["public-stories-weighted"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      
      // Target mix: 40% news/civic, 30% events, 30% other
      const NEWS_CIVIC_TARGET = 16;
      const EVENTS_TARGET = 12;
      const OTHER_TARGET = 12;
      
      // Always include Lake Geneva (tier 1) + Walworth County (tier 2) - geo filtering is backend infrastructure
      const maxGeoTier = 2;
      
      // Fetch news + civic (priority content) - hyperlocal only
      // STALE CONTENT FILTER: Reject any content with publish_date > 30 days old
      const { data: newsCivic = [] } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .in("category", ["news", "civic", "schools"])
        .gte("geo_tier", 1)
        .lte("geo_tier", maxGeoTier)
        .gte("created_at", weekAgo)
        .gte("publish_date", fourteenDaysAgo) // CRITICAL: Reject ancient publish_dates
        .lte("publish_date", now)
        .order("geo_tier", { ascending: true }) // Tier 1 (Lake Geneva) first
        .order("is_breaking", { ascending: false })
        .order("publish_date", { ascending: false })
        .limit(NEWS_CIVIC_TARGET);
      
      // Fetch events (capped) - hyperlocal only
      const { data: events = [] } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .gte("geo_tier", 1)
        .lte("geo_tier", maxGeoTier)
        .gte("created_at", weekAgo)
        .gte("publish_date", fourteenDaysAgo) // CRITICAL: Reject ancient publish_dates
        .lte("publish_date", now)
        .order("geo_tier", { ascending: true })
        .order("publish_date", { ascending: false })
        .limit(EVENTS_TARGET);
      
      // Fetch other categories (dining, community, real_estate) - hyperlocal only
      const { data: other = [] } = await supabase
        .from("content_queue")
        .select("*, source:sources(name)")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .in("category", ["dining", "community", "real_estate", "weather"])
        .gte("geo_tier", 1)
        .lte("geo_tier", maxGeoTier)
        .gte("created_at", weekAgo)
        .gte("publish_date", fourteenDaysAgo) // CRITICAL: Reject ancient publish_dates
        .lte("publish_date", now)
        .order("geo_tier", { ascending: true })
        .order("publish_date", { ascending: false })
        .limit(OTHER_TARGET);
      
      // Combine and dedupe
      const combined = [...newsCivic, ...events, ...other];
      const seenIds = new Set<string>();
      const todayStr = new Date().toISOString().split('T')[0];
      
      const deduped = combined.filter(story => {
        if (seenIds.has(story.id)) return false;
        seenIds.add(story.id);
        
        // CRITICAL: Filter out past events (event_date < today)
        if (story.event_date && story.event_date < todayStr) {
          return false;
        }
        
        return true;
      });
      
      // Sort combined: RECENCY FIRST, then breaking status
      // This ensures fresh content always rises to top, even if not breaking
      deduped.sort((a, b) => {
        // Primary sort: most recent created_at first (when content entered system)
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        
        // If both from last 24 hours, prioritize breaking
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (aTime > dayAgo && bTime > dayAgo) {
          if (a.is_breaking && !b.is_breaking) return -1;
          if (!a.is_breaking && b.is_breaking) return 1;
        }
        
        return bTime - aTime;
      });
      
      // Apply fallback images: civic uses topic-aware, others use category fallback
      return deduped.map((story: any) => {
        // If story has a valid image that's not generic, keep it
        if (story.image_url && !isGenericCivicImage(story.image_url)) {
          return story;
        }
        // Civic stories get topic-aware images
        if (story.category?.toLowerCase() === 'civic') {
          return { ...story, image_url: getCuratedCivicImage(story.id, story.title) };
        }
        // All other categories get category-specific fallbacks
        return { ...story, image_url: getCategoryFallbackImage(story.id, story.category) };
      });
    },
    staleTime: 60000,
    refetchInterval: viewMode === 'recent' ? 30000 : false,
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
    staleTime: 3600000, // 1 hour
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (subscriberEmail: string) => {
      const source = getSubscribeSource("footer");
      const { error } = await supabase
        .from("subscribers")
        .insert({
          email: subscriberEmail,
          status: "active",
          source,
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

  // Build unified feed for "Most Recent" view with adaptive time window
  const buildUnifiedFeed = (): FeedItem[] => {
    const feedItems: FeedItem[] = [];
    
    // Add stories
    stories.forEach((story) => {
      feedItems.push({
        id: story.id,
        type: 'story',
        title: story.title,
        summary: story.content_website || story.content_lg_base || story.summary,
        category: story.category,
        timestamp: story.publish_date || story.created_at,
        url: story.original_url,
        image_url: story.image_url,
      });
    });
    
    // Add incidents
    incidents.forEach((incident) => {
      feedItems.push({
        id: incident.id,
        type: 'incident',
        title: incident.title,
        summary: incident.location ? `Near ${incident.location}` : null,
        category: 'incident',
        timestamp: incident.updated_at || incident.started_at,
        url: `/incidents/${incident.slug}`,
        image_url: null,
        incident_type: incident.incident_type,
        status: incident.status,
      });
    });
    
    // Sort by timestamp, newest first
    return feedItems.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const unifiedFeed = viewMode === 'recent' ? buildUnifiedFeed() : [];
  
  // Adaptive time window: filter to show appropriate range
  const getAdaptiveFeed = () => {
    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const d3 = 3 * h24;
    const d7 = 7 * h24;
    
    const filterByAge = (maxAge: number) => 
      unifiedFeed.filter(item => now - new Date(item.timestamp).getTime() <= maxAge);
    
    // Try 24h first
    let filtered = filterByAge(h24);
    if (filtered.length >= 5) return { items: filtered, range: '24h' };
    
    // Extend to 3 days
    filtered = filterByAge(d3);
    if (filtered.length >= 5) return { items: filtered, range: '3d' };
    
    // Fall back to 7 days
    return { items: filterByAge(d7), range: '7d' };
  };
  
  const { items: displayFeed, range: feedRange } = viewMode === 'recent' 
    ? getAdaptiveFeed() 
    : { items: [], range: '24h' };
  
  // Check if there's any recent activity (last 3 hours) to show "live" feel
  const hasRecentActivity = displayFeed.some(
    item => Date.now() - new Date(item.timestamp).getTime() < 3 * 60 * 60 * 1000
  );
  
  // Check if feed is truly quiet (no items at all in 24h)
  const isQuietDay = viewMode === 'recent' && 
    unifiedFeed.filter(item => Date.now() - new Date(item.timestamp).getTime() < 24 * 60 * 60 * 1000).length === 0;

  // Detect new content in the feed and show toast
  useEffect(() => {
    if (viewMode !== 'recent' || unifiedFeed.length === 0) return;
    
    const currentIds = new Set(unifiedFeed.map(item => `${item.type}-${item.id}`));
    
    // On initial load, just store the IDs without showing toast
    if (isInitialLoadRef.current) {
      previousFeedIdsRef.current = currentIds;
      isInitialLoadRef.current = false;
      return;
    }
    
    // Find new items that weren't in the previous set
    const newItems = unifiedFeed.filter(
      item => !previousFeedIdsRef.current.has(`${item.type}-${item.id}`)
    );
    
    if (newItems.length > 0) {
      setNewUpdatesCount(prev => prev + newItems.length);
      
      // Show toast for new content
      const latestItem = newItems[0];
      toast(`New update: ${latestItem.title.slice(0, 50)}${latestItem.title.length > 50 ? '...' : ''}`, {
        description: `${newItems.length === 1 ? '1 new item' : `${newItems.length} new items`} in your feed`,
        action: {
          label: 'View',
          onClick: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setNewUpdatesCount(0);
          }
        },
        duration: 5000,
      });
    }
    
    // Update previous IDs
    previousFeedIdsRef.current = currentIds;
  }, [unifiedFeed, viewMode]);

  // Reset new updates count when switching to recent view
  useEffect(() => {
    if (viewMode === 'recent') {
      setNewUpdatesCount(0);
    }
  }, [viewMode]);

  // Get precise relative time for recent feed
  const getPreciseRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Get icon/emoji for feed item type
  const getFeedItemIcon = (item: FeedItem) => {
    if (item.type === 'incident') {
      switch (item.incident_type) {
        case 'weather': return '🌧️';
        case 'accident': return '🚧';
        case 'fire': return '🔥';
        case 'police': return '🚨';
        case 'utility': return '⚡';
        default: return '⚠️';
      }
    }
    return getCategoryEmoji(item.category);
  };

  // Get label for feed item
  const getFeedItemLabel = (item: FeedItem) => {
    if (item.type === 'incident') {
      const labels: Record<string, string> = {
        weather: 'Weather',
        accident: 'Traffic',
        fire: 'Fire',
        police: 'Police',
        utility: 'Utility',
      };
      return labels[item.incident_type || ''] || 'Alert';
    }
    return item.category?.replace('_', ' ') || 'Update';
  };

  // Check if item is fresh (<1 hour) - for red timestamp styling
  const isFreshItem = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    return diffMs < 60 * 60 * 1000;
  };

  // Check if item is truly "live" (<10 minutes) - for LIVE badge
  const isLiveItem = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    return diffMs < 10 * 60 * 1000;
  };

  return (
    <PageShell
      title="Lake Geneva Brief – Local News, Simplified"
      description="Fast, trustworthy updates on Lake Geneva city hall, schools, events, and real estate."
    >
      <WelcomeModal />
      <StickySubscribeBanner />
      {/* Centered layout with floating margin sidebar */}
      <div className="relative">
        {/* Centered main content */}
        <div className="mx-auto max-w-4xl px-4">
          <main>
            {/* Hero Section - wrapped in card */}
            {featured && (
              <section className="py-8">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-6 py-6 lg:px-8 lg:py-7">
                  {/* Two column grid: main content + Also Today */}
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)] items-start">
                    {/* LEFT COLUMN: greeting, headline, weather, pills, featured story */}
                    <div className="space-y-5">
                      {/* Greeting + headline */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Good morning, Lake Geneva
                          </p>
                          {storiesUpdatedAt && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Updated {getRelativeTime(new Date(storiesUpdatedAt).toISOString())}
                            </span>
                          )}
                        </div>
                        <h1 className="font-semibold text-2xl sm:text-3xl leading-tight text-slate-900">
                          Here's what's happening today
                        </h1>
                        <p className="max-w-xl text-sm text-slate-600 leading-relaxed">
                          Short, trustworthy updates on city hall, schools, events, and real estate — in under 5 minutes.
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          <WeatherWidget />
                          <WeatherForecast />
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
                        <div className="relative aspect-[3/2]">
                          <img
                            src={featured.image_url || getCategoryFallbackImage(featured.id, featured.category)}
                            alt={featured.title}
                            className="h-full w-full object-cover object-top transition-transform duration-500 hover:scale-[1.03]"
                          />
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

                    {/* RIGHT COLUMN: Also Today (inside hero card, desktop only) */}
                    <div className="hidden lg:block">
                      <AlsoTodayCard stories={restStories} />
                    </div>
                  </div>

                  {/* Mobile: AlsoTodayCard stacked */}
                  <div className="mt-6 lg:hidden">
                    <AlsoTodayCard stories={restStories} />
                  </div>
                </div>
              </section>
            )}

            {/* Unified Sponsor Section */}
            {sponsor && (
              <PresentedBySection sponsor={sponsor} marketData={marketData} />
            )}

            {/* Stories by Category */}
            {storiesLoading ? (
              <div className="text-center py-16 text-slate-500">
                Loading today's stories...
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-600 font-medium mb-2">No new stories today</p>
                <p className="text-slate-500 text-sm">It's a quiet day in Lake Geneva — and that's usually a good thing.</p>
              </div>
            ) : (
              <>
                {/* View Toggle + Category Filter Pills */}
                <section className="py-4 border-b border-slate-200 sticky top-[73px] z-20 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
                      <button
                        onClick={() => setViewMode('all')}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'all'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        All Stories
                      </button>
                      <button
                        onClick={() => setViewMode('topic')}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                          viewMode === 'recent'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Most Recent
                        {viewMode !== 'recent' && newUpdatesCount > 0 ? (
                          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                            {newUpdatesCount > 9 ? '9+' : newUpdatesCount}
                          </span>
                        ) : hasActiveIncidents ? (
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        ) : null}
                      </button>
                    </div>

                    {/* Category Pills (only in topic view) */}
                    {viewMode === 'topic' && (
                      <div className="flex flex-wrap gap-2">
                        {['all', ...sortedCategories].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                              activeCategory === cat
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-500 hover:text-blue-700"
                            }`}
                          >
                            {cat === 'all' ? 'All topics' : `${getCategoryEmoji(cat)} ${cat.replace('_', ' ')}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* All Stories - Pure Chronological */}
                {viewMode === 'all' ? (
                  <section className="py-6">
                    <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                      {[...stories]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((story, idx) => {
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
                                geoTier={(story as any).geo_tier}
                                geoLabel={(story as any).geo_label}
                                meta={{ time, source }}
                              />
                              {/* Insert inline subscribe CTA after every 6th story */}
                              {(idx + 1) % 6 === 0 && idx < stories.length - 1 && (
                                <div className="mt-4 sm:col-span-2">
                                  <InlineSubscribeCTA />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </section>
                ) : viewMode === 'recent' ? (
                  <section className="py-6">
                    {/* Quiet day message */}
                    {isQuietDay ? (
                      <div className="text-center py-12 px-4">
                        <p className="text-slate-500 mb-3">
                          No major updates in the last day. That's usually good news.
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => setViewMode('topic')}
                          className="text-sm"
                        >
                          Browse by topic instead →
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Live status indicator */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {hasRecentActivity ? (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-green-600 font-medium">Live</span>
                                </span>
                                <span className="text-slate-400">·</span>
                                <span>Updates every 30 seconds</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                                <span>
                                  {feedRange === '24h' ? 'Last 24 hours' : feedRange === '3d' ? 'Last 3 days' : 'Last 7 days'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {newUpdatesCount > 0 && (
                              <button
                                onClick={() => setNewUpdatesCount(0)}
                                className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
                              >
                                Mark all as read
                              </button>
                            )}
                            {storiesUpdatedAt && (
                              <span className="text-xs text-slate-400">
                                Updated {getPreciseRelativeTime(new Date(storiesUpdatedAt).toISOString())}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {displayFeed.map((item, idx) => (
                            <div key={`${item.type}-${item.id}`}>
                              <a
                                href={item.url || '#'}
                                target={item.type === 'story' ? '_blank' : undefined}
                                rel={item.type === 'story' ? 'noopener noreferrer' : undefined}
                                className="block group"
                              >
                                <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${
                                  item.type === 'incident' && item.status === 'active'
                                    ? 'bg-red-50/50 border-red-200 hover:border-red-300'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  {/* Timestamp Column */}
                                  <div className="flex-shrink-0 w-16 text-right">
                                    <span className={`text-xs font-medium ${
                                      isFreshItem(item.timestamp) ? 'text-red-600' : 'text-slate-400'
                                    }`}>
                                      {getPreciseRelativeTime(item.timestamp)}
                                    </span>
                                    {hasRecentActivity && isLiveItem(item.timestamp) && (
                                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 animate-pulse">
                                        LIVE
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-base">{getFeedItemIcon(item)}</span>
                                      <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                                        {getFeedItemLabel(item)}
                                      </span>
                                    </div>
                                    <h3 className="font-medium text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                                      {item.title}
                                    </h3>
                                    {item.summary && (
                                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                        {item.summary}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {/* Thumbnail */}
                                  {item.image_url && (
                                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
                                      <img 
                                        src={item.image_url} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}
                                </div>
                              </a>
                              {/* Insert inline subscribe CTA after every 3rd item */}
                              {(idx + 1) % 3 === 0 && idx < displayFeed.length - 1 && (
                                <div className="my-3">
                                  <InlineSubscribeCTA />
                                </div>
                              )}
                            </div>
                          ))}
                          {displayFeed.length === 0 && (
                            <div className="text-center py-8">
                              <p className="text-slate-600 font-medium mb-1">All caught up!</p>
                              <p className="text-slate-500 text-sm">No recent updates — check back later or browse by topic.</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                ) : (
                  /* Topic View (existing behavior) */
                  <section className="py-10">
                    {visibleCategories.map((category, catIndex) => (
                    <div key={category}>
                      <div id={category} className="scroll-mt-24 mb-10 last:mb-0">
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
                                geoTier={(story as any).geo_tier}
                                geoLabel={(story as any).geo_label}
                                meta={{ time, source }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      {/* Insert inline subscribe CTA after every 2nd category */}
                      {(catIndex + 1) % 2 === 0 && catIndex < visibleCategories.length - 1 && (
                        <InlineSubscribeCTA />
                      )}
                    </div>
                    ))}
                  </section>
                )}
              </>
            )}

            {/* Subscribe CTA */}
            <section id="subscribe" className="scroll-mt-24 border-t border-slate-200 py-10 sm:py-12">
              <div className="mx-auto max-w-xl text-center">
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

            {/* Mobile/Tablet: Incidents + Weekend + Live Music stacked below main content */}
            <div className="xl:hidden mt-6 space-y-4 px-1">
              <LiveIncidentsSidebar />
              <NowHiringWidget />
              <WeekendSidebarWidget />
              <LiveMusicWidget />
            </div>
          </main>

        </div>

        {/* Left shoulder - Live Music - 2xl screens only (avoid overlap on smaller xl screens) */}
        <aside 
          className="hidden 2xl:block fixed top-40 left-6"
          style={{ width: '240px', maxWidth: '260px' }}
        >
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <LiveMusicWidget />
          </div>
        </aside>

        {/* Floating sidebar in right margin - xl screens only */}
        {isSidebarVisible ? (
          <aside 
            className="hidden xl:block fixed top-28 right-4"
            style={{ width: 'calc((100vw - 896px) / 2 - 24px)', minWidth: '180px', maxWidth: '280px' }}
          >
            <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <LiveIncidentsSidebar onHide={() => setIsSidebarVisible(false)} showCloseButton />
              <NowHiringWidget />
              <WeekendSidebarWidget />
              <ReferralProgram />
            </div>
          </aside>
        ) : hasActiveIncidents ? (
          <button
            onClick={() => setIsSidebarVisible(true)}
            className="hidden xl:flex fixed top-28 right-4 items-center gap-2 rounded-full px-3 py-1.5 text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors shadow-sm"
            aria-label="Show live incidents"
          >
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Live
            {activeIncidentCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium">
                {activeIncidentCount}
              </span>
            )}
          </button>
        ) : null}
      </div>
    </PageShell>
  );
};

export default LakeGeneva;
