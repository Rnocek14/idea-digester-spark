import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Star } from "lucide-react";
import { MarketAnalysisDialog } from "@/components/MarketAnalysisDialog";

type Testimonial = {
  quote: string;
  attribution?: string;
  tag?: string;
};

type SponsorMetadata = {
  testimonials?: Testimonial[];
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
  metadata?: SponsorMetadata;
};

// Get daily rotating testimonial (same quote all day, changes at midnight)
const getDailyTestimonial = (testimonials: Testimonial[]): Testimonial | null => {
  if (!testimonials?.length) return null;
  const today = new Date();
  const dayIndex = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  return testimonials[dayIndex % testimonials.length];
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

// Fire-and-forget click tracking for non-redirect scenarios
const fireTrackClick = (url: string, source: string, businessId?: string, placementId?: string) => {
  const params = new URLSearchParams({
    url: url,
    source: source,
    track_only: 'true',
    ...(businessId && { bid: businessId }),
    ...(placementId && { pid: placementId }),
  });
  fetch(`https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?${params.toString()}`)
    .catch(() => {});
};

interface SponsorBlockProps {
  sponsor: Sponsor;
}

export const SponsorBlock = ({ sponsor }: SponsorBlockProps) => {
  const [showMarketAnalysisDialog, setShowMarketAnalysisDialog] = useState(false);
  const isRealEstate = isRealEstateSponsor(sponsor);

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Compact Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
          Presented By
        </span>
      </div>

      {/* Main Content - Slim */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
            {sponsor.logo_url ? (
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Home className="w-5 h-5 text-slate-400" />
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">
              {sponsor.name}
            </h3>
            {isRealEstate && (
              <p className="text-[10px] font-medium text-blue-600 mt-0.5">
                Top Lake Geneva Listing Agent
              </p>
            )}
            
            {/* Zillow Rating - Compact */}
            {sponsor.zillow_rating && sponsor.zillow_review_count && (
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.round(sponsor.zillow_rating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-slate-700">{sponsor.zillow_rating.toFixed(1)}</span>
                {sponsor.zillow_url ? (
                  <a
                    href={trackClickUrl(sponsor.zillow_url, 'sponsor_zillow', sponsor.businessId, sponsor.placementId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline"
                  >
                    ({sponsor.zillow_review_count} reviews)
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    ({sponsor.zillow_review_count} reviews)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Single Testimonial */}
        {(() => {
          const dailyTestimonial = getDailyTestimonial(sponsor.metadata?.testimonials || []);
          const quote = dailyTestimonial?.quote || sponsor.testimonial_quote;
          const attribution = dailyTestimonial?.attribution;
          
          if (!quote) return null;
          
          return (
            <blockquote className="mt-3 pl-3 border-l-2 border-blue-200 italic text-[11px] text-slate-600 leading-relaxed">
              "{quote}"
              {attribution && (
                <footer className="mt-0.5 not-italic text-[10px] text-slate-500">
                  — {attribution}
                </footer>
              )}
            </blockquote>
          );
        })()}

        {/* Single CTA */}
        {isRealEstate && (
          <Button 
            size="sm" 
            className="w-full mt-3 text-xs font-medium h-8"
            onClick={() => {
              fireTrackClick(
                'market_analysis_form',
                'sponsor_market_analysis',
                sponsor.businessId,
                sponsor.placementId
              );
              setShowMarketAnalysisDialog(true);
            }}
          >
            <Home className="w-3.5 h-3.5 mr-1.5" />
            What Could Your Home Sell For?
          </Button>
        )}
      </div>

      {/* Market Analysis Dialog */}
      {isRealEstate && (
        <MarketAnalysisDialog
          open={showMarketAnalysisDialog}
          onOpenChange={setShowMarketAnalysisDialog}
          sponsorName={sponsor.name}
          sponsorId={sponsor.businessId || ''}
          sponsorEmail={sponsor.email || undefined}
        />
      )}
    </Card>
  );
};

export default SponsorBlock;
