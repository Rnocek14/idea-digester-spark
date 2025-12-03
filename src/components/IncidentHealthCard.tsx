import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Cloud, Newspaper, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInDays } from "date-fns";

export const IncidentHealthCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["incident-health"],
    queryFn: async () => {
      // Active incidents count
      const { count: activeCount } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .in("status", ["active", "monitoring"]);

      // Most recent incident
      const { data: lastIncident } = await supabase
        .from("incidents")
        .select("started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Most recent weather incident
      const { data: lastWeather } = await supabase
        .from("incidents")
        .select("started_at")
        .eq("incident_type", "weather")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Most recent story-linked incident (from RSS/breaking)
      const { data: lastStoryIncident } = await supabase
        .from("incidents")
        .select("started_at")
        .not("source_story_id", "is", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        activeCount: activeCount || 0,
        lastIncidentAt: lastIncident?.started_at,
        lastWeatherAt: lastWeather?.started_at,
        lastStoryIncidentAt: lastStoryIncident?.started_at,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const getRecencyIndicator = (dateStr: string | undefined) => {
    if (!dateStr) return { color: "text-muted-foreground", label: "Never" };
    const days = differenceInDays(new Date(), new Date(dateStr));
    if (days < 7) return { color: "text-green-500", label: formatDistanceToNow(new Date(dateStr), { addSuffix: true }) };
    if (days < 30) return { color: "text-yellow-500", label: formatDistanceToNow(new Date(dateStr), { addSuffix: true }) };
    return { color: "text-red-500", label: formatDistanceToNow(new Date(dateStr), { addSuffix: true }) };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const lastIncident = getRecencyIndicator(data?.lastIncidentAt);
  const lastWeather = getRecencyIndicator(data?.lastWeatherAt);
  const lastStory = getRecencyIndicator(data?.lastStoryIncidentAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Incident Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active Incidents</span>
          <span className={`font-bold ${data?.activeCount && data.activeCount > 0 ? "text-orange-500" : "text-green-500"}`}>
            {data?.activeCount || 0}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last Incident
          </div>
          <span className={`text-sm font-medium ${lastIncident.color}`}>
            {lastIncident.label}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cloud className="h-4 w-4" />
            Last Weather Alert
          </div>
          <span className={`text-sm font-medium ${lastWeather.color}`}>
            {lastWeather.label}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Newspaper className="h-4 w-4" />
            Last Breaking News
          </div>
          <span className={`text-sm font-medium ${lastStory.color}`}>
            {lastStory.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
