import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Zap,
  BarChart3,
  MapPin,
  Layers
} from "lucide-react";
import { formatDistanceToNow, subDays, subHours, format } from "date-fns";

interface PipelineMetrics {
  throughput: {
    created1h: number;
    created24h: number;
    created7d: number;
    published24h: number;
    autoPublished24h: number;
    avgApprovalLagMinutes: number;
  };
  bottlenecks: {
    pendingTotal: number;
    pending7d: number;
    expired7d: number;
    rejected7d: number;
    blocked7d: number;
  };
  sourceHealth: {
    topProducers: Array<{ name: string; count: number; id: string }>;
    failingSources: Array<{ name: string; failures: number; lastError?: string }>;
    staleSources: Array<{ name: string; lastContent: string | null }>;
  };
  mix: {
    categories24h: Record<string, number>;
    categories7d: Record<string, number>;
    geoTiers24h: Record<number, number>;
    geoTiers7d: Record<number, number>;
  };
  alerts: Array<{ type: 'critical' | 'warning'; message: string }>;
}

const PipelineHealth = () => {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: async (): Promise<PipelineMetrics> => {
      const now = new Date();
      const oneHourAgo = subHours(now, 1).toISOString();
      const twentyFourHoursAgo = subHours(now, 24).toISOString();
      const sevenDaysAgo = subDays(now, 7).toISOString();
      const threeDaysAgo = subDays(now, 3).toISOString();

      // Parallel fetch all data
      const [
        created1hResult,
        created24hResult,
        created7dResult,
        statusBreakdownResult,
        published24hResult,
        categoriesResult,
        geoTiersResult,
        topSourcesResult,
        sourcesResult,
        recentApprovalsResult,
      ] = await Promise.all([
        // Throughput: created counts
        supabase.from("content_queue").select("id", { count: "exact", head: true })
          .gte("created_at", oneHourAgo),
        supabase.from("content_queue").select("id", { count: "exact", head: true })
          .gte("created_at", twentyFourHoursAgo),
        supabase.from("content_queue").select("id", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo),
        
        // Bottlenecks: status breakdown
        supabase.from("content_queue")
          .select("status, created_at")
          .gte("created_at", sevenDaysAgo),
        
        // Published counts
        supabase.from("content_queue")
          .select("status", { count: "exact", head: true })
          .in("status", ["published", "auto_published"])
          .gte("created_at", twentyFourHoursAgo),
        
        // Category distribution
        supabase.from("content_queue")
          .select("category, created_at")
          .gte("created_at", sevenDaysAgo)
          .not("category", "is", null),
        
        // Geo tier distribution
        supabase.from("content_queue")
          .select("geo_tier, created_at")
          .gte("created_at", sevenDaysAgo),
        
        // Top sources by content produced
        supabase.from("content_queue")
          .select("source_id, sources!inner(name)")
          .gte("created_at", sevenDaysAgo)
          .not("source_id", "is", null),
        
        // Sources status
        supabase.from("sources")
          .select("id, name, last_fetched_at, status")
          .eq("status", "active"),
        
        // Recent approvals for lag calculation
        supabase.from("content_queue")
          .select("created_at, reviewed_at")
          .not("reviewed_at", "is", null)
          .gte("reviewed_at", twentyFourHoursAgo)
          .limit(100),
      ]);

      // Process throughput
      const created1h = created1hResult.count || 0;
      const created24h = created24hResult.count || 0;
      const created7d = created7dResult.count || 0;
      const published24h = published24hResult.count || 0;

      // Process status breakdown
      const statusData = statusBreakdownResult.data || [];
      const pendingTotal = statusData.filter(s => s.status === 'pending').length;
      const pending7d = pendingTotal; // Same query window
      const expired7d = statusData.filter(s => s.status === 'expired').length;
      const rejected7d = statusData.filter(s => s.status === 'rejected').length;
      const blocked7d = statusData.filter(s => s.status === 'blocked').length;
      const autoPublished24h = statusData.filter(s => 
        s.status === 'auto_published' && new Date(s.created_at) >= new Date(twentyFourHoursAgo)
      ).length;

      // Calculate approval lag
      const approvals = recentApprovalsResult.data || [];
      let avgLag = 0;
      if (approvals.length > 0) {
        const totalLag = approvals.reduce((sum, item) => {
          const created = new Date(item.created_at).getTime();
          const reviewed = new Date(item.reviewed_at).getTime();
          return sum + (reviewed - created);
        }, 0);
        avgLag = Math.round(totalLag / approvals.length / 60000); // Convert to minutes
      }

      // Process categories
      const catData = categoriesResult.data || [];
      const categories24h: Record<string, number> = {};
      const categories7d: Record<string, number> = {};
      catData.forEach(item => {
        const cat = item.category || 'unknown';
        categories7d[cat] = (categories7d[cat] || 0) + 1;
        if (new Date(item.created_at) >= new Date(twentyFourHoursAgo)) {
          categories24h[cat] = (categories24h[cat] || 0) + 1;
        }
      });

      // Process geo tiers
      const geoData = geoTiersResult.data || [];
      const geoTiers24h: Record<number, number> = {};
      const geoTiers7d: Record<number, number> = {};
      geoData.forEach(item => {
        const tier = item.geo_tier ?? 0;
        geoTiers7d[tier] = (geoTiers7d[tier] || 0) + 1;
        if (new Date(item.created_at) >= new Date(twentyFourHoursAgo)) {
          geoTiers24h[tier] = (geoTiers24h[tier] || 0) + 1;
        }
      });

      // Process top sources
      const sourceCountMap: Record<string, { name: string; count: number }> = {};
      (topSourcesResult.data || []).forEach((item: any) => {
        const id = item.source_id;
        const name = item.sources?.name || 'Unknown';
        if (!sourceCountMap[id]) {
          sourceCountMap[id] = { name, count: 0 };
        }
        sourceCountMap[id].count++;
      });
      const topProducers = Object.entries(sourceCountMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Process source health - sources without consecutive_failures column
      const sources = sourcesResult.data || [];
      
      // Find stale sources (no content in 3+ days)
      const staleSources = sources
        .filter(s => {
          if (!s.last_fetched_at) return true;
          return new Date(s.last_fetched_at) < new Date(threeDaysAgo);
        })
        .map(s => ({ name: s.name, lastContent: s.last_fetched_at }))
        .slice(0, 10);

      // For failing sources, check if they're not in topProducers but are active
      const producingSourceIds = new Set(topProducers.map(p => p.id));
      const notProducingSources = sources
        .filter(s => !producingSourceIds.has(s.id) && s.last_fetched_at)
        .map(s => ({ name: s.name, failures: 0, lastError: 'No content in 7 days' }))
        .slice(0, 5);

      // Generate alerts
      const alerts: Array<{ type: 'critical' | 'warning'; message: string }> = [];
      
      if (pendingTotal > 20) {
        alerts.push({ type: 'warning', message: `${pendingTotal} items pending approval` });
      }
      if (created1h < 1 && new Date().getHours() >= 8 && new Date().getHours() <= 22) {
        alerts.push({ type: 'critical', message: 'No new content in the last hour' });
      }
      if (staleSources.length > 5) {
        alerts.push({ type: 'warning', message: `${staleSources.length} sources haven't fetched in 3+ days` });
      }
      if (expired7d > created7d * 0.3) {
        alerts.push({ type: 'warning', message: `High expiration rate: ${expired7d} expired vs ${created7d} created` });
      }

      return {
        throughput: {
          created1h,
          created24h,
          created7d,
          published24h,
          autoPublished24h,
          avgApprovalLagMinutes: avgLag,
        },
        bottlenecks: {
          pendingTotal,
          pending7d,
          expired7d,
          rejected7d,
          blocked7d,
        },
        sourceHealth: {
          topProducers,
          failingSources: notProducingSources,
          staleSources,
        },
        mix: {
          categories24h,
          categories7d,
          geoTiers24h,
          geoTiers7d,
        },
        alerts,
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Pipeline Health</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Pipeline Health</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading metrics</AlertTitle>
          <AlertDescription>{(error as Error)?.message || 'Unknown error'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { throughput, bottlenecks, sourceHealth, mix, alerts } = metrics;

  // Calculate rates
  const autoPublishRate = throughput.created24h > 0 
    ? Math.round((throughput.autoPublished24h / throughput.created24h) * 100) 
    : 0;
  
  const approvalRate = throughput.created24h > 0
    ? Math.round((throughput.published24h / throughput.created24h) * 100)
    : 0;

  // Geo tier labels
  const geoTierLabels: Record<number, string> = {
    0: 'Regional (WI)',
    1: 'Hyperlocal (LG)',
    2: 'County',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline Health</h1>
          <p className="text-muted-foreground">Real-time content pipeline monitoring</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Activity className="h-3 w-3 mr-1" />
          Updated {format(new Date(), 'h:mm a')}
        </Badge>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Alert key={i} variant={alert.type === 'critical' ? 'destructive' : 'default'}>
              {alert.type === 'critical' ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Throughput Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Created (1h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{throughput.created1h}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {throughput.created24h} in 24h • {throughput.created7d} in 7d
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Published (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{throughput.published24h}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={approvalRate} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{approvalRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Auto-Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{throughput.autoPublished24h}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={autoPublishRate} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{autoPublishRate}% rate</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Avg Approval Lag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {throughput.avgApprovalLagMinutes < 60 
                ? `${throughput.avgApprovalLagMinutes}m`
                : `${Math.round(throughput.avgApprovalLagMinutes / 60)}h`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              from created → reviewed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottlenecks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Bottlenecks (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{bottlenecks.pendingTotal}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{bottlenecks.expired7d}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{bottlenecks.rejected7d}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{bottlenecks.blocked7d}</div>
              <div className="text-xs text-muted-foreground">Blocked</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {throughput.created7d - bottlenecks.pendingTotal - bottlenecks.expired7d - bottlenecks.rejected7d - bottlenecks.blocked7d}
              </div>
              <div className="text-xs text-muted-foreground">Published</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Producing Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Sources (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {sourceHealth.topProducers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No sources producing</div>
              ) : (
                <div className="space-y-2">
                  {sourceHealth.topProducers.map((source, i) => (
                    <div key={source.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm truncate max-w-[180px]">{source.name}</span>
                      </div>
                      <Badge variant="secondary">{source.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Source Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Source Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {sourceHealth.failingSources.length === 0 && sourceHealth.staleSources.length === 0 ? (
                <div className="text-center text-green-600 py-8">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  All sources healthy!
                </div>
              ) : (
                <div className="space-y-3">
                  {sourceHealth.failingSources.map(source => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[180px]">{source.name}</span>
                      <Badge variant="destructive">{source.failures} failures</Badge>
                    </div>
                  ))}
                  {sourceHealth.staleSources.map(source => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[180px] text-muted-foreground">{source.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {source.lastContent 
                          ? formatDistanceToNow(new Date(source.lastContent), { addSuffix: true })
                          : 'Never'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Content Mix */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Category Mix (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(mix.categories24h)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([category, count]) => {
                  const total = Object.values(mix.categories24h).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={category} className="flex items-center gap-2">
                      <span className="text-sm w-24 truncate capitalize">{category}</span>
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Geo Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geo Tier Mix (24h)
            </CardTitle>
            <CardDescription>
              Target: 60-70% hyperlocal (Tier 1-2), max 30% regional (Tier 0)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 0].map(tier => {
                const count = mix.geoTiers24h[tier] || 0;
                const total = Object.values(mix.geoTiers24h).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isOverLimit = tier === 0 && pct > 30;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className="text-sm w-28">{geoTierLabels[tier]}</span>
                    <Progress 
                      value={pct} 
                      className={`h-3 flex-1 ${isOverLimit ? '[&>div]:bg-destructive' : ''}`}
                    />
                    <span className={`text-xs w-16 text-right ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hyperlocal ratio</span>
                <span className="font-medium">
                  {(() => {
                    const tier1 = mix.geoTiers24h[1] || 0;
                    const tier2 = mix.geoTiers24h[2] || 0;
                    const total = Object.values(mix.geoTiers24h).reduce((a, b) => a + b, 0);
                    return total > 0 ? `${Math.round(((tier1 + tier2) / total) * 100)}%` : '0%';
                  })()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PipelineHealth;
