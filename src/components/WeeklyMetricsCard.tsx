import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, AlertTriangle, FileText, Activity } from "lucide-react";
import { subDays, startOfDay } from "date-fns";

interface MetricData {
  incidentsThisWeek: number;
  breakingStoriesThisWeek: number;
  publishedThisWeek: number;
  activeSourcesHealthy: number;
  totalActiveSources: number;
}

const getHealthColor = (value: number, min: number, max: number, inverse = false) => {
  if (inverse) {
    if (value >= max) return "text-destructive";
    if (value >= min) return "text-yellow-500";
    return "text-green-500";
  }
  if (value >= min && value <= max) return "text-green-500";
  if (value < min) return "text-yellow-500";
  return "text-yellow-500";
};

export const WeeklyMetricsCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-metrics"],
    queryFn: async (): Promise<MetricData> => {
      const weekAgo = startOfDay(subDays(new Date(), 7)).toISOString();
      
      // Fetch incidents this week
      const { count: incidentsCount } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .gte("started_at", weekAgo);

      // Fetch breaking stories this week
      const { count: breakingCount } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .eq("is_breaking", true)
        .gte("created_at", weekAgo);

      // Fetch published stories this week
      const { count: publishedCount } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .in("status", ["published", "auto_published"])
        .gte("created_at", weekAgo);

      // Fetch source health (sources that fetched in last 24h)
      const dayAgo = subDays(new Date(), 1).toISOString();
      const { data: sources } = await supabase
        .from("sources")
        .select("id, last_fetched_at")
        .eq("status", "active");

      const totalSources = sources?.length || 0;
      const healthySources = sources?.filter(s => 
        s.last_fetched_at && new Date(s.last_fetched_at) > new Date(dayAgo)
      ).length || 0;

      return {
        incidentsThisWeek: incidentsCount || 0,
        breakingStoriesThisWeek: breakingCount || 0,
        publishedThisWeek: publishedCount || 0,
        activeSourcesHealthy: healthySources,
        totalActiveSources: totalSources,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sourceHealthPercent = data?.totalActiveSources 
    ? Math.round((data.activeSourcesHealthy / data.totalActiveSources) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Weekly Metrics
        </CardTitle>
        <p className="text-sm text-muted-foreground">Last 7 days performance</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Incidents */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Incidents</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${getHealthColor(data?.incidentsThisWeek || 0, 1, 5)}`}>
                {data?.incidentsThisWeek || 0}
              </span>
              <span className="text-xs text-muted-foreground">target: 1-3</span>
            </div>
          </div>

          {/* Breaking Stories */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Breaking</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${getHealthColor(data?.breakingStoriesThisWeek || 0, 2, 8)}`}>
                {data?.breakingStoriesThisWeek || 0}
              </span>
              <span className="text-xs text-muted-foreground">target: 2-5</span>
            </div>
          </div>

          {/* Published */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Published</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${getHealthColor(data?.publishedThisWeek || 0, 25, 100)}`}>
                {data?.publishedThisWeek || 0}
              </span>
              <span className="text-xs text-muted-foreground">target: 25-75</span>
            </div>
          </div>

          {/* Source Health */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Source Health</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${sourceHealthPercent >= 90 ? "text-green-500" : sourceHealthPercent >= 70 ? "text-yellow-500" : "text-destructive"}`}>
                {sourceHealthPercent}%
              </span>
              <span className="text-xs text-muted-foreground">
                {data?.activeSourcesHealthy}/{data?.totalActiveSources} healthy
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
