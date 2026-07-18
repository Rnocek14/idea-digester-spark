import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeIdentity, applyPaletteToRoot, DEFAULT_IDENTITY, type CityIdentity } from "@/lib/cityTheme";

/**
 * The city's identity (name, domain, theme) from city_config, with Lake Geneva
 * as the synchronous default — pages render immediately and re-render only if
 * the DB row differs. Multi-city phase 3 swaps the 'default' lookup for a
 * hostname lookup; nothing else changes.
 */
export function useCityConfig(): CityIdentity {
  const { data } = useQuery({
    queryKey: ["city-config", "default"],
    queryFn: async () => {
      // city_config is newer than the generated Supabase types; the cast goes
      // away next time src/integrations/supabase/types.ts is regenerated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (supabase as any)
        .from("city_config")
        .select("id, site_name, site_domain, city_name, theme")
        .eq("id", "default")
        .maybeSingle();
      return mergeIdentity(row as Partial<CityIdentity> | null);
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: DEFAULT_IDENTITY,
  });

  const identity = data ?? DEFAULT_IDENTITY;

  useEffect(() => {
    applyPaletteToRoot(identity.theme.palette);
  }, [identity.theme.palette]);

  return identity;
}
