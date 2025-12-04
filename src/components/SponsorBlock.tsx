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
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header Badge */}
      <div className="px-5 pt-4 pb-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Presented By
        </span>
      </div>

      {/* Main Content */}
      <div className="px-5 pb-5">
        {/* Sponsor Info Row */}
        <div className="flex items-start gap-4">
          {/* Logo/Avatar */}
          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center overflow-hidden border border-white/20">
            {sponsor.logo_url ? (
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Home className="w-7 h-7 text-blue-400" />
            )}
          </div>

          {/* Name & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white leading-tight">
              {sponsor.name}
            </h3>
            {isRealEstate && (
              <p className="text-sm text-blue-300 font-medium mt-0.5">
                @properties Lake Geneva
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {sponsor.description || (isRealEstate 
                ? "Your trusted Lake Geneva real estate expert. Lakefront homes, condos, and investment properties."
                : "Proud sponsor of Lake Geneva Brief"
              )}
            </p>
          </div>
        </div>

        {/* Real Estate Market Widget */}
        {isRealEstate && metrics && (
          <div className="mt-5 rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10">
            {/* Widget Header */}
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏡</span>
                <span className="text-xs font-semibold text-white">Lake Geneva Market Snapshot</span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                {formatDate(metrics.fetched_at)}
              </span>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-4 divide-x divide-white/10">
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-bold text-white">{formatPrice(metrics.median_price)}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">Median</div>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{metrics.yoy_change}%</span>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">YoY</div>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-bold text-white">{metrics.active_listings}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">Active</div>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-bold text-blue-400">{formatPrice(metrics.median_list_price || 0)}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">List Price</div>
              </div>
            </div>

            {/* Source Attribution */}
            <div className="px-4 py-1.5 border-t border-white/5 text-center">
              <span className="text-[9px] text-slate-500">Source: Zillow ZHVI · ZIP 53147</span>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          {sponsor.phone && (
            <a
              href={trackClickUrl(`tel:${sponsor.phone.replace(/\D/g, '')}`, 'sponsor_phone', sponsor.businessId, sponsor.placementId)}
              className="flex-1"
            >
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs font-medium"
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
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View Listings
              </Button>
            </a>
          )}
        </div>

        {/* Expertise Tags (for real estate) */}
        {isRealEstate && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {['Lakefront', 'Condos', 'Investment', 'Vacation Homes'].map((tag) => (
              <span 
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-300 border border-white/10"
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
