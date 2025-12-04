import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ExternalLink, Home, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Sponsor = {
  name: string;
  logo_url: string | null;
  website: string | null;
  placementId?: string;
  businessId?: string;
  category?: string | null;
  phone?: string | null;
  description?: string | null;
};

const isRealEstateSponsor = (sponsor: Sponsor | null) => {
  if (!sponsor) return false;
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

const trackClickUrl = (url: string, source: string, businessId?: string, placementId?: string) => {
  const params = new URLSearchParams({
    url: url,
    source: source,
    ...(businessId && { bid: businessId }),
    ...(placementId && { pid: placementId }),
  });
  return `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?${params.toString()}`;
};

const formatPhone = (phone: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatPrice = (price: number) => {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  return `$${Math.round(price / 1000)}K`;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

interface SponsorBlockProps {
  sponsor: Sponsor;
}

export const SponsorBlock = ({ sponsor }: SponsorBlockProps) => {
  const isRealEstate = isRealEstateSponsor(sponsor);

  const { data: metrics } = useQuery({
    queryKey: ['real-estate-metrics', '53147'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('real_estate_metrics')
        .select('*')
        .eq('zip_code', '53147')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: isRealEstate,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <Card className="overflow-hidden border border-border/60 shadow-sm bg-card">
      {/* Header Badge */}
      <div className="px-5 pt-4 pb-3 border-b border-border/40">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Presented By
        </span>
      </div>

      {/* Main Content */}
      <div className="px-5 py-4">
        {/* Sponsor Info Row */}
        <div className="flex items-start gap-4">
          {/* Logo/Avatar */}
          <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
            {sponsor.logo_url ? (
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Home className="w-6 h-6 text-primary" />
            )}
          </div>

          {/* Name & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground leading-tight font-serif">
              {sponsor.name}
            </h3>
            {isRealEstate && (
              <p className="text-sm text-primary font-medium mt-0.5">
                @properties Lake Geneva
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {sponsor.description || (isRealEstate 
                ? "Your trusted Lake Geneva real estate expert."
                : "Proud sponsor of Lake Geneva Brief"
              )}
            </p>
          </div>
        </div>

        {/* Real Estate Market Widget */}
        {isRealEstate && metrics && (
          <div className="mt-4 rounded-lg overflow-hidden bg-muted/50 border border-border/60">
            {/* Widget Header */}
            <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🏡</span>
                <span className="text-[11px] font-semibold text-foreground">Market Snapshot</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                {formatDate(metrics.fetched_at)}
              </span>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 divide-x divide-border/40">
              <div className="px-3 py-2.5 text-center">
                <div className="text-base font-bold text-foreground">{formatPrice(metrics.median_price)}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Median Value</div>
              </div>
              <div className="px-3 py-2.5 text-center">
                <div className="text-base font-bold text-emerald-600 flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{metrics.yoy_change}%</span>
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">YoY Change</div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40">
              <div className="px-3 py-2.5 text-center">
                <div className="text-base font-bold text-foreground">{metrics.active_listings}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Active Listings</div>
              </div>
              <div className="px-3 py-2.5 text-center">
                <div className="text-base font-bold text-foreground">{formatPrice(metrics.median_list_price || 0)}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">List Price</div>
              </div>
            </div>

            {/* Source Attribution */}
            <div className="px-3 py-1.5 border-t border-border/40 text-center bg-muted/30">
              <span className="text-[9px] text-muted-foreground">Source: Zillow ZHVI · ZIP 53147</span>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {sponsor.phone && (
            <a
              href={trackClickUrl(`tel:${sponsor.phone.replace(/\D/g, '')}`, 'sponsor_phone', sponsor.businessId, sponsor.placementId)}
              className="flex-1"
            >
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-medium"
              >
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                {formatPhone(sponsor.phone)}
              </Button>
            </a>
          )}
          {sponsor.website && (
            <a
              href={trackClickUrl(sponsor.website, 'sponsor_website', sponsor.businessId, sponsor.placementId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button 
                size="sm" 
                className="w-full text-xs font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View Listings
              </Button>
            </a>
          )}
        </div>

        {/* Expertise Tags */}
        {isRealEstate && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Lakefront', 'Condos', 'Investment', 'Vacation'].map((tag) => (
              <span 
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default SponsorBlock;
