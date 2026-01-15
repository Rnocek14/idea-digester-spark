import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, XCircle, Clock, Radio, FileText, Zap, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { formatDistanceToNow, subDays, subHours, format } from "date-fns";

interface SourceStats {
  id: string;
  name: string;
  type: string;
  status: string;
  category: string | null;
  last_fetched_at: string | null;
  stories_24h: number;
  stories_7d: number;
  breaking_24h: number;
  firecrawl_used: number;
  health_status: 'healthy' | 'warning' | 'critical' | 'dormant';
  last_error?: { message: string; at: string };
}

const SourceHealth = () => {
  const { data: sourceStats, isLoading } = useQuery({
    queryKey: ["source-health-detailed"],
    queryFn: async () => {
      const now = new Date();
      const twoHoursAgo = subHours(now, 2).toISOString();
      const fortyEightHoursAgo = subHours(now, 48).toISOString();
      const sevenDaysAgo = subDays(now, 7).toISOString();

      // Parallel fetch: sources + server-side aggregated stats + recent errors
      const [sourcesResult, statsResult, errorsResult] = await Promise.all([
        supabase
          .from("sources")
          .select("id, name, type, status, category, last_fetched_at")
          .order("name"),
        // Use RPC for server-side aggregation (returns ~dozens of rows, not thousands)
        supabase.rpc("get_source_health_stats"),
        // Fetch only error logs (with limit)
        supabase
          .from("activity_log")
          .select("entity_id, details, created_at")
          .eq("entity_type", "source")
          .ilike("action", "%sync%")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const sourcesData = sourcesResult.data || [];
      const statsData = statsResult.data || [];
      const recentErrors = errorsResult.data || [];

      // Build stats map from RPC result
      const statsMap: Record<string, { stories_24h: number; stories_7d: number; breaking_24h: number; firecrawl_7d: number }> = {};
      statsData.forEach((row: any) => {
        statsMap[row.source_id] = {
          stories_24h: Number(row.stories_24h) || 0,
          stories_7d: Number(row.stories_7d) || 0,
          breaking_24h: Number(row.breaking_24h) || 0,
          firecrawl_7d: Number(row.firecrawl_7d) || 0,
        };
      });

      // Build error map (first error per source)
      const errorMap: Record<string, { message: string; at: string }> = {};
      recentErrors.forEach((e: any) => {
        const id = e.entity_id;
        if (id && !errorMap[id]) {
          const details = e.details as any;
          if (details?.error || details?.status === 'error') {
            errorMap[id] = { message: details.error || 'Unknown error', at: e.created_at };
          }
        }
      });

      const sources: SourceStats[] = sourcesData.map(source => {
        const stats = statsMap[source.id] || { stories_24h: 0, stories_7d: 0, breaking_24h: 0, firecrawl_7d: 0 };
        const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at) : null;
        const isActive = source.status === 'active';

        let health_status: SourceStats['health_status'] = 'dormant';
        if (isActive) {
          if (stats.stories_24h > 0 || (lastFetched && lastFetched >= new Date(twoHoursAgo))) {
            health_status = 'healthy';
          } else if (lastFetched && lastFetched >= new Date(fortyEightHoursAgo)) {
            health_status = 'warning';
          } else {
            health_status = 'critical';
          }
        }

        return {
          id: source.id,
          name: source.name,
          type: source.type,
          status: source.status,
          category: source.category,
          last_fetched_at: source.last_fetched_at,
          stories_24h: stats.stories_24h,
          stories_7d: stats.stories_7d,
          breaking_24h: stats.breaking_24h,
          firecrawl_used: stats.firecrawl_7d,
          health_status,
          last_error: errorMap[source.id],
        };
      });

      const activeSources = sources.filter(s => s.status === 'active');
      return {
        sources,
        overview: {
          totalSources: sources.length,
          activeSources: activeSources.length,
          healthySources: sources.filter(s => s.health_status === 'healthy').length,
          warningSources: sources.filter(s => s.health_status === 'warning').length,
          criticalSources: sources.filter(s => s.health_status === 'critical').length,
          totalStories24h: sources.reduce((sum, s) => sum + s.stories_24h, 0),
          totalStories7d: sources.reduce((sum, s) => sum + s.stories_7d, 0),
          firecrawlUsage7d: sources.reduce((sum, s) => sum + s.firecrawl_used, 0),
        },
      };
    },
    staleTime: 60000,
  });

  const getHealthIcon = (status: SourceStats['health_status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Source Health</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const { sources, overview } = sourceStats || { sources: [], overview: { totalSources: 0, activeSources: 0, healthySources: 0, warningSources: 0, criticalSources: 0, totalStories24h: 0, totalStories7d: 0, firecrawlUsage7d: 0 } };
  const healthySources = sources.filter(s => s.health_status === 'healthy');
  const warningSources = sources.filter(s => s.health_status === 'warning');
  const criticalSources = sources.filter(s => s.health_status === 'critical');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Source Health Dashboard</h1>
        <Badge variant="outline">{format(new Date(), 'h:mm a')}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Sources</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{overview.activeSources}</div><div className="flex gap-2 mt-1 text-xs"><span className="text-green-500">{overview.healthySources} healthy</span><span className="text-yellow-500">{overview.warningSources} warning</span><span className="text-destructive">{overview.criticalSources} critical</span></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Stories (24h)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{overview.totalStories24h}</div><div className="text-xs text-muted-foreground">{overview.totalStories7d} in 7 days</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Zap className="h-4 w-4 text-orange-500" />Firecrawl</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{overview.firecrawlUsage7d}</div><div className="text-xs text-muted-foreground">pages (7d)</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Health Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{overview.activeSources > 0 ? Math.round((overview.healthySources / overview.activeSources) * 100) : 0}%</div></CardContent></Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({sources.length})</TabsTrigger>
          <TabsTrigger value="critical" className="text-destructive">Critical ({criticalSources.length})</TabsTrigger>
          <TabsTrigger value="warning">Warning ({warningSources.length})</TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          <ScrollArea className="h-[400px]">
            <TabsContent value="all" className="m-0">
              {sources.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {getHealthIcon(s.health_status)}
                    <span className="font-medium truncate">{s.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{s.type}</Badge>
                    {s.firecrawl_used > 0 && <span title={`${s.firecrawl_used} Firecrawl pages`}><Zap className="h-3 w-3 text-orange-500 shrink-0" /></span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span title="24h / 7d stories">{s.stories_24h} / {s.stories_7d}</span>
                    {s.last_error && (
                      <span className="text-destructive text-xs truncate max-w-[150px]" title={s.last_error.message}>
                        {s.last_error.message.slice(0, 30)}...
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{s.last_fetched_at ? formatDistanceToNow(new Date(s.last_fetched_at), { addSuffix: true }) : 'Never'}</span>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="critical" className="m-0">
              {criticalSources.length === 0 ? <div className="p-8 text-center text-green-600">All sources healthy! 🎉</div> : criticalSources.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border-b last:border-0"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /><span>{s.name}</span></div><span className="text-xs text-muted-foreground">{s.last_fetched_at ? formatDistanceToNow(new Date(s.last_fetched_at), { addSuffix: true }) : 'Never'}</span></div>
              ))}
            </TabsContent>
            <TabsContent value="warning" className="m-0">
              {warningSources.length === 0 ? <div className="p-8 text-center text-muted-foreground">No warnings</div> : warningSources.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border-b last:border-0"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-yellow-500" /><span>{s.name}</span></div><span className="text-xs text-muted-foreground">{s.last_fetched_at ? formatDistanceToNow(new Date(s.last_fetched_at), { addSuffix: true }) : 'Never'}</span></div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Card>
      </Tabs>
    </div>
  );
};

export default SourceHealth;
