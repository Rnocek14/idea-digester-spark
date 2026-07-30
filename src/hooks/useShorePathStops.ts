import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ShorePathStopRow = {
  id: string;
  order_index: number;
  slug: string;
  name: string;
  short_label: string | null;
  community: string | null;
  latitude: number | null;
  longitude: number | null;
  map_x_pct: number | null;
  map_y_pct: number | null;
  approx_mile: number | null;
  description: string | null;
  look_for: string | null;
  hero_image_url: string | null;
  is_public_landmark: boolean;
  is_published: boolean;
  geofence_radius_m: number | null;
  story_long: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  audio_transcript: string | null;
  audio_voice_id: string | null;
  local_love_prompt: string | null;
  leg_order_index: number | null;
  /** Array of {url, publisher, supports}. Empty means unsourced, and the page says so. */
  sources: Array<{ url?: string | null; publisher?: string | null; supports?: string | null }> | null;
  history_confidence: "documented" | "traditional" | "thin" | null;
  historical_image_url: string | null;
  historical_image_year: string | null;
  historical_image_credit: string | null;
  historical_image_source_url: string | null;
  historical_image_rights:
    | "public_domain"
    | "no_known_restrictions"
    | "licensed"
    | "permission_granted"
    | null;
};

export function useShorePathStops() {
  return useQuery({
    queryKey: ["shore_path_stops"],
    queryFn: async (): Promise<ShorePathStopRow[]> => {
      const { data, error } = await supabase
        .from("shore_path_stops")
        .select("*")
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShorePathStopRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}