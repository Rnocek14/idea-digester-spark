import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";

/**
 * Loads a single Shore Path stop by slug plus the full ordered list
 * (cheap; 16 rows) so the page can render prev/next nav and breadcrumbs
 * without a second round trip.
 */
export function useShorePathStopBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["shore_path_stop", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shore_path_stops")
        .select("*")
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      const all = (data ?? []) as ShorePathStopRow[];
      const idx = all.findIndex((s) => s.slug === slug);
      return {
        stop: idx >= 0 ? all[idx] : null,
        prev: idx > 0 ? all[idx - 1] : null,
        next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
        all,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}