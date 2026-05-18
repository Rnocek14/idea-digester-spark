import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { 
  Fish, MapPin, Clock, DollarSign, ExternalLink, CheckCircle2, 
  AlertCircle, Filter, Star, ChevronDown, Waves, Users, Utensils
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Types
interface FishFryDeal {
  id: string;
  name: string;
  days: string[] | null;
  start_time: string | null;
  end_time: string | null;
  price: string | null;
  fish_type: string | null;
  all_you_can_eat: boolean | null;
  sides: string | null;
  description: string | null;
  verification_status: string | null;
  verification_method: string | null;
  evidence_url: string | null;
  evidence_snippet: string | null;
  last_confirmed_at: string | null;
  confidence_score: number | null;
  restaurant: {
    id: string;
    name: string;
    slug: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    is_lakefront: boolean | null;
    features: string[] | null;
  } | null;
}

// Sort options
type SortOption = "recently_confirmed" | "best_value" | "alphabetical" | "price_low" | "price_high";

// Filter state
interface Filters {
  day: string;
  ayce: boolean;
  fishType: string;
  priceMax: string;
  lakefront: boolean;
  verified: boolean;
}

const DAYS = ["Friday", "Saturday", "Sunday", "Thursday", "Wednesday"];
const FISH_TYPES = ["Cod", "Perch", "Walleye", "Bluegill", "Haddock", "Pollock"];

// Extract price as number for sorting
const extractPrice = (price: string | null): number => {
  if (!price) return 999;
  const match = price.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : 999;
};

// Calculate "value score" for sorting
const calculateValueScore = (deal: FishFryDeal): number => {
  let score = 100;
  const price = extractPrice(deal.price);
  score -= price * 2; // Lower price = higher score
  if (deal.all_you_can_eat) score += 30;
  if (deal.sides) score += 10;
  if (deal.verification_status === "verified") score += 15;
  return score;
};

// Get freshness label
const getFreshnessLabel = (lastConfirmed: string | null): { label: string; color: string } => {
  if (!lastConfirmed) return { label: "Unconfirmed", color: "text-muted-foreground" };
  const days = differenceInDays(new Date(), new Date(lastConfirmed));
  if (days <= 7) return { label: "Just confirmed", color: "text-green-600" };
  if (days <= 30) return { label: `${days}d ago`, color: "text-green-600" };
  if (days <= 45) return { label: `${days}d ago`, color: "text-amber-600" };
  return { label: "May be outdated", color: "text-red-500" };
};

// Verification badge
const VerificationBadge = ({ status, method }: { status: string | null; method: string | null }) => {
  if (status === "verified") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Verified
      </Badge>
    );
  }
  if (status === "community_verified") {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        <Users className="w-3 h-3 mr-1" />
        Community
      </Badge>
    );
  }
  if (method === "pdf") {
    return (
      <Badge variant="secondary" className="text-xs">
        PDF menu
      </Badge>
    );
  }
  return null;
};

const FishFryGuide = () => {
  const today = new Date();
  const isFriday = today.getDay() === 5;
  
  // Filters
  const [filters, setFilters] = useState<Filters>({
    day: "all",
    ayce: false,
    fishType: "all",
    priceMax: "all",
    lakefront: false,
    verified: false,
  });
  
  const [sortBy, setSortBy] = useState<SortOption>("recently_confirmed");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch fish fry deals with restaurant data
  const { data: deals, isLoading, error } = useQuery({
    queryKey: ["fish-fry-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_deals")
        .select(`
          id, name, days, start_time, end_time, price, fish_type, 
          all_you_can_eat, sides, description, verification_status, 
          verification_method, evidence_url, evidence_snippet, 
          last_confirmed_at, confidence_score,
          restaurant:restaurants(id, name, slug, website, phone, address, city, is_lakefront, features)
        `)
        .eq("deal_type", "fish_fry")
        .neq("verification_status", "outdated")
        .order("last_confirmed_at", { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      return (data || []) as unknown as FishFryDeal[];
    },
  });

  // Apply filters and sort
  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    let result = deals.filter(deal => {
      // Day filter
      if (filters.day !== "all") {
        if (!deal.days?.some(d => d.toLowerCase() === filters.day.toLowerCase())) {
          return false;
        }
      }
      
      // AYCE filter
      if (filters.ayce && !deal.all_you_can_eat) return false;
      
      // Fish type filter
      if (filters.fishType !== "all") {
        if (!deal.fish_type?.toLowerCase().includes(filters.fishType.toLowerCase())) {
          return false;
        }
      }
      
      // Price filter
      if (filters.priceMax !== "all") {
        const maxPrice = parseFloat(filters.priceMax);
        const dealPrice = extractPrice(deal.price);
        if (dealPrice > maxPrice) return false;
      }
      
      // Lakefront filter
      if (filters.lakefront && !deal.restaurant?.is_lakefront) return false;
      
      // Verified filter
      if (filters.verified && deal.verification_status !== "verified" && deal.verification_status !== "community_verified") {
        return false;
      }
      
      return true;
    });
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "recently_confirmed":
          const aDate = a.last_confirmed_at ? new Date(a.last_confirmed_at).getTime() : 0;
          const bDate = b.last_confirmed_at ? new Date(b.last_confirmed_at).getTime() : 0;
          return bDate - aDate;
        case "best_value":
          return calculateValueScore(b) - calculateValueScore(a);
        case "alphabetical":
          return (a.restaurant?.name || "").localeCompare(b.restaurant?.name || "");
        case "price_low":
          return extractPrice(a.price) - extractPrice(b.price);
        case "price_high":
          return extractPrice(b.price) - extractPrice(a.price);
        default:
          return 0;
      }
    });
    
    return result;
  }, [deals, filters, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (!deals) return { total: 0, verified: 0, ayce: 0 };
    return {
      total: deals.length,
      verified: deals.filter(d => d.verification_status === "verified" || d.verification_status === "community_verified").length,
      ayce: deals.filter(d => d.all_you_can_eat).length,
    };
  }, [deals]);

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "day" || key === "fishType" || key === "priceMax") return value !== "all";
    return value === true;
  }).length;

  return (
    <PageShell>
      <PageMeta
        title="Lake Geneva Fish Fry Guide – Friday Night Fish Frys"
        description="The definitive Friday fish fry directory for Lake Geneva and Walworth County, with prices, hours, and what's on the menu."
        path="/eats/fish-fry"
      />
      {/* Hero Section */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 mb-8 overflow-hidden rounded-b-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 px-6 py-12 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgNTBjMjAtMTAgMzAtMjAgNTAtMjBzMzAgMTAgNTAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2Utb3BhY2l0eT0iMC4zIi8+PC9zdmc+')] bg-repeat"></div>
        </div>
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Fish className="h-5 w-5 text-cyan-300" />
            <span className="text-sm font-medium text-cyan-300 uppercase tracking-wider">Lake Geneva Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 flex items-center gap-3">
            Friday Fish Fry 
            {isFriday && (
              <Badge className="bg-amber-500 text-white text-sm animate-pulse">
                🐟 TODAY!
              </Badge>
            )}
          </h1>
          <p className="text-lg text-blue-100 mb-4">
            The definitive guide to fish fry in the Lake Geneva area. Updated weekly.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-blue-200">
            <span className="flex items-center gap-1">
              <Utensils className="h-4 w-4" />
              {stats.total} spots
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {stats.verified} verified
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {stats.ayce} all-you-can-eat
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Day Filter */}
                    <div className="space-y-2">
                      <Label>Day</Label>
                      <Select value={filters.day} onValueChange={(v) => setFilters(f => ({ ...f, day: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All days</SelectItem>
                          {DAYS.map(day => (
                            <SelectItem key={day} value={day}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Fish Type Filter */}
                    <div className="space-y-2">
                      <Label>Fish Type</Label>
                      <Select value={filters.fishType} onValueChange={(v) => setFilters(f => ({ ...f, fishType: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {FISH_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Price Filter */}
                    <div className="space-y-2">
                      <Label>Max Price</Label>
                      <Select value={filters.priceMax} onValueChange={(v) => setFilters(f => ({ ...f, priceMax: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any price" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any price</SelectItem>
                          <SelectItem value="15">Under $15</SelectItem>
                          <SelectItem value="20">Under $20</SelectItem>
                          <SelectItem value="25">Under $25</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Toggle Filters */}
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="ayce" 
                        checked={filters.ayce}
                        onCheckedChange={(v) => setFilters(f => ({ ...f, ayce: v }))}
                      />
                      <Label htmlFor="ayce">All-You-Can-Eat only</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="lakefront" 
                        checked={filters.lakefront}
                        onCheckedChange={(v) => setFilters(f => ({ ...f, lakefront: v }))}
                      />
                      <Label htmlFor="lakefront" className="flex items-center gap-1">
                        <Waves className="h-4 w-4" /> Lakefront only
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="verified" 
                        checked={filters.verified}
                        onCheckedChange={(v) => setFilters(f => ({ ...f, verified: v }))}
                      />
                      <Label htmlFor="verified" className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Verified only
                      </Label>
                    </div>
                  </div>
                  
                  {activeFiltersCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => setFilters({ day: "all", ayce: false, fishType: "all", priceMax: "all", lakefront: false, verified: false })}
                    >
                      Clear all filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recently_confirmed">Most recently confirmed</SelectItem>
              <SelectItem value="best_value">Best value</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
            </SelectContent>
          </Select>
          
          <span className="text-sm text-muted-foreground">
            {filteredDeals.length} result{filteredDeals.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load fish fry data</p>
          </CardContent>
        </Card>
      ) : filteredDeals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Fish className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg mb-2">No fish fry spots found</h3>
            <p>Try adjusting your filters or check back later.</p>
            {activeFiltersCount > 0 && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setFilters({ day: "all", ayce: false, fishType: "all", priceMax: "all", lakefront: false, verified: false })}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDeals.map(deal => {
            const freshness = getFreshnessLabel(deal.last_confirmed_at);
            
            return (
              <Card key={deal.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg leading-tight">
                        {deal.restaurant?.name || "Unknown Restaurant"}
                      </CardTitle>
                      {deal.restaurant?.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {deal.restaurant.address}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <VerificationBadge status={deal.verification_status} method={deal.verification_method} />
                      {deal.restaurant?.is_lakefront && (
                        <Badge variant="outline" className="text-xs">
                          <Waves className="h-3 w-3 mr-1" /> Lakefront
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Key details */}
                  <div className="flex flex-wrap gap-2">
                    {deal.price && (
                      <Badge variant="secondary" className="text-sm font-semibold">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {deal.price}
                      </Badge>
                    )}
                    {deal.all_you_can_eat && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Star className="h-3 w-3 mr-1" />
                        All-You-Can-Eat
                      </Badge>
                    )}
                    {deal.fish_type && (
                      <Badge variant="outline">
                        <Fish className="h-3 w-3 mr-1" />
                        {deal.fish_type}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Days & Times */}
                  {(deal.days?.length || deal.start_time) && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {deal.days?.join(", ")}
                        {deal.start_time && ` • ${deal.start_time}`}
                        {deal.end_time && `-${deal.end_time}`}
                      </span>
                    </div>
                  )}
                  
                  {/* Sides */}
                  {deal.sides && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Sides:</span> {deal.sides}
                    </p>
                  )}
                  
                  {/* Description */}
                  {deal.description && (
                    <p className="text-sm text-foreground line-clamp-2">
                      {deal.description}
                    </p>
                  )}
                  
                  {/* Evidence snippet */}
                  {deal.evidence_snippet && deal.verification_status !== "verified" && (
                    <div className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground italic">
                      "{deal.evidence_snippet}"
                    </div>
                  )}
                  
                  {/* Footer: freshness + links */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className={`text-xs ${freshness.color}`}>
                      {freshness.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {deal.evidence_url && (
                        <a 
                          href={deal.evidence_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {deal.restaurant?.website && (
                        <a 
                          href={deal.restaurant.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {deal.restaurant?.phone && (
                        <a 
                          href={`tel:${deal.restaurant.phone}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {deal.restaurant.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-12">
        <InlineSubscribeCTA />
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Know a fish fry spot we're missing? <a href="/eats" className="text-primary hover:underline">Submit a tip</a>
        </p>
        <p className="mt-1">
          Data updated automatically via website scraping. Last refresh: {format(new Date(), "MMM d, yyyy")}
        </p>
      </div>
    </PageShell>
  );
};

export default FishFryGuide;
