import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, AlertTriangle, FileText, Activity } from "lucide-react";
import { subDays, startOfDay, differenceInCalendarDays } from "date-fns";

interface MetricData {
  incidentsThisWeek: number;
  breakingStoriesThisWeek: number;
  publishedThisWeek: number;
  activeSourcesHealthy: number;
  totalActiveSources: number;
  incidentsByDay: number[];
  breakingByDay: number[];
  publishedByDay: number[];
}

// Tiny sparkline component
const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);

  const width = 64;
  const height = 20;
  const step = width / (values.length - 1 || 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-60"
      />
    </svg>
  );
};

// Trend arrow component
const TrendArrow: React.FC<{ trend: "up" | "down" | "flat" }> = ({ trend }) => {
  if (trend === "up") return <span className="text-green-500 text-xs">↑</span>;
  if (trend === "down") return <span className="text-destructive text-xs">↓</span>;
  return <span className="text-muted-foreground text-xs">→</span>;
};

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const last7 = (arr: number[]) => arr.slice(-7);
const prev7 = (arr: number[]) => arr.slice(0, 7);

const getTrend = (arr: number[]): "up" | "down" | "flat" => {
  const current = sum(last7(arr));
  const previous = sum(prev7(arr));
  if (!previous && !current) return "flat";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
};

const getHealthColor = (value: number, min: number, max: number) => {
  if (value >= min && value <= max) return "text-green-500";
  if (value < min) return "text-yellow-500";
  return "text-yellow-500";
};

export const WeeklyMetricsCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-metrics"],
    queryFn: async (): Promise<MetricData> => {
      const today = startOfDay(new Date());
      const fourteenDaysAgo = subDays(today, 13).toISOString();
      const weekAgo = subDays(today, 6).toISOString();

      // Fetch incidents (14 days)
      const { data: incidents } = await supabase
        .from("incidents")
        .select("started_at")
        .gte("started_at", fourteenDaysAgo);

      // Fetch breaking stories (14 days)
      const { data: breaking } = await supabase
        .from("content_queue")
        .select("created_at")
        .eq("is_breaking", true)
        .gte("created_at", fourteenDaysAgo);

      // Fetch published stories (14 days)
      const { data: published } = await supabase
        .from("content_queue")
        .select("created_at")
        .in("status", ["published", "auto_published"])
        .gte("created_at", fourteenDaysAgo);

      // Bucket into 14-day arrays
      function bucketDailyCounts(dates: { created_at?: string; started_at?: string }[]) {
        const buckets = new Array(14).fill(0);
        for (const row of dates) {
          const dt = new Date(row.created_at || row.started_at!);
          const dayIndex = differenceInCalendarDays(today, startOfDay(dt));
          const idxFromLeft = 13 - dayIndex;
          if (idxFromLeft >= 0 && idxFromLeft < 14) {
            buckets[idxFromLeft] += 1;
          }
        }
        return buckets;
      }

      const incidentsByDay = bucketDailyCounts(incidents || []);
      const breakingByDay = bucketDailyCounts(breaking || []);
      const publishedByDay = bucketDailyCounts(published || []);

      // Fetch source health
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
        incidentsThisWeek: sum(last7(incidentsByDay)),
        breakingStoriesThisWeek: sum(last7(breakingByDay)),
        publishedThisWeek: sum(last7(publishedByDay)),
        activeSourcesHealthy: healthySources,
        totalActiveSources: totalSources,
        incidentsByDay,
        breakingByDay,
        publishedByDay,
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

  const incidentsTrend = getTrend(data?.incidentsByDay || []);
  const breakingTrend = getTrend(data?.breakingByDay || []);
  const publishedTrend = getTrend(data?.publishedByDay || []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Weekly Metrics
        </CardTitle>
        <p className="text-sm text-muted-foreground">Last 7 days vs previous 7</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Incidents */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Incidents</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${getHealthColor(data?.incidentsThisWeek || 0, 1, 5)}`}>
                  {data?.incidentsThisWeek || 0}
                </span>
                <TrendArrow trend={incidentsTrend} />
                <span className="text-xs text-muted-foreground ml-1">target: 1-3</span>
              </div>
            </div>
            <Sparkline values={data?.incidentsByDay || []} />
          </div>

          {/* Breaking Stories */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Breaking</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${getHealthColor(data?.breakingStoriesThisWeek || 0, 2, 8)}`}>
                  {data?.breakingStoriesThisWeek || 0}
                </span>
                <TrendArrow trend={breakingTrend} />
                <span className="text-xs text-muted-foreground ml-1">target: 2-5</span>
              </div>
            </div>
            <Sparkline values={data?.breakingByDay || []} />
          </div>

          {/* Published */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Published</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${getHealthColor(data?.publishedThisWeek || 0, 25, 100)}`}>
                  {data?.publishedThisWeek || 0}
                </span>
                <TrendArrow trend={publishedTrend} />
                <span className="text-xs text-muted-foreground ml-1">target: 25-75</span>
              </div>
            </div>
            <Sparkline values={data?.publishedByDay || []} />
          </div>

          {/* Source Health - no sparkline, just status */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Source Health</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${sourceHealthPercent >= 90 ? "text-green-500" : sourceHealthPercent >= 70 ? "text-yellow-500" : "text-destructive"}`}>
                  {sourceHealthPercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({data?.activeSourcesHealthy}/{data?.totalActiveSources})
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
