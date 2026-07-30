import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HourBucket, SeasonBucket } from "@/lib/pathAlmanacFormat";

// Re-exported so consumers import display helpers and data types from one place.
export {
  crowdShade,
  crowdWord,
  CROWD_WORDS,
  HOUR_BUCKETS,
  HOUR_LABELS,
  SEASON_BUCKETS,
  SEASON_LABELS,
} from "@/lib/pathAlmanacFormat";
export type { HourBucket, SeasonBucket } from "@/lib/pathAlmanacFormat";

export type SeasonHourCell = {
  season: SeasonBucket;
  hour_bucket: HourBucket;
  samples: number;
  crowd_mean: number | null;
  temp_median: number | null;
};

export type SeasonDayTypeCell = {
  season: SeasonBucket;
  day_type: "weekday" | "weekend";
  samples: number;
  crowd_mean: number | null;
};

export type CommunityCell = {
  community: string;
  samples: number;
  crowd_mean: number | null;
  temp_median: number | null;
};

export type Almanac = {
  min_samples: number;
  total_visits: number;
  total_with_crowd: number;
  by_season_hour: SeasonHourCell[];
  by_season_daytype: SeasonDayTypeCell[];
  by_community: CommunityCell[];
  quietest: {
    season: SeasonBucket;
    hour_bucket: HourBucket;
    day_type: "weekday" | "weekend";
    samples: number;
    crowd_mean: number | null;
  } | null;
  warmest: {
    season: SeasonBucket;
    hour_bucket: HourBucket;
    samples: number;
    temp_median: number | null;
  } | null;
};

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
      return (data ?? null) as Almanac | null;
    },
    staleTime: 30 * 60 * 1000,
    // The almanac is a nicety layered on the guide; a failure must not surface
    // as a broken page.
    retry: false,
  });
}
