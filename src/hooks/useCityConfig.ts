import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeIdentity, applyPaletteToRoot, DEFAULT_IDENTITY, type CityIdentity } from "@/lib/cityTheme";
import { getCityId, setResolvedCityId } from "@/lib/cityId";

/** Hostname → city resolution (phase 3). Local/preview hosts resolve to 'default'. */
function currentHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.replace(/^www\./, "");
}

/**
 * The city's identity (name, domain, theme) from city_config, resolved by
 * hostname with Lake Geneva as the synchronous default — pages render
 * immediately and re-render only if the DB row differs. Every serving domain
 * maps to a city_config row via its `hostname` column; unknown hosts
 * (localhost, previews) fall back to the 'default' city.
 */
export function useCityConfig(): CityIdentity {
  const hostname = currentHostname();
  const { data } = useQuery({
    queryKey: ["city-config", hostname],
    queryFn: async () => {
      // city_config is newer than the generated Supabase types; the cast goes
      // away next time src/integrations/supabase/types.ts is regenerated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (supabase as any).from("city_config");
      const cols = "id, site_name, site_domain, city_name, theme";
      let row: Partial<CityIdentity> | null = null;
      if (hostname) {
        const { data: byHost } = await cfg.select(cols).eq("hostname", hostname).maybeSingle();
        row = byHost ?? null;
      }
      if (!row) {
        const { data: byDefault } = await cfg.select(cols).eq("id", "default").maybeSingle();
        row = byDefault ?? null;
      }
      return mergeIdentity(row);
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: DEFAULT_IDENTITY,
  });

  const identity = data ?? DEFAULT_IDENTITY;
  const queryClient = useQueryClient();

  useEffect(() => {
    applyPaletteToRoot(identity.theme.palette);
  }, [identity.theme.palette]);

  // Publish the resolved city id for query functions (getCityId()). If
  // resolution lands on a different city than what queries already used
  // (only possible on a non-default domain), refetch everything under the
  // correct city. On the default city this never fires.
  useEffect(() => {
    if (getCityId() !== identity.id) {
      setResolvedCityId(identity.id);
      queryClient.invalidateQueries();
    }
  }, [identity.id, queryClient]);

  return identity;
}
