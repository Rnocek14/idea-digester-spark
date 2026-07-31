import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeNotables, type Notables } from "@/lib/pathNotables";

export { normalizeNotables } from "@/lib/pathNotables";
export type { LingerRow, Notables, NotableWalk } from "@/lib/pathNotables";

/**
 * Superlatives across logged walks, filtered by season and shore.
 *
 * Reads through the aggregate function rather than the visits table — anon has
 * no grant on path_stop_visits, and a walk only carries a name when its walker
 * opted to be public.
 */
export function usePathNotables(season: string | null, community: string | null) {
  return useQuery({
    queryKey: ["shore-path-notables", season, community],
    queryFn: async (): Promise<Notables | null> => {
      const { data, error } = await supabase.rpc("get_shore_path_notables", {
        p_city_id: "default",
        p_season: season,
        p_community: community,
        p_min_stops: 2,
      });
      if (error) throw error;
      return normalizeNotables(data);
    },
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
}
