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
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Zap,
  BarChart3,
  MapPin,
  Layers,
  Radio
} from "lucide-react";
import { formatDistanceToNow, subDays, subHours, format } from "date-fns";
import { SkipReasonsCard } from "@/components/SkipReasonsCard";

interface StarvingSource {
  id: string;
  name: string;
  hoursSinceLastFetch: number;
  isCritical: boolean; // >= 24h
  neverFetched: boolean; // last_fetched_at is null
}

// Zero-safe percentage calculation helper
const safePct = (n: number, total: number): number => 
  total > 0 ? Math.round((n / total) * 100) : 0;

// Format hours for display, handling Infinity/"never"
const formatStarvingAge = (hours: number, neverFetched: boolean): string => {
  if (neverFetched || !isFinite(hours)) return 'never';
  if (hours >= 24) return `${Math.round(hours / 24)}d ago`;
  return `${Math.round(hours)}h ago`;
};

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
  pendingAge: {
    under6h: number;
    from6to24h: number;
    over24h: number;
  };
  sourceHealth: {
    topProducers: Array<{ name: string; count: number; id: string }>;
    failingSources: Array<{ name: string; failures: number; lastError?: string }>;
    staleSources: Array<{ name: string; lastContent: string | null }>;
    starvingSourcesTop: StarvingSource[]; // Top 10 for display
    starvingTotal: number; // Total count before slice
    criticalStarvingTotal: number; // Critical count before slice
  };
  skipSummary: {
    aiFailedPct: number;
    eventCapPct: number;
    total24h: number;
  };
  mix: {
    categories24h: Record<string, number>;
    categories7d: Record<string, number>;
    geoTiers24h: Record<number, number>;
    geoTiers7d: Record<number, number>;
  };
  alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }>;
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
        // Skip data for causal hints (lightweight aggregate)
        skips24hResult,
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
        
        // Sources status (include type for frequency-based starvation thresholds)
        supabase.from("sources")
          .select("id, name, last_fetched_at, status, type")
          .eq("status", "active"),
        
        // Recent approvals for lag calculation
        supabase.from("content_queue")
          .select("created_at, reviewed_at")
          .not("reviewed_at", "is", null)
          .gte("reviewed_at", twentyFourHoursAgo)
          .limit(100),
        
        // Skip reasons for causal hints (24h only, just reason)
        supabase.from("sync_skips")
          .select("reason")
          .gte("created_at", twentyFourHoursAgo),
      ]);

      // Process throughput
      const created1h = created1hResult.count || 0;
      const created24h = created24hResult.count || 0;
      const created7d = created7dResult.count || 0;
      const published24h = published24hResult.count || 0;

      // Process status breakdown
      const statusData = statusBreakdownResult.data || [];
      const pendingItems = statusData.filter(s => s.status === 'pending');
      const pendingTotal = pendingItems.length;
      const pending7d = pendingTotal; // Same query window
      const expired7d = statusData.filter(s => s.status === 'expired').length;
      const rejected7d = statusData.filter(s => s.status === 'rejected').length;
      const blocked7d = statusData.filter(s => s.status === 'blocked').length;
      const autoPublished24h = statusData.filter(s => 
        s.status === 'auto_published' && new Date(s.created_at) >= new Date(twentyFourHoursAgo)
      ).length;

      // Calculate pending age breakdown
      const sixHoursAgo = subHours(now, 6);
      let under6h = 0;
      let from6to24h = 0;
      let over24h = 0;
      
      pendingItems.forEach(item => {
        const createdAt = new Date(item.created_at);
        if (createdAt >= sixHoursAgo) {
          under6h++;
        } else if (createdAt >= new Date(twentyFourHoursAgo)) {
          from6to24h++;
        } else {
          over24h++;
        }
      });

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

      // Process source health
      const sources = (sourcesResult.data || []) as Array<{ 
        id: string; 
        name: string; 
        last_fetched_at: string | null; 
        status: string;
        type?: string;
      }>;
      
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

      // Calculate starving sources: per-source starvation based on fetch recency
      // RSS/scrape sources: 6h threshold (high-freq), 24h critical
      const allStarvingSources: StarvingSource[] = sources
        .filter(s => s.type === 'rss' || s.type === 'scrape')
        .map(s => {
          const lastFetched = s.last_fetched_at ? new Date(s.last_fetched_at) : null;
          const neverFetched = lastFetched === null;
          const hoursSinceLastFetch = lastFetched 
            ? (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60)
            : Infinity;
          return {
            id: s.id,
            name: s.name,
            hoursSinceLastFetch,
            isCritical: neverFetched || hoursSinceLastFetch >= 24, // Never fetched = always critical
            neverFetched,
          };
        })
        .filter(s => s.hoursSinceLastFetch >= 6) // Starving = 6+ hours
        .sort((a, b) => b.hoursSinceLastFetch - a.hoursSinceLastFetch);
      
      // Compute totals BEFORE slicing for accurate badge counts
      const criticalStarvingTotal = allStarvingSources.filter(s => s.isCritical).length;
      const starvingTotal = allStarvingSources.length;
      const starvingSourcesTop = allStarvingSources.slice(0, 10);

      // Process skip data for causal hints
      // Defensive: handle both row-per-skip and aggregated {reason, count} formats
      const skipsData = skips24hResult.data || [];
      const skipTotal24h = skipsData.reduce((sum: number, s: any) => sum + (s.count ?? 1), 0);
      const aiFailedCount = skipsData
        .filter((s: any) => s.reason === 'ai_failed')
        .reduce((sum: number, s: any) => sum + (s.count ?? 1), 0);
      const eventCapCount = skipsData
        .filter((s: any) => s.reason === 'daily_event_cap_reached')
        .reduce((sum: number, s: any) => sum + (s.count ?? 1), 0);
      const aiFailedPct = safePct(aiFailedCount, skipTotal24h);
      const eventCapPct = safePct(eventCapCount, skipTotal24h);

      // Generate alerts
      const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];
      
      // Per-source starvation alerts (more actionable than global)
      // Use total counts (not sliced) for accurate thresholds
      if (criticalStarvingTotal >= 1 && created24h >= 20) {
        alerts.push({ type: 'critical', message: `${criticalStarvingTotal} source${criticalStarvingTotal > 1 ? 's' : ''} starving (24h+ without fetch)` });
      } else if (starvingTotal >= 3 && created24h >= 20) {
        alerts.push({ type: 'warning', message: `${starvingTotal} sources starving (6h+ without fetch)` });
      }
      
      // Global ingestion starvation: fire only when high 24h volume but sudden stop
      // Add causal hint based on skip data and starving sources
      // Use consistent `now` for time checks (avoid drift, easier testing)
      const currentHour = now.getHours();
      const isBusinessHours = currentHour >= 8 && currentHour <= 22;
      
      if (created1h === 0 && created24h >= 20 && isBusinessHours) {
        let causalHint = '';
        if (criticalStarvingTotal >= 1) {
          causalHint = ' (likely upstream: starving sources)';
        } else if (aiFailedPct > 20) {
          causalHint = ' (likely AI failures)';
        } else if (eventCapPct > 15) {
          causalHint = ' (likely event cap)';
        } else {
          causalHint = ' (likely filtering/dedupe)';
        }
        alerts.push({ type: 'critical', message: `No new content in the last hour${causalHint}` });
      }
      
      // Low volume info (not critical, just informational)
      if (created1h === 0 && created24h < 20 && isBusinessHours) {
        alerts.push({ type: 'info', message: 'Low ingestion pace today (24h volume < 20)' });
      }
      
      if (pendingTotal > 20) {
        alerts.push({ type: 'warning', message: `${pendingTotal} items pending approval` });
      }
      if (staleSources.length > 5) {
        alerts.push({ type: 'warning', message: `${staleSources.length} sources haven't fetched in 3+ days` });
      }
      if (expired7d > created7d * 0.3) {
        alerts.push({ type: 'warning', message: `High expiration rate: ${expired7d} expired vs ${created7d} created` });
      }
      // Backlog alert: over24h >= 10 OR (over24h >= 25% of pending AND over24h >= 3)
      const over24hPct = pendingTotal > 0 ? (over24h / pendingTotal) : 0;
      if (over24h >= 10 || (over24hPct >= 0.25 && over24h >= 3)) {
        alerts.push({ type: 'warning', message: `Backlog accumulating: ${over24h} items pending >24h` });
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
        pendingAge: {
          under6h,
          from6to24h,
          over24h,
        },
        sourceHealth: {
          topProducers,
          failingSources: notProducingSources,
          staleSources,
          starvingSourcesTop,
          starvingTotal,
          criticalStarvingTotal,
        },
        skipSummary: {
          aiFailedPct,
          eventCapPct,
          total24h: skipTotal24h,
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

  const { throughput, bottlenecks, pendingAge, sourceHealth, mix, alerts } = metrics;

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
            <Alert 
              key={i} 
              variant={alert.type === 'critical' ? 'destructive' : 'default'}
              className={alert.type === 'info' ? 'border-muted bg-muted/30' : ''}
            >
              {alert.type === 'critical' ? (
                <XCircle className="h-4 w-4" />
              ) : alert.type === 'info' ? (
                <Activity className="h-4 w-4" />
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

      {/* Pending Age Breakdown */}
      {bottlenecks.pendingTotal > 0 && (() => {
        const total = bottlenecks.pendingTotal;
        const under6hPct = safePct(pendingAge.under6h, total);
        const from6to24hPct = safePct(pendingAge.from6to24h, total);
        const over24hPct = safePct(pendingAge.over24h, total);
        
        // Smart diagnostics
        const isBacklogAccumulating = pendingAge.over24h >= 10 || (over24hPct >= 25 && pendingAge.over24h >= 3);
        const isQueueFresh = under6hPct >= 65 && pendingAge.over24h === 0;
        
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Pending Age Breakdown
              </CardTitle>
              <CardDescription>
                {isBacklogAccumulating 
                  ? "⚠️ Backlog accumulating — moderation may be stuck"
                  : isQueueFresh
                    ? "✓ Queue is fresh — ingestion healthy"
                    : "Items aging normally"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold text-primary">{pendingAge.under6h}</div>
                  <div className="text-xs text-muted-foreground">&lt;6h ({under6hPct}%)</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <div className={`text-2xl font-bold ${from6to24hPct > 40 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {pendingAge.from6to24h}
                  </div>
                  <div className="text-xs text-muted-foreground">6–24h ({from6to24hPct}%)</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <div className={`text-2xl font-bold ${isBacklogAccumulating ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {pendingAge.over24h}
                  </div>
                  <div className="text-xs text-muted-foreground">&gt;24h ({over24hPct}%)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Skip Reasons - Diagnostic Section */}
      <SkipReasonsCard />

      {/* Starving Sources Panel */}
      {sourceHealth.starvingTotal > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-5 w-5 text-destructive" />
                Starving Sources
              </CardTitle>
              <Badge 
                variant={sourceHealth.criticalStarvingTotal > 0 ? 'destructive' : 'outline'}
              >
                {sourceHealth.criticalStarvingTotal} critical
                {sourceHealth.starvingTotal > 10 && ` (showing top 10 of ${sourceHealth.starvingTotal})`}
              </Badge>
            </div>
            <CardDescription>
              Sources not fetched in 6+ hours (RSS/scrape only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[180px]">
              <div className="space-y-2">
                {sourceHealth.starvingSourcesTop.map((source) => (
                  <div 
                    key={source.id} 
                    className={`flex items-center justify-between p-2 rounded-md ${
                      source.isCritical ? 'bg-destructive/10' : 'bg-muted/50'
                    }`}
                  >
                    <span className="text-sm truncate max-w-[200px]">{source.name}</span>
                    <span className={`text-xs font-medium ${
                      source.isCritical ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {formatStarvingAge(source.hoursSinceLastFetch, source.neverFetched)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

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
