import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Star, Phone } from "lucide-react";
import { MarketAnalysisDialog } from "@/components/MarketAnalysisDialog";

const fireTrackClick = (source: string, businessId?: string, placementId?: string) => {
  const params = new URLSearchParams({
    url: '/selling-lake-geneva',
    source: source,
    track_only: 'true',
    ...(businessId && { bid: businessId }),
    ...(placementId && { pid: placementId }),
  });
  fetch(`https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?${params.toString()}`).catch(() => {});
};

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
  median_price?: number;
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
  const [isVisible, setIsVisible] = useState(false);
  const [starsAnimated, setStarsAnimated] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Add small delay so animation is visible even on initial load
          setTimeout(() => setIsVisible(true), 200);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Trigger star animation after entrance completes
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setStarsAnimated(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);


  const dailyTestimonial = getDailyTestimonial(sponsor.metadata?.testimonials || []);
  const quote = dailyTestimonial?.quote || sponsor.testimonial_quote;
  const attribution = dailyTestimonial?.attribution;
  
  const yoyChangeText = marketData?.yoy_change 
    ? `${marketData.yoy_change > 0 ? '+' : ''}${marketData.yoy_change.toFixed(1)}%`
    : null;

  const medianPriceText = marketData?.median_price
    ? `$${Math.round(marketData.median_price / 1000)}K`
    : null;

  return (
    <section 
      ref={sectionRef}
      className={`py-6 transition-all duration-700 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="rounded-2xl bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border border-slate-200 px-5 py-4 lg:px-6 lg:py-5 transition-all duration-300 hover:shadow-[0_8px_30px_-5px_rgba(59,130,246,0.15),0_4px_15px_-3px_rgba(147,197,253,0.2)] hover:-translate-y-1 hover:border-blue-200/60">
        {/* Label */}
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500 mb-3">
          Presented By
        </p>

        {/* Horizontal layout */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          {/* Left column: Photo + Name + Zillow + Phone */}
          <div 
            className={`flex-shrink-0 transition-all duration-500 ease-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: isVisible ? '0ms' : '0ms' }}
          >
            {/* Clickable link to selling page */}
            <Link 
              to="/selling-lake-geneva"
              onClick={() => fireTrackClick('sponsor_profile_click', sponsor.businessId, sponsor.placementId)}
              className="flex items-center gap-3 group cursor-pointer"
            >
              {/* Photo */}
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt={`${sponsor.name}, Lake Geneva real estate sponsor`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Home className="w-5 h-5 text-slate-500" />
                )}
              </div>

              {/* Name + Zillow */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
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
                      {Array.from({ length: 5 }, (_, i) => {
                        const isFilled = i < Math.round(sponsor.zillow_rating || 0);
                        const shouldShowFilled = starsAnimated && isFilled;
                        
                        return (
                          <Star
                            key={i}
                            className={`w-3 h-3 transition-all duration-300 ${
                              shouldShowFilled
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-transparent text-slate-400"
                            }`}
                            style={{ 
                              transitionDelay: starsAnimated ? `${i * 100}ms` : '0ms'
                            }}
                          />
                        );
                      })}
                    </div>
                    {/* Use span with click handler to avoid nested <a> inside <Link> */}
                    {sponsor.zillow_url ? (
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fireTrackClick('sponsor_zillow', sponsor.businessId, sponsor.placementId);
                          window.open(sponsor.zillow_url!, '_blank');
                        }}
                        className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline cursor-pointer"
                      >
                        {sponsor.zillow_review_count} reviews
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        {sponsor.zillow_review_count} reviews
                      </span>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more →
                </span>
              </div>
            </Link>
            
            {/* Phone - Separate clickable link, positioned under reviews */}
            {sponsor.phone && (
              <a
                href={trackClickUrl(`tel:+1${sponsor.phone.replace(/\D/g, '')}`, 'sponsor_phone', sponsor.businessId, sponsor.placementId)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-600 hover:scale-105 transition-all duration-200 ml-[68px] mt-1 origin-left"
              >
                <Phone className="w-3 h-3" />
                <span>{sponsor.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
              </a>
            )}
          </div>

          {/* Center: Testimonial (flex-1 to take remaining space) */}
          {quote && (
            <div 
              className={`flex-1 min-w-0 transition-all duration-500 ease-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: isVisible ? '150ms' : '0ms' }}
            >
              <blockquote className="text-xs text-slate-600 italic leading-relaxed line-clamp-2">
                "{quote}"
                {attribution && (
                  <span className="not-italic text-slate-500"> — {attribution}</span>
                )}
              </blockquote>
            </div>
          )}

          {/* Right: CTA Button */}
          <div 
            className={`flex-shrink-0 transition-all duration-500 ease-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: isVisible ? '300ms' : '0ms' }}
          >
            <Button
              size="sm"
              className={`text-xs font-medium h-9 px-4 ${
                isVisible ? 'animate-[pulse_2s_ease-in-out_1s_2]' : ''
              }`}
              onClick={() => setShowDialog(true)}
            >
              <Home className="w-3.5 h-3.5 mr-1.5" />
              Get Your Free Home Valuation
            </Button>
          </div>
        </div>
        
        {/* Market Data Footer - Outside the flex container */}
        {(yoyChangeText || medianPriceText) && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-500">
              Lake Geneva homes
              {medianPriceText && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="text-slate-600 font-medium">{medianPriceText}</span>
                  <span className="text-slate-500"> median</span>
                </>
              )}
              {yoyChangeText && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className={marketData?.yoy_change && marketData.yoy_change > 0 ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                    {yoyChangeText}
                  </span>
                  <span> YoY</span>
                </>
              )}
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
