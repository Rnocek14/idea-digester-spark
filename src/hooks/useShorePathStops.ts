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