import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { formatDistanceToNow, subDays, subHours } from "date-fns";

interface SourceAlert {
  id: string;
  name: string;
  type: "critical" | "warning" | "info";
  message: string;
  lastFetched: string | null;
}

export const SourceHealthAlerts = () => {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["source-health-alerts"],
    queryFn: async (): Promise<SourceAlert[]> => {
      const { data: sources } = await supabase
        .from("sources")
        .select("id, name, type, last_fetched_at, status")
        .eq("status", "active");

      if (!sources) return [];

      const now = new Date();
      const alerts: SourceAlert[] = [];

      // Check for 7-day inactive sources (to account for event-based feeds)
      const weekAgo = subDays(now, 7);
      
      // Get story counts per source for the last 7 days
      const { data: storyCounts } = await supabase
        .from("content_queue")
        .select("source_id")
        .gte("created_at", weekAgo.toISOString());

      const storyCountMap = new Map<string, number>();
      storyCounts?.forEach(s => {
        if (s.source_id) {
          storyCountMap.set(s.source_id, (storyCountMap.get(s.source_id) || 0) + 1);
        }
      });

      for (const source of sources) {
        const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at) : null;
        const hoursSinceLastFetch = lastFetched 
          ? (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60)
          : Infinity;

        // Critical: Never fetched or stale >48h
        if (!lastFetched || hoursSinceLastFetch > 48) {
          alerts.push({
            id: source.id,
            name: source.name,
            type: "critical",
            message: lastFetched 
              ? `Stale for ${formatDistanceToNow(lastFetched)}`
              : "Never successfully fetched",
            lastFetched: source.last_fetched_at,
          });
          continue;
        }

        // Warning: Stale >24h
        if (hoursSinceLastFetch > 24) {
          alerts.push({
            id: source.id,
            name: source.name,
            type: "warning",
            message: `No fetch in ${formatDistanceToNow(lastFetched)}`,
            lastFetched: source.last_fetched_at,
          });
          continue;
        }

        // Info: 0 stories in 7 days (but recently fetched - might be event-based)
        const weeklyStories = storyCountMap.get(source.id) || 0;
        if (weeklyStories === 0 && hoursSinceLastFetch <= 24) {
          alerts.push({
            id: source.id,
            name: source.name,
            type: "info",
            message: "0 stories in 7 days (may be event-based)",
            lastFetched: source.last_fetched_at,
          });
        }
      }

      // Sort by severity: critical first, then warning, then info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return alerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Source Health Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts?.filter(a => a.type === "critical").length || 0;
  const warningCount = alerts?.filter(a => a.type === "warning").length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Source Health Alerts
          </CardTitle>
          {alerts && alerts.length === 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              All Healthy
            </Badge>
          )}
          {criticalCount > 0 && (
            <Badge variant="destructive">
              {criticalCount} critical
            </Badge>
          )}
          {criticalCount === 0 && warningCount > 0 && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              {warningCount} warning
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts && alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All {alerts?.length || 0} active sources are operating normally.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-2 rounded-md ${
                  alert.type === "critical"
                    ? "bg-destructive/10"
                    : alert.type === "warning"
                    ? "bg-yellow-500/10"
                    : "bg-muted/50"
                }`}
              >
                {alert.type === "critical" ? (
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                ) : alert.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{alert.name}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
