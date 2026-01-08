import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Utensils, MapPin, Clock, ArrowRight, Star, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";

type EatsContent = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  event_date: string | null;
  original_url: string | null;
  image_url: string | null;
  category: string | null;
  metadata: {
    verticals?: string[];
    content_tags?: string[];
  } | null;
};

// Known restaurants for extraction
const KNOWN_RESTAURANTS = [
  "Pier 290",
  "Sopra Bistro",
  "Popeye's",
  "Simple Cafe",
  "Egg Harbor Cafe",
  "Next Door Pub",
  "Geneva ChopHouse",
  "Barrique Bistro",
  "Grand Geneva",
  "Baker House",
  "The Abbey Resort",
  "Mars Resort",
  "Lake Geneva Country Meats",
  "Sprecher's",
  "Oakfire",
  "Riva",
  "Tuscan Tavern",
  "Chuck's Lakeshore Inn",
];

const extractRestaurant = (title: string): string | null => {
  for (const restaurant of KNOWN_RESTAURANTS) {
    if (title.toLowerCase().includes(restaurant.toLowerCase())) {
      return restaurant;
    }
  }
  const atMatch = title.match(/at\s+([^,–-]+)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }
  return null;
};

const LakeGenevaEats = () => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Fetch eats/dining content
  const { data: eatsContent, isLoading } = useQuery({
    queryKey: ["eats-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, summary, content, event_date, original_url, image_url, category, metadata")
        .in("status", ["published", "auto_published", "approved"])
        .or("category.eq.dining,category.eq.restaurant,category.eq.food,metadata->verticals.cs.[\"eats\"],metadata->verticals.cs.[\"dining\"],metadata->verticals.cs.[\"food\"]")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as EatsContent[];
    },
  });

  // Categorize content - prefer metadata dining_category, fallback to title keywords
  const categorize = (c: EatsContent) => {
    const diningCat = (c.metadata as any)?.dining_category;
    if (diningCat) return diningCat;
    
    const text = c.title.toLowerCase();
    if (text.includes("opening") || text.includes("new restaurant") || text.includes("coming soon") || text.includes("now open")) {
      return "restaurant-opening";
    }
    if (text.includes("deal") || text.includes("special") || text.includes("happy hour") || text.includes("discount")) {
      return "restaurant-deal";
    }
    if (text.includes("review") || text.includes("best") || text.includes("top") || text.includes("rating")) {
      return "restaurant-review";
    }
    if (text.includes("fish fry") || text.includes("wine dinner") || text.includes("tasting") || text.includes("event")) {
      return "dining-event";
    }
    return "restaurant-feature";
  };

  const newOpenings = eatsContent?.filter(c => categorize(c) === "restaurant-opening") || [];
  const deals = eatsContent?.filter(c => categorize(c) === "restaurant-deal") || [];
  const reviews = eatsContent?.filter(c => categorize(c) === "restaurant-review") || [];
  const diningEvents = eatsContent?.filter(c => categorize(c) === "dining-event") || [];
  const features = eatsContent?.filter(c => categorize(c) === "restaurant-feature") || [];

  // Extract unique restaurants
  const allContent = eatsContent || [];
  const restaurants = [...new Set(allContent.map(c => extractRestaurant(c.title)).filter(Boolean))] as string[];

  return (
    <PageShell>
      {/* Hero Section */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 mb-8 overflow-hidden rounded-b-3xl bg-gradient-to-br from-amber-900 via-orange-800 to-red-900 px-6 py-12 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Utensils className="h-5 w-5 text-amber-300" />
            <span className="text-sm font-medium text-amber-300 uppercase tracking-wider">Lake Geneva Dining</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Eats & Restaurants</h1>
          <p className="text-lg text-orange-100 mb-4">
            The latest dining news, new openings, and local restaurant updates.
          </p>
          <div className="flex items-center gap-4 text-sm text-orange-200">
            <span className="flex items-center gap-1">
              <Utensils className="h-4 w-4" />
              {allContent.length} stories
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {restaurants.length} restaurants
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* New Openings */}
          {newOpenings.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🆕</span>
                <h2 className="text-xl font-bold text-slate-900">New & Opening Soon</h2>
              </div>
              <div className="space-y-3">
                {newOpenings.map(item => (
                  <EatsCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Deals & Specials */}
          {deals.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💰</span>
                <h2 className="text-xl font-bold text-slate-900">Deals & Specials</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {deals.map(item => (
                  <EatsCard key={item.id} item={item} compact />
                ))}
              </div>
            </section>
          )}

          {/* Reviews & Guides */}
          {reviews.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⭐</span>
                <h2 className="text-xl font-bold text-slate-900">Reviews & Guides</h2>
              </div>
              <div className="space-y-3">
                {reviews.map(item => (
                  <EatsCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Dining Events (Fish Fry, Wine Dinners, etc.) */}
          {diningEvents.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🐟</span>
                <h2 className="text-xl font-bold text-slate-900">Dining Events</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {diningEvents.map(item => (
                  <EatsCard key={item.id} item={item} compact />
                ))}
              </div>
            </section>
          )}

          {/* Restaurant Features & News */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🍽️</span>
              <h2 className="text-xl font-bold text-slate-900">Restaurant Features</h2>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : features.length === 0 && newOpenings.length === 0 && deals.length === 0 && reviews.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-slate-500">
                  <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No dining content yet</p>
                  <p className="text-sm mt-1">Run the dining sync or add sources with category "dining"</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {features.slice(0, 10).map(item => (
                  <EatsCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* Subscribe CTA */}
          <div className="pt-4">
            <InlineSubscribeCTA />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Restaurant Directory */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                Featured Restaurants
              </h3>
              {restaurants.length > 0 ? (
                <div className="space-y-2">
                  {restaurants.slice(0, 10).map(restaurant => (
                    <div 
                      key={restaurant} 
                      className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer flex items-center justify-between group"
                    >
                      <span>{restaurant}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No restaurants extracted yet</p>
              )}
            </CardContent>
          </Card>

          {/* Content Stats */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-600" />
                Content Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">New Openings</span>
                  <span className="font-medium">{newOpenings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Deals & Specials</span>
                  <span className="font-medium">{deals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Reviews</span>
                  <span className="font-medium">{reviews.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Dining Events</span>
                  <span className="font-medium">{diningEvents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Features</span>
                  <span className="font-medium">{features.length}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-slate-600">Total</span>
                  <span className="font-semibold">{allContent.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
};

// Eats Card Component
const EatsCard = ({ 
  item, 
  compact = false,
}: { 
  item: EatsContent; 
  compact?: boolean;
}) => {
  const restaurant = extractRestaurant(item.title);
  
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className={compact ? "p-4" : "p-4 sm:p-5"}>
        <div className="flex gap-4">
          {item.image_url && !compact && (
            <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
              <img 
                src={item.image_url} 
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {item.category && (
                  <Badge variant="outline" className="mb-1.5 text-xs capitalize">
                    {item.category}
                  </Badge>
                )}
                <h3 className={`font-semibold text-slate-900 ${compact ? "text-sm line-clamp-2" : "line-clamp-2"}`}>
                  {item.title}
                </h3>
                {restaurant && (
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {restaurant}
                  </p>
                )}
              </div>
            </div>
            {!compact && item.summary && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{item.summary}</p>
            )}
            {item.original_url && (
              <a 
                href={item.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 mt-2"
              >
                Read more <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LakeGenevaEats;
