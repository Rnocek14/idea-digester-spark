import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { StoryCard } from "@/components/StoryCard";
import WeatherWidget from "@/components/WeatherWidget";
import LiveIncidentsSidebar from "@/components/LiveIncidentsSidebar";
import WeekendSidebarWidget from "@/components/WeekendSidebarWidget";
import AlsoTodayCard from "@/components/AlsoTodayCard";

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

const categoryOrder = ["news", "civic", "schools", "events", "dining", "real_estate", "community"];

// Real estate market metrics for rotating display
const REAL_ESTATE_MARKET_METRICS = [
  { medianPrice: "$485K", yoyChange: "+6.2%", daysOnMarket: "28" },
  { medianPrice: "$492K", yoyChange: "+4.8%", daysOnMarket: "31" },
  { medianPrice: "$478K", yoyChange: "+7.1%", daysOnMarket: "25" },
  { medianPrice: "$501K", yoyChange: "+5.4%", daysOnMarket: "29" },
  { medianPrice: "$488K", yoyChange: "+6.5%", daysOnMarket: "27" },
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

const getRealEstateMarketMetrics = (sponsor: Sponsor | null) => {
  // Simple, stable rotation: one metric set per day
  if (REAL_ESTATE_MARKET_METRICS.length === 0) return { medianPrice: "$485K", yoyChange: "+6.2%", daysOnMarket: "28" };

  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const idx = dayIndex % REAL_ESTATE_MARKET_METRICS.length;

  return REAL_ESTATE_MARKET_METRICS[idx];
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
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'topic' | 'recent'>('topic');
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const previousFeedIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    document.title = "Lake Geneva Brief – Today's Local News";
  }, []);

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

  // Topic-specific civic image libraries for smart keyword mapping
  type CivicTopic = 'land_use' | 'historic' | 'council' | 'parks' | 'lakefront' | 'library' | 'safety' | 'tourism' | 'utilities' | 'finance' | 'default';

  const CIVIC_IMAGE_LIBRARIES: Record<CivicTopic, string[]> = {
    land_use: [
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80", // House/development concept
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80", // Construction site
      "https://images.unsplash.com/photo-1486325212027-8a9ce835dc2e?w=800&q=80", // Suburban neighborhood aerial
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80", // Residential development
    ],
    historic: [
      "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80", // Small town downtown
      "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80", // Old brick commercial building
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80", // Small town main street
      "https://images.unsplash.com/photo-1594398028856-9b00722cefbc?w=800&q=80", // Tree-lined residential street
    ],
    council: [
      "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80", // Council meeting room
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80", // Business meeting at table
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80", // People in discussion
      "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80", // Government/office interior
    ],
    parks: [
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80", // Green park
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80", // Forest path
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800&q=80", // Nature scene
    ],
    lakefront: [
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80", // Lake waves
      "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80", // Calm lake
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", // Lake pier
    ],
    library: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80", // Library interior
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80", // Bookshelves
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80", // Reading room
    ],
    safety: [
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80", // Public safety
      "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&q=80", // Emergency services
    ],
    tourism: [
      "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80", // Downtown street
      "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=800&q=80", // Town square
    ],
    utilities: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", // Utility infrastructure
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", // Office building
    ],
    finance: [
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80", // Financial documents
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", // Business meeting
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
  const { data: stories = [], isLoading: storiesLoading, dataUpdatedAt: storiesUpdatedAt } = useQuery({
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
        .lte("publish_date", new Date().toISOString()) // Only show today or past
        .order("is_breaking", { ascending: false })
        .order("publish_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Replace generic civic images with topic-aware curated ones
      return (data || []).map((story: any) => ({
        ...story,
        image_url: isGenericCivicImage(story.image_url) 
          ? getCuratedCivicImage(story.id, story.title) 
          : story.image_url
      }));
    },
    staleTime: 60000,
    refetchInterval: viewMode === 'recent' ? 30000 : false, // Auto-refresh every 30s in recent view
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
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Good morning, Lake Geneva
                        </p>
                        <h1 className="font-semibold text-2xl sm:text-3xl leading-tight text-slate-900">
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
                        <div className="relative h-52 sm:h-56">
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

            {/* Sponsor Block */}
            {sponsor && (
              <section className="py-8 border-b border-slate-200">
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
                  
                  {/* Market Insight Widget for Real Estate Sponsors */}
                  {isRealEstateSponsor(sponsor) && (() => {
                    const metrics = getRealEstateMarketMetrics(sponsor);
                    return (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden border-l-4 border-l-blue-500">
                        {/* Header */}
                        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                          <span className="text-slate-600">🏡</span>
                          <span className="text-xs font-semibold text-slate-700">Lake Geneva Market</span>
                        </div>
                        
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-px bg-slate-200">
                          <div className="bg-white px-3 py-3 text-center">
                            <div className="text-lg font-bold text-slate-900">{metrics.medianPrice}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Median Price</div>
                          </div>
                          <div className="bg-white px-3 py-3 text-center">
                            <div className="text-lg font-bold text-emerald-600 flex items-center justify-center gap-1">
                              <span>↑</span>
                              <span>{metrics.yoyChange}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">YoY Change</div>
                          </div>
                          <div className="bg-white px-3 py-3 text-center">
                            <div className="text-lg font-bold text-slate-900">{metrics.daysOnMarket}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Days on Market</div>
                          </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="px-4 py-2 bg-white border-t border-slate-100">
                          <p className="text-[10px] text-slate-500">Market insight by {sponsor?.name}</p>
                        </div>
                      </div>
                    );
                  })()}
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
                {/* View Toggle + Category Filter Pills */}
                <section className="py-4 border-b border-slate-200 sticky top-[73px] z-20 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
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
                        {viewMode === 'topic' && newUpdatesCount > 0 ? (
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
                            {cat === 'all' ? 'All stories' : `${getCategoryEmoji(cat)} ${cat.replace('_', ' ')}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Most Recent Feed */}
                {viewMode === 'recent' ? (
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
                          {storiesUpdatedAt && (
                            <span className="text-xs text-slate-400">
                              Updated {getPreciseRelativeTime(new Date(storiesUpdatedAt).toISOString())}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          {displayFeed.map((item) => (
                            <a
                              key={`${item.type}-${item.id}`}
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
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                      <span className="text-[10px] font-semibold text-red-600 uppercase">Live</span>
                                    </div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      item.type === 'incident'
                                        ? item.status === 'active' 
                                          ? 'bg-red-100 text-red-700' 
                                          : 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      <span>{getFeedItemIcon(item)}</span>
                                      <span>{getFeedItemLabel(item)}</span>
                                    </span>
                                    {item.type === 'incident' && item.status === 'active' && (
                                      <span className="text-[10px] font-medium text-red-600 uppercase">Active</span>
                                    )}
                                  </div>
                                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {item.title}
                                  </h3>
                                  {item.summary && (
                                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                                      {item.summary}
                                    </p>
                                  )}
                                </div>

                                {/* Optional Image */}
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
                          ))}
                          
                          {displayFeed.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                              No recent updates. Check back soon!
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                ) : (
                  /* Topic View (existing behavior) */
                  <section className="py-10">
                    {visibleCategories.map((category) => (
                    <div key={category} id={category} className="scroll-mt-24 mb-10 last:mb-0">
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
          </main>

        </div>

        {/* Floating sidebar in right margin - xl screens only */}
        {isSidebarVisible ? (
          <aside 
            className="hidden xl:block fixed top-28 right-4"
            style={{ width: 'calc((100vw - 896px) / 2 - 24px)', minWidth: '180px', maxWidth: '280px' }}
          >
            <div className="space-y-4">
              <LiveIncidentsSidebar onHide={() => setIsSidebarVisible(false)} showCloseButton />
              <WeekendSidebarWidget />
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

        {/* Mobile/Tablet: Incidents + Weekend stacked below hero */}
        <div className="xl:hidden mt-6 space-y-4">
          <LiveIncidentsSidebar />
          <WeekendSidebarWidget />
        </div>
      </div>
    </PageShell>
  );
};

export default LakeGeneva;
