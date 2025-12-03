import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Radio, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SourceStats {
  id: string;
  name: string;
  type: string;
  status: string;
  last_fetched_at: string | null;
  stories_24h: number;
  breaking_24h: number;
}

export const SourceQualityCard = () => {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["source-quality-stats"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Get all active sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from("sources")
        .select("id, name, type, status, last_fetched_at")
        .eq("status", "active");
      
      if (sourcesError) throw sourcesError;
      
      // Get content counts per source for last 24h
      const { data: contentData, error: contentError } = await supabase
        .from("content_queue")
        .select("source_id, is_breaking")
        .gte("created_at", twentyFourHoursAgo);
      
      if (contentError) throw contentError;
      
      // Aggregate counts
      const stats: SourceStats[] = (sourcesData || []).map(source => {
        const sourceContent = (contentData || []).filter(c => c.source_id === source.id);
        return {
          ...source,
          stories_24h: sourceContent.length,
          breaking_24h: sourceContent.filter(c => c.is_breaking).length,
        };
      });
      
      // Sort by stories_24h descending
      return stats.sort((a, b) => b.stories_24h - a.stories_24h);
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const getHealthIndicator = (source: SourceStats) => {
    const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at) : null;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Green: has stories OR synced recently
    if (source.stories_24h > 0 || (lastFetched && lastFetched > twoHoursAgo)) {
      return { color: "text-green-500", icon: CheckCircle, label: "Healthy" };
    }
    
    // Yellow: no stories but synced in last 24h
    if (lastFetched && lastFetched > twentyFourHoursAgo) {
      return { color: "text-yellow-500", icon: Clock, label: "Quiet" };
    }
    
    // Red: no stories AND no sync in 24h+
    return { color: "text-red-500", icon: AlertCircle, label: "Stale" };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Source Quality</CardTitle>
          <Radio className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeSources = sources?.length || 0;
  const producingToday = sources?.filter(s => s.stories_24h > 0).length || 0;
  const staleCount = sources?.filter(s => getHealthIndicator(s).label === "Stale").length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Source Quality</CardTitle>
        <Radio className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick metrics */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Active:</span>{" "}
            <span className="font-medium">{activeSources}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Producing:</span>{" "}
            <span className="font-medium text-green-600">{producingToday}</span>
          </div>
          {staleCount > 0 && (
            <div>
              <span className="text-muted-foreground">Issues:</span>{" "}
              <span className="font-medium text-red-600">{staleCount}</span>
            </div>
          )}
        </div>

        {/* Source list */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sources?.map(source => {
            const health = getHealthIndicator(source);
            const HealthIcon = health.icon;
            
            return (
              <div key={source.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <HealthIcon className={`h-3.5 w-3.5 flex-shrink-0 ${health.color}`} />
                  <span className="truncate">{source.name}</span>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {source.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <span title="Stories last 24h">
                    {source.stories_24h} stories
                  </span>
                  {source.breaking_24h > 0 && (
                    <span className="text-orange-500" title="Breaking stories">
                      {source.breaking_24h} breaking
                    </span>
                  )}
                  {source.last_fetched_at && (
                    <span className="hidden sm:inline" title="Last sync">
                      {formatDistanceToNow(new Date(source.last_fetched_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
