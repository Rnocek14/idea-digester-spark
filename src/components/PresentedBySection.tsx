import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, Star, Phone } from "lucide-react";
import { MarketAnalysisDialog } from "@/components/MarketAnalysisDialog";

type Testimonial = {
  quote: string;
  attribution?: string;
};

type SponsorMetadata = {
  testimonials?: Testimonial[];
  tagline?: string;
};

interface MarketData {
  yoy_change: number;
  zip_code: string;
}

interface Sponsor {
  name: string;
  logo_url: string | null;
  website: string | null;
  placementId?: string;
  businessId?: string;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  zillow_url?: string | null;
  zillow_rating?: number | null;
  zillow_review_count?: number | null;
  testimonial_quote?: string | null;
  metadata?: SponsorMetadata;
}

interface PresentedBySectionProps {
  sponsor: Sponsor;
  marketData?: MarketData | null;
}

const getDailyTestimonial = (testimonials: Testimonial[]): Testimonial | null => {
  if (!testimonials?.length) return null;
  const today = new Date();
  const dayIndex = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  return testimonials[dayIndex % testimonials.length];
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

export const PresentedBySection = ({ sponsor, marketData }: PresentedBySectionProps) => {
  const [showDialog, setShowDialog] = useState(false);

  const dailyTestimonial = getDailyTestimonial(sponsor.metadata?.testimonials || []);
  const quote = dailyTestimonial?.quote || sponsor.testimonial_quote;
  const attribution = dailyTestimonial?.attribution;
  
  const yoyChangeText = marketData?.yoy_change 
    ? `${marketData.yoy_change > 0 ? '+' : ''}${marketData.yoy_change.toFixed(1)}%`
    : null;

  return (
    <section className="py-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border border-slate-200 px-5 py-4 lg:px-6 lg:py-5">
        {/* Label */}
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400 mb-3">
          Presented By
        </p>

        {/* Horizontal layout */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          {/* Left: Photo + Name + Zillow */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Photo */}
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
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

            {/* Name + Zillow */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                {sponsor.name}
              </h3>
              {sponsor.metadata?.tagline && (
                <p className="text-[11px] text-slate-500">
                  {sponsor.metadata.tagline}
                </p>
              )}
              {sponsor.zillow_rating && sponsor.zillow_review_count && (
                <div className="flex items-center gap-1 mt-0.5">
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
                  {sponsor.zillow_url ? (
                    <a
                      href={trackClickUrl(sponsor.zillow_url, 'sponsor_zillow', sponsor.businessId, sponsor.placementId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline"
                    >
                      {sponsor.zillow_review_count} reviews
                    </a>
                  ) : (
                      <span className="text-[10px] text-slate-500">
                      {sponsor.zillow_review_count} reviews
                    </span>
                  )}
                </div>
              )}
              {sponsor.phone && (
                <a
                  href={trackClickUrl(`tel:+1${sponsor.phone.replace(/\D/g, '')}`, 'sponsor_phone', sponsor.businessId, sponsor.placementId)}
                  className="flex items-center gap-1 mt-1 text-[11px] text-slate-600 hover:text-blue-600"
                >
                  <Phone className="w-3 h-3" />
                  <span>{sponsor.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
                </a>
              )}
            </div>
          </div>

          {/* Center: Testimonial (flex-1 to take remaining space) */}
          {quote && (
            <div className="flex-1 min-w-0">
              <blockquote className="text-xs text-slate-600 italic leading-relaxed line-clamp-2">
                "{quote}"
                {attribution && (
                  <span className="not-italic text-slate-500"> — {attribution}</span>
                )}
              </blockquote>
            </div>
          )}

          {/* Right: CTA Button */}
          <div className="flex-shrink-0">
            <Button
              size="sm"
              className="text-xs font-medium h-9 px-4"
              onClick={() => setShowDialog(true)}
            >
              <Home className="w-3.5 h-3.5 mr-1.5" />
              Get Your Free Home Valuation
            </Button>
          </div>
        </div>
        
        {/* Market Data Footer - Outside the flex container */}
        {yoyChangeText && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              Lake Geneva home values{' '}
              <span className={marketData?.yoy_change && marketData.yoy_change > 0 ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                {yoyChangeText} this year
              </span>
              <span className="mx-1.5">·</span>
              <span>Zillow ZHVI</span>
              {marketData?.zip_code && (
                <>
                  <span className="mx-1.5">·</span>
                  <span>ZIP {marketData.zip_code}</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <MarketAnalysisDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        sponsorName={sponsor.name}
        sponsorId={sponsor.businessId || ''}
        sponsorEmail={sponsor.email || undefined}
      />
    </section>
  );
};

export default PresentedBySection;
