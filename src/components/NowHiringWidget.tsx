import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Briefcase, ArrowRight } from "lucide-react";
import { getCityId, maybeCity, runCityScoped } from "@/lib/cityId";

type JobListing = {
  id: string;
  title: string;
  business_name: string;
  category: string | null;
  pay_display: string | null;
  is_featured: boolean | null;
};

const NowHiringWidget = () => {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["now-hiring-widget"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("job_listings")
        .select("id, title, business_name, category, pay_display, is_featured"), scoped)
        .eq("status", "approved")
        .gt("expires_at", now)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3)
      );

      if (error) throw error;
      return data as JobListing[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 10, // 10 minutes
  });

  // Don't render if no jobs
  if (isLoading || !jobs || jobs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="h-4 w-4 text-green-600" />
        <h3 className="text-sm font-semibold text-slate-900">Now Hiring</h3>
      </div>

      <ul className="space-y-2.5">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              to={`/jobs`}
              className="block group"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {job.title}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {job.business_name}
                    {job.pay_display && (
                      <span className="text-slate-500"> · {job.pay_display}</span>
                    )}
                  </p>
                </div>
                {job.is_featured && (
                  <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Featured
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/jobs"
        className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        View all jobs
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
};

export default NowHiringWidget;
