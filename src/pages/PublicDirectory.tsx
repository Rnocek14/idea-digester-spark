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
import { Building2, ExternalLink, Mail, Phone, MapPin, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

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
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <main className="container max-w-6xl mx-auto px-4 py-8 sm:py-10">
        {/* Page Title */}
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-brand tracking-tight">Business Directory</h1>
          <p className="text-base text-gray-600">Discover local businesses in Lake Geneva</p>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-64 rounded-full border-gray-300">
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
          <p className="text-sm text-gray-500">
            {sortedBusinesses.length} {sortedBusinesses.length === 1 ? "business" : "businesses"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16 text-gray-500">
            Loading directory...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedBusinesses.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No businesses found in this category.</p>
          </div>
        )}

        {/* Business Grid */}
        {!isLoading && sortedBusinesses.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedBusinesses.map((business) => (
              <Card
                key={business.id}
                className="p-5 hover:shadow-md transition-shadow relative rounded-2xl border-gray-200"
              >
                {/* Sponsor Badge */}
                {business.is_sponsor && (
                  <span className="absolute top-4 right-4 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-700" />
                    Sponsor
                  </span>
                )}

                {/* Business Card Content */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {business.logo_url && (
                      <img
                        src={business.logo_url}
                        alt={business.name}
                        className="h-12 w-12 object-contain rounded-full bg-gray-50 p-1.5"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-brand truncate">{business.name}</h3>
                      {business.category && (
                        <span className="text-xs text-gray-500">{business.category}</span>
                      )}
                    </div>
                  </div>

                  {business.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                      {business.description}
                    </p>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs">
                    {business.address && (
                      <div className="flex items-start gap-2 text-gray-500">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{business.address}</span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <a href={`tel:${business.phone}`} className="hover:text-brand-accent transition-colors">
                          {business.phone}
                        </a>
                      </div>
                    )}
                    {business.email && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <a href={`mailto:${business.email}`} className="hover:text-brand-accent transition-colors line-clamp-1">
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
                    >
                      Visit website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <Card className="mt-12 p-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-blue-100 rounded-2xl">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-2xl font-display font-bold text-brand">Want to be featured here?</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Join Lake Geneva Brief as a sponsor and reach thousands of local readers through our
              newsletter, website, and social channels.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/advertise")}
              className="rounded-full bg-brand-accent hover:bg-blue-700 transition-colors"
            >
              Learn More About Advertising
            </Button>
          </div>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
};

export default PublicDirectory;
