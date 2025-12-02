import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";

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

const PublicDirectory = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
    activeCategory === "all"
      ? businesses
      : businesses.filter((b) => b.category === activeCategory);

  // Sort: sponsors first, then featured, then alphabetical
  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    if (a.is_sponsor !== b.is_sponsor) return a.is_sponsor ? -1 : 1;
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Derived stats
  const totalBusinesses = sortedBusinesses.length;
  const sponsorCount = sortedBusinesses.filter((b) => b.is_sponsor).length;

  return (
    <PageShell
      title="Lake Geneva Business Directory – Lake Geneva Brief"
      description="Independent shops, services, and local businesses in Lake Geneva."
    >
      {/* Header */}
      <header className="mb-8 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Lake Geneva · Local Guide
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Lake Geneva Business Directory
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Independent shops, services, and places locals actually use.
              </p>
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <div className="flex flex-col items-end">
                <span className="font-semibold text-slate-900">
                  {totalBusinesses || 0}
                </span>
                <span>business{totalBusinesses === 1 ? '' : 'es'}</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex flex-col items-end">
                <span className="font-semibold text-slate-900">
                  {sponsorCount || 0}
                </span>
                <span>sponsor{sponsorCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {['all', ...categories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-500 hover:text-blue-700'
                  }`}
                >
                  {cat === 'all' ? 'All businesses' : cat}
                </button>
              ))}
            </div>

            {/* Count */}
            <p className="text-[11px] text-slate-500">
              Showing {sortedBusinesses.length}{' '}
              {sortedBusinesses.length === 1 ? 'business' : 'businesses'}
            </p>
          </div>
        </section>

        {/* Loading / Empty */}
        {isLoading && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading directory...
          </div>
        )}

        {!isLoading && sortedBusinesses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500 shadow-sm">
            No businesses found in this category yet. Check back soon or{' '}
            <button
              type="button"
              className="font-medium text-blue-600 hover:underline"
              onClick={() => navigate('/advertise')}
            >
              add your business
            </button>
            .
          </div>
        )}

        {/* Business grid */}
        {!isLoading && sortedBusinesses.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {sortedBusinesses.map((business) => {
              const isSponsor = !!business.is_sponsor;
              return (
                <article
                  key={business.id}
                  className={`group relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    isSponsor
                      ? 'border-amber-200 ring-1 ring-amber-100/60'
                      : 'border-slate-100'
                  }`}
                >
                  {/* Sponsor badge */}
                  {isSponsor && (
                    <div className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      Sponsor
                    </div>
                  )}

                  <div className="flex gap-4">
                    {/* Logo */}
                    {business.logo_url && (
                      <div className="mt-1 h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={business.logo_url}
                          alt={business.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Main info */}
                    <div className="flex-1 space-y-1">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {business.name}
                      </h2>
                      {business.category && (
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          {business.category}
                        </p>
                      )}
                      {business.description && (
                        <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                          {business.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact / actions */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {business.address && (
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">📍</span>
                          {business.address}
                        </span>
                      )}
                      {business.phone && (
                        <a
                          href={`tel:${business.phone}`}
                          className="flex items-center gap-1 hover:text-blue-700"
                        >
                          <span className="text-slate-400">📞</span>
                          {business.phone}
                        </a>
                      )}
                      {business.email && (
                        <a
                          href={`mailto:${business.email}`}
                          className="flex items-center gap-1 hover:text-blue-700"
                        >
                          <span className="text-slate-400">✉️</span>
                          {business.email}
                        </a>
                      )}
                    </div>

                    {business.website && (
                      <div>
                        <a
                          href={
                            business.is_sponsor
                              ? `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(business.website)}&source=directory&bid=${business.id}&pid=${business.placementId}`
                              : business.website
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
                        >
                          Visit website
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* CTA */}
        <section className="mt-10 rounded-2xl border border-slate-100 bg-white/80 px-5 py-4 text-sm text-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                Want your business listed here?
              </p>
              <p className="text-xs text-slate-500">
                Join Lake Geneva Brief as a sponsor and reach local readers
                through our newsletter and directory.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/advertise')}
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Learn about advertising
            </button>
          </div>
        </section>
      </PageShell>
    );
};

export default PublicDirectory;
