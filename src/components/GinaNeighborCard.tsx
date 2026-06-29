import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const GINA_ID = "db06b0ce-2fe3-4a01-a870-7f2aef1913a6";

type Testimonial = { quote: string; attribution?: string; tag?: string };

function dayIndex(): number {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return d.split("-").reduce((a, p) => a + Number(p), 0);
}

const fireClick = () => {
  const params = new URLSearchParams({
    url: "/selling-lake-geneva",
    source: "gina_neighbor_card",
    track_only: "true",
    bid: GINA_ID,
  });
  fetch(
    `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?${params.toString()}`,
  ).catch(() => {});
};

/**
 * Right-rail spotlight — keeps Gina's face on screen every homepage scroll.
 * Rotates daily through her saved testimonials.
 */
export default function GinaNeighborCard() {
  const { data: gina } = useQuery({
    queryKey: ["gina-neighbor-card"],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_profiles")
        .select(
          "name, logo_url, zillow_rating, zillow_review_count, testimonial_quote, metadata",
        )
        .eq("id", GINA_ID)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

  if (!gina) return null;

  const meta = (gina.metadata as any) || {};
  const testimonials: Testimonial[] = Array.isArray(meta.testimonials)
    ? meta.testimonials
    : [];
  const t: Testimonial | null =
    testimonials.length > 0
      ? testimonials[dayIndex() % testimonials.length]
      : gina.testimonial_quote
      ? { quote: gina.testimonial_quote }
      : null;

  return (
    <section
      aria-label="Your Lake Geneva neighbor"
      className="rounded-xl border border-slate-200 bg-gradient-to-br from-stone-50 via-white to-sky-50/40 p-4"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
        Your Lake Geneva neighbor
      </p>

      <Link
        to="/selling-lake-geneva"
        onClick={fireClick}
        className="flex items-center gap-3 group"
      >
        <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm flex-shrink-0 transition-transform group-hover:scale-105">
          {gina.logo_url ? (
            <img
              src={gina.logo_url}
              alt={gina.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Home className="w-5 h-5 text-slate-500 m-auto" />
          )}
        </div>
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {gina.name}
          </h3>
          <p className="text-[11px] text-slate-500">
            {meta.tagline || "Realtor · @properties"}
          </p>
          {gina.zillow_rating && gina.zillow_review_count ? (
            <div className="mt-0.5 flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < Math.round(gina.zillow_rating || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-transparent text-slate-300"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-500">
                {gina.zillow_review_count} reviews
              </span>
            </div>
          ) : null}
        </div>
      </Link>

      {t && (
        <blockquote className="mt-3 pt-3 border-t border-slate-200/80 text-xs italic text-slate-600 leading-relaxed">
          "{t.quote}"
          {t.attribution && (
            <span className="block not-italic text-[10px] text-slate-500 mt-1">
              — {t.attribution}
            </span>
          )}
        </blockquote>
      )}

      <Link
        to="/selling-lake-geneva"
        onClick={fireClick}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-stone-50 text-[11px] font-medium uppercase tracking-wider py-2 transition-colors"
      >
        What's my home worth?
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}