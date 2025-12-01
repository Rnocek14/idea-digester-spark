import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ExternalLink, Mail, Phone, MapPin, Star, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Business = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  is_featured: boolean | null;
};

type BusinessWithSponsor = Business & {
  is_sponsor: boolean;
  placementId?: string;
};

const getCategoryColor = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "real estate": return "bg-green-500/10 text-green-700 dark:text-green-300";
    case "dining": return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "retail": return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
    case "services": return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "hospitality": return "bg-pink-500/10 text-pink-700 dark:text-pink-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const PublicDirectory = () => {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch all active businesses
  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ["public-directory"],
    queryFn: async () => {
      const { data: businessData, error: businessError } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (businessError) throw businessError;

      // Fetch active sponsors to badge them
      const today = new Date().toISOString().split("T")[0];
      const { data: sponsorData } = await supabase
        .from("ad_placements")
        .select("business_id, id")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today);

      const sponsorMap = new Map(sponsorData?.map((s) => [s.business_id, s.id]) || []);

      return (businessData as Business[]).map((business) => ({
        ...business,
        is_sponsor: sponsorMap.has(business.id),
        placementId: sponsorMap.get(business.id),
      })) as BusinessWithSponsor[];
    },
    staleTime: 60000, // 1 minute
  });

  // Get unique categories
  const categories = Array.from(new Set(businesses.map((b) => b.category).filter(Boolean)));

  // Filter businesses
  const filteredBusinesses =
    categoryFilter === "all"
      ? businesses
      : businesses.filter((b) => b.category === categoryFilter);

  // Sort: sponsors first, then featured, then alphabetical
  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    if (a.is_sponsor !== b.is_sponsor) return a.is_sponsor ? -1 : 1;
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Lake Geneva Business Directory</h1>
                <p className="text-sm text-muted-foreground">Discover local businesses</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/lake-geneva")}
              className="flex items-center gap-2"
            >
              <Newspaper className="h-4 w-4" />
              Lake Geneva Brief
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-8">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat!}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {sortedBusinesses.length} {sortedBusinesses.length === 1 ? "business" : "businesses"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading directory...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedBusinesses.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No businesses found in this category.</p>
          </div>
        )}

        {/* Business Grid */}
        {!isLoading && sortedBusinesses.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedBusinesses.map((business) => (
              <Card
                key={business.id}
                className="p-6 hover:shadow-lg transition-shadow relative"
              >
                {/* Sponsor Badge */}
                {business.is_sponsor && (
                  <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20">
                    <Star className="h-3 w-3 mr-1 fill-primary" />
                    Sponsor
                  </Badge>
                )}

                {/* Logo */}
                {business.logo_url && (
                  <div className="mb-4">
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="h-20 w-20 object-contain rounded-lg bg-muted p-2"
                    />
                  </div>
                )}

                {/* Business Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{business.name}</h3>
                    {business.category && (
                      <Badge className={getCategoryColor(business.category)}>
                        {business.category}
                      </Badge>
                    )}
                  </div>

                  {business.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {business.description}
                    </p>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    {business.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{business.address}</span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <a href={`tel:${business.phone}`} className="hover:text-primary">
                          {business.phone}
                        </a>
                      </div>
                    )}
                    {business.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <a href={`mailto:${business.email}`} className="hover:text-primary line-clamp-1">
                          {business.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Website Link */}
                  {business.website && (
                    <a
                      href={
                        business.is_sponsor
                          ? `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(business.website)}&source=directory&bid=${business.id}&pid=${business.placementId}`
                          : business.website
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Visit Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <Card className="mt-12 p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-2xl font-bold">Want to be featured here?</h2>
            <p className="text-muted-foreground">
              Join Lake Geneva Brief as a sponsor and reach thousands of local readers through our
              newsletter, website, and social channels.
            </p>
            <Button size="lg" onClick={() => navigate("/advertise")}>
              Learn More About Advertising
            </Button>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-8 bg-muted/20">
        <div className="container max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("/lake-geneva")}
              className="hover:text-primary transition-colors"
            >
              Lake Geneva Brief
            </button>
            <span>•</span>
            <button
              onClick={() => navigate("/directory")}
              className="hover:text-primary transition-colors"
            >
              Business Directory
            </button>
            <span>•</span>
            <button
              onClick={() => navigate("/advertise")}
              className="hover:text-primary transition-colors"
            >
              Advertise
            </button>
          </div>
          <p>© {new Date().getFullYear()} Lake Geneva Brief. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicDirectory;
