import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Utensils, MapPin, Clock, ArrowRight, Star, Calendar, ExternalLink, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { LG_CORE_KEYWORDS, LG_GEO_KEYWORDS } from "@/lib/seoKeywords";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";

type EatsContent = {
  id: string;
  title: string;
  summary: string | null;
  content_website?: string | null;
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

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  website: string | null;
  phone: string | null;
  hours: Record<string, string> | null;
  fish_fry: {
    available?: boolean;
    day?: string;
    price?: string;
    description?: string;
  } | null;
  happy_hour: {
    days?: string[];
    times?: string;
    deals?: string[];
  } | null;
  weekly_specials: Array<{ day: string; name: string; description?: string }> | null;
  tags: string[] | null;
  categories: string[] | null;
  last_scraped_at: string | null;
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

  // Fetch scraped restaurant data
  const { data: restaurantsData } = useQuery({
    queryKey: ["restaurants-scraped"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return data as unknown as Restaurant[];
    },
  });

  // Fetch eats/dining content
  const { data: eatsContent, isLoading } = useQuery({
    queryKey: ["eats-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, summary, content, content_website, event_date, original_url, image_url, category, metadata")
        .in("status", ["published", "auto_published"])
        .or("category.eq.dining,category.eq.restaurant,category.eq.food,metadata->verticals.cs.[\"eats\"],metadata->verticals.cs.[\"dining\"],metadata->verticals.cs.[\"food\"]")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Deduplicate by title (normalized) to avoid showing same story multiple times
      const seen = new Set<string>();
      const deduplicated = (data || []).filter(item => {
        const key = item.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      return deduplicated as EatsContent[];
    },
  });

  // Filter restaurants with fish fry
  const fishFryRestaurants = restaurantsData?.filter(r => r.fish_fry?.available) || [];
  const happyHourRestaurants = restaurantsData?.filter(r => r.happy_hour?.times) || [];

  // Categorize content - prefer metadata dining_category, fallback to title keywords
  const categorize = (c: EatsContent) => {
    const diningCat = (c.metadata as any)?.dining_category;
    if (diningCat) return diningCat;
    
    const text = c.title.toLowerCase();
    // Fish fry is special for Lake Geneva!
    if (text.includes("fish fry")) {
      return "fish-fry";
    }
    if (text.includes("closing") || text.includes("closes") || text.includes("last day")) {
      return "restaurant-closing";
    }
    if (text.includes("opening") || text.includes("new restaurant") || text.includes("coming soon") || text.includes("now open")) {
      return "restaurant-opening";
    }
    if (text.includes("deal") || text.includes("special") || text.includes("happy hour") || text.includes("discount")) {
      return "restaurant-deal";
    }
    if (text.includes("review") || text.includes("best") || text.includes("top") || text.includes("rating")) {
      return "restaurant-review";
    }
    if (text.includes("wine dinner") || text.includes("tasting") || text.includes("brunch")) {
      return "dining-event";
    }
    return "restaurant-feature";
  };

  // Categorized content
  const fishFry = eatsContent?.filter(c => categorize(c) === "fish-fry") || [];
  const newOpenings = eatsContent?.filter(c => categorize(c) === "restaurant-opening") || [];
  const closings = eatsContent?.filter(c => categorize(c) === "restaurant-closing") || [];
  const deals = eatsContent?.filter(c => categorize(c) === "restaurant-deal") || [];
  const reviews = eatsContent?.filter(c => categorize(c) === "restaurant-review") || [];
  const diningEvents = eatsContent?.filter(c => categorize(c) === "dining-event") || [];
  const features = eatsContent?.filter(c => categorize(c) === "restaurant-feature") || [];

  // Extract unique restaurants
  const allContent = eatsContent || [];
  const restaurants = [...new Set(allContent.map(c => extractRestaurant(c.title)).filter(Boolean))] as string[];
  
  // Get today's day of week for Fish Fry highlight
  const isFriday = today.getDay() === 5;

  return (
    <PageShell>
      <PageMeta
        title="Lake Geneva Eats — Restaurants, Openings & Dining News"
        description="The latest Lake Geneva dining news, new restaurant openings, weekly specials, and where locals are eating this week."
        path="/eats"
        keywords={[
          ...LG_CORE_KEYWORDS,
          ...LG_GEO_KEYWORDS,
          "Lake Geneva restaurants",
          "Lake Geneva dining",
          "best restaurants Lake Geneva",
          "new restaurants Lake Geneva",
          "where to eat Lake Geneva",
          "Lake Geneva brunch",
          "Lake Geneva happy hour",
          "Lake Geneva fish fry",
        ]}
      />
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
          <div className="mt-4">
            <Link
              to="/best-of/restaurants-lake-geneva"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium text-white transition-colors backdrop-blur-sm"
            >
              <Heart className="h-4 w-4 text-rose-300" />
              See what locals are talking about →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Friday Fish Fry - Lake Geneva staple! */}
          <section className={isFriday ? "bg-blue-50 -mx-4 px-4 py-6 rounded-xl border-2 border-blue-200" : ""}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🐟</span>
              <h2 className="text-xl font-bold text-slate-900">
                Friday Fish Fry {isFriday && <Badge className="ml-2 bg-blue-600">Today!</Badge>}
              </h2>
            </div>
            
            {/* Scraped Fish Fry Restaurants */}
            {fishFryRestaurants.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-3">🔥 Local spots serving fish fry:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fishFryRestaurants.map(restaurant => (
                    <Card key={restaurant.id} className="bg-white">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-slate-900">{restaurant.name}</h3>
                            {restaurant.fish_fry?.price && (
                              <p className="text-sm text-green-700 font-medium">{restaurant.fish_fry.price}</p>
                            )}
                            {restaurant.fish_fry?.description && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{restaurant.fish_fry.description}</p>
                            )}
                          </div>
                          {restaurant.website && (
                            <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Content about fish fry */}
            {fishFry.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {fishFry.map(item => (
                  <EatsCard key={item.id} item={item} compact />
                ))}
              </div>
            ) : fishFryRestaurants.length === 0 && (
              <Card className="border-dashed border-blue-200 bg-blue-50/50">
                <CardContent className="py-6 text-center text-slate-600">
                  <p className="font-medium">🐟 Fish Fry is a Lake Geneva tradition!</p>
                  <p className="text-sm mt-1">Check back for the best local fish fry spots.</p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Happy Hour Guide */}
          {happyHourRestaurants.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🍸</span>
                <h2 className="text-xl font-bold text-slate-900">Happy Hour Guide</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {happyHourRestaurants.map(restaurant => (
                  <Card key={restaurant.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-slate-900">{restaurant.name}</h3>
                          {restaurant.happy_hour?.times && (
                            <p className="text-sm text-orange-700 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {restaurant.happy_hour.times}
                            </p>
                          )}
                          {restaurant.happy_hour?.days && (
                            <p className="text-xs text-slate-600 mt-1">
                              {restaurant.happy_hour.days.join(", ")}
                            </p>
                          )}
                          {restaurant.happy_hour?.deals && restaurant.happy_hour.deals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {restaurant.happy_hour.deals.slice(0, 3).map((deal, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {deal}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {restaurant.website && (
                          <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-800">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

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

          {/* Closings - important news! */}
          {closings.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📍</span>
                <h2 className="text-xl font-bold text-slate-900">Closing Soon</h2>
              </div>
              <div className="space-y-3">
                {closings.map(item => (
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
          {/* Scraped Restaurant Directory */}
          {restaurantsData && restaurantsData.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-orange-600" />
                  Restaurant Directory
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {restaurantsData.length} spots
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {restaurantsData.slice(0, 12).map(restaurant => (
                    <div key={restaurant.id} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900">{restaurant.name}</span>
                        <div className="flex gap-1">
                          {restaurant.fish_fry?.available && <span title="Fish Fry">🐟</span>}
                          {restaurant.happy_hour?.times && <span title="Happy Hour">🍸</span>}
                        </div>
                      </div>
                      {restaurant.website && (
                        <a 
                          href={restaurant.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {restaurantsData.some(r => r.last_scraped_at) && (
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t">
                    Last updated: {format(new Date(restaurantsData.find(r => r.last_scraped_at)?.last_scraped_at || ""), "MMM d, yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Featured Restaurants from Content */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                In the News
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
                <p className="text-sm text-slate-500">No restaurants in recent news</p>
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
                  <span className="text-slate-600">🐟 Fish Fry</span>
                  <span className="font-medium">{fishFry.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">🆕 New Openings</span>
                  <span className="font-medium">{newOpenings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">📍 Closings</span>
                  <span className="font-medium">{closings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">💰 Deals</span>
                  <span className="font-medium">{deals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">⭐ Reviews</span>
                  <span className="font-medium">{reviews.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">🎉 Events</span>
                  <span className="font-medium">{diningEvents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">🍽️ Features</span>
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
  const [open, setOpen] = useState(false);
  const body = item.content_website || item.summary || item.content;
  
  return (
    <>
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className="group hover:shadow-md transition-shadow cursor-pointer"
    >
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
            {!compact && (item.content_website || item.summary) && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                {item.content_website || item.summary}
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-orange-600 group-hover:text-orange-700 mt-2">
              Read more <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {item.category && (
            <Badge variant="outline" className="w-fit text-xs capitalize mb-1">
              {item.category}
            </Badge>
          )}
          <DialogTitle className="text-2xl leading-tight">{item.title}</DialogTitle>
          {restaurant && (
            <DialogDescription className="flex items-center gap-1 text-slate-600">
              <MapPin className="h-3 w-3" />
              {restaurant}
            </DialogDescription>
          )}
        </DialogHeader>
        {item.image_url && (
          <div className="w-full max-h-72 overflow-hidden rounded-lg bg-slate-100">
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {body && (
          <div className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
        )}
        {item.original_url && (
          <div className="pt-3 border-t">
            <a
              href={item.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              View original source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default LakeGenevaEats;
