import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAlmanac, type Almanac } from "@/lib/pathAlmanacFormat";

// Re-exported so consumers import display helpers, data types and the reader
// from one place.
export {
  crowdShade,
  crowdWord,
  normalizeAlmanac,
  CROWD_WORDS,
  HOUR_BUCKETS,
  HOUR_LABELS,
  SEASON_BUCKETS,
  SEASON_LABELS,
} from "@/lib/pathAlmanacFormat";
export type {
  Almanac,
  CommunityCell,
  HourBucket,
  SeasonBucket,
  SeasonDayTypeCell,
  SeasonHourCell,
} from "@/lib/pathAlmanacFormat";

/**
 * Reads the almanac through the aggregation function rather than the visits
 * table. `path_stop_visits` rows are a named walker's location at a moment in
 * time and anon has no grant on them; `get_shore_path_almanac` returns only
 * buckets that clear a minimum sample count.
 */
export function usePathAlmanac() {
  return useQuery({
    queryKey: ["shore-path-almanac"],
    queryFn: async (): Promise<Almanac | null> => {
      const { data, error } = await supabase.rpc("get_shore_path_almanac", {
        p_city_id: "default",
        p_min_samples: 4,
      });
      if (error) throw error;
      return normalizeAlmanac(data);
    },
    staleTime: 30 * 60 * 1000,
    // The almanac is a nicety layered on the guide; a failure must not surface
    // as a broken page.
    retry: false,
  });
}
