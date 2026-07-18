import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, Loader2, Rocket, CheckCircle2, CircleDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// Supabase generated types don't know the multi-city tables yet; regenerating
// types removes this helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type CityRow = {
  id: string;
  city_name: string;
  state_code: string;
  county_name: string;
  status: string;
  site_domain: string;
};

type SourceCount = { city_id: string; status: string };

/**
 * Add-a-city in one form. Wraps the bootstrap-city edge function: type the
 * city, click Bootstrap, watch discovery + trial validation do the rest.
 * (See docs/city-bootstrap-sop.md for the launch runbook.)
 */
export default function AdminCities() {
  const queryClient = useQueryClient();
  const [cityName, setCityName] = useState("");
  const [stateCode, setStateCode] = useState("WI");
  const [countyName, setCountyName] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [lastReport, setLastReport] = useState<Record<string, unknown> | null>(null);

  const { data: cities = [] } = useQuery({
    queryKey: ["admin-cities"],
    queryFn: async () => {
      const { data } = await db
        .from("city_config")
        .select("id, city_name, state_code, county_name, status, site_domain")
        .order("created_at", { ascending: true });
      return (data ?? []) as CityRow[];
    },
  });

  const { data: sourceCounts = [] } = useQuery({
    queryKey: ["admin-cities-sources"],
    queryFn: async () => {
      const { data } = await db.from("sources").select("city_id, status");
      return (data ?? []) as SourceCount[];
    },
  });

  const { data: waitlistCount = 0 } = useQuery({
    queryKey: ["admin-waitlist-count"],
    queryFn: async () => {
      const { count } = await db
        .from("city_waitlist")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const countsFor = (cityId: string) => {
    const rows = sourceCounts.filter((s) => s.city_id === cityId);
    const by = (status: string) => rows.filter((s) => s.status === status).length;
    return { active: by("active"), ready: by("ready"), trial: by("trial"), candidate: by("candidate") };
  };

  const bootstrap = useMutation({
    mutationFn: async () => {
      if (!cityName.trim() || !stateCode.trim() || !countyName.trim()) {
        throw new Error("City, state, and county are required.");
      }
      const { data, error } = await supabase.functions.invoke("bootstrap-city", {
        body: {
          city_name: cityName.trim(),
          state_code: stateCode.trim().toUpperCase(),
          county_name: countyName.trim(),
          ...(siteDomain.trim() ? { site_domain: siteDomain.trim() } : {}),
        },
      });
      if (error) throw new Error(error.message || "bootstrap-city failed");
      if (!data?.success) throw new Error(data?.error || "bootstrap-city failed");
      return data as Record<string, unknown>;
    },
    onSuccess: (report) => {
      setLastReport(report);
      queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cities-sources"] });
      toast({
        title: `Bootstrapped ${cityName}`,
        description: `${report.sources_inserted ?? 0} sources discovered — trial validation grades them over the next 2-3 days.`,
      });
    },
    onError: (e: Error) => toast({ title: "Bootstrap failed", description: e.message, variant: "destructive" }),
  });

  const activate = useMutation({
    mutationFn: async (cityId: string) => {
      const { error } = await db.from("city_config").update({ status: "active" }).eq("id", cityId);
      if (error) throw new Error(error.message);
      // Validated sources were parked at 'ready' while the city wasn't live —
      // activation is the moment they go active.
      const { error: srcError } = await db
        .from("sources")
        .update({ status: "active" })
        .eq("city_id", cityId)
        .eq("status", "ready");
      if (srcError) throw new Error(srcError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cities-sources"] });
      toast({ title: "City activated", description: "Its 'ready' sources are now live and fleet crons include it." });
    },
    onError: (e: Error) => toast({ title: "Activation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="h-6 w-6" /> Cities
          </h1>
          <p className="text-sm text-muted-foreground">
            One form per city. Discovery, validation, and health are automatic — the launch
            runbook is docs/city-bootstrap-sop.md.
          </p>
        </div>
        <Badge variant="outline">{waitlistCount} waitlist signups</Badge>
      </div>

      {/* Add city */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a city</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              bootstrap.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="city">City *</Label>
              <Input id="city" placeholder="Delavan" value={cityName} onChange={(e) => setCityName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State *</Label>
              <Input id="state" placeholder="WI" maxLength={2} value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="county">County *</Label>
              <Input id="county" placeholder="Walworth County" value={countyName} onChange={(e) => setCountyName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input id="domain" placeholder="delavanbrief.com" value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={bootstrap.isPending} className="w-full">
                {bootstrap.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Discovering…
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" /> Bootstrap
                  </>
                )}
              </Button>
            </div>
          </form>
          {lastReport && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(lastReport, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* City list */}
      <div className="grid gap-4 md:grid-cols-2">
        {cities.map((city) => {
          const counts = countsFor(city.id);
          const isLive = city.status === "active";
          return (
            <Card key={city.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {city.city_name}, {city.state_code}
                  </span>
                  {isLive ? (
                    <Badge className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> live
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <CircleDashed className="h-3 w-3 mr-1" /> {city.status}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {city.county_name} · {city.site_domain}
                </div>
                <div className="flex gap-3 text-xs">
                  <span>🟢 {counts.active} active</span>
                  <span>🟡 {counts.ready} ready</span>
                  <span>⚪ {counts.trial} in trial</span>
                  <span>▫️ {counts.candidate} candidates</span>
                </div>
                {!isLive && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={activate.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Activate ${city.city_name}? Do the launch pass first (gazetteer sanity check + source spot-check — see the SOP). Fleet crons will start serving it immediately.`
                        )
                      ) {
                        activate.mutate(city.id);
                      }
                    }}
                  >
                    Activate city
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
