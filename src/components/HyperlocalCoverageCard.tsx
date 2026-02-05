import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { subDays, startOfDay, differenceInCalendarDays } from "date-fns";

// Thresholds for health alerts
const TARGETS = {
  tier1Min: 40,        // Tier 1 should be ≥ 40%
  hyperlocalMin: 60,   // Tier 1+2 should be ≥ 60%
  tier0Max: 30,        // Tier 0 should be ≤ 30%
  alertThreshold: 50,  // Alert if hyperlocal < 50% for any day
};

interface CoverageData {
  tier1Pct: number;
  tier2Pct: number;
  tier0Pct: number;
  hyperlocalPct: number;
  total: number;
  tier1Count: number;
  tier2Count: number;
  tier0Count: number;
  dailyHyperlocalPct: (number | null)[];  // 7 days for sparkline, null = no data
  trend: 'up' | 'down' | 'flat';
  alertDays: number;  // Days below threshold (only counting days with stories)
}

// Sparkline component for coverage trend (handles null = no data)
const CoverageSparkline: React.FC<{ values: (number | null)[]; threshold: number }> = ({ values, threshold }) => {
  if (!values || values.length === 0) return null;
  
  const width = 80;
  const height = 24;
  const step = width / (values.length - 1 || 1);
  const maxVal = 100; // Percentage scale

  // Filter out nulls for the line, but keep positions for dots
  const validPoints = values
    .map((v, i) => v !== null ? { x: i * step, y: height - (v / maxVal) * (height - 4) - 2, val: v } : null)
    .filter((p): p is { x: number; y: number; val: number } => p !== null);

  const linePoints = validPoints.map(p => `${p.x},${p.y}`).join(" ");
  const thresholdY = height - (threshold / maxVal) * (height - 4) - 2;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Threshold line */}
      <line
        x1="0"
        y1={thresholdY}
        x2={width}
        y2={thresholdY}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2,2"
        className="text-muted-foreground/30"
      />
      {/* Data line (only valid points) */}
      {validPoints.length > 1 && (
        <polyline
          points={linePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-blue-500"
        />
      )}
      {/* Points - colored by status, gray for no data */}
      {values.map((v, i) => {
        const x = i * step;
        if (v === null) {
          // No data day - gray dot
          return (
            <circle
              key={i}
              cx={x}
              cy={height / 2}
              r="2"
              className="fill-muted-foreground/30"
            />
          );
        }
        const y = height - (v / maxVal) * (height - 4) - 2;
        const isBelow = v < threshold;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            className={isBelow ? "fill-destructive" : "fill-blue-500"}
          />
        );
      })}
    </svg>
  );
};

// Tier bar visualization
const TierBar: React.FC<{ tier1: number; tier2: number; tier0: number }> = ({ tier1, tier2, tier0 }) => {
  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted">
      <div 
        className="bg-blue-500 h-full transition-all"
        style={{ width: `${tier1}%` }}
        title={`Tier 1: ${tier1}%`}
      />
      <div 
        className="bg-amber-400 h-full transition-all"
        style={{ width: `${tier2}%` }}
        title={`Tier 2: ${tier2}%`}
      />
      <div 
        className="bg-slate-300 dark:bg-slate-600 h-full transition-all"
        style={{ width: `${tier0}%` }}
        title={`Tier 0: ${tier0}%`}
      />
    </div>
  );
};

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'flat' }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export const HyperlocalCoverageCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["hyperlocal-coverage"],
    queryFn: async (): Promise<CoverageData> => {
      const today = startOfDay(new Date());
      const sevenDaysAgo = subDays(today, 6).toISOString();
      const fourteenDaysAgo = subDays(today, 13).toISOString();

      // Fetch last 14 days of published content with geo_tier
      const { data: stories, error } = await supabase
        .from("content_queue")
        .select("geo_tier, created_at")
        .in("status", ["published", "auto_published"])
        .gte("created_at", fourteenDaysAgo);

      if (error) throw error;

      const allStories = stories || [];
      
      // Calculate overall percentages (last 7 days)
      const recentStories = allStories.filter(s => 
        new Date(s.created_at) >= new Date(sevenDaysAgo)
      );
      
      const total = recentStories.length;
      const tier1Count = recentStories.filter(s => s.geo_tier === 1).length;
      const tier2Count = recentStories.filter(s => s.geo_tier === 2).length;
      const tier0Count = recentStories.filter(s => s.geo_tier === 0 || s.geo_tier === null).length;

      const tier1Pct = total > 0 ? Math.round((tier1Count / total) * 100) : 0;
      const tier2Pct = total > 0 ? Math.round((tier2Count / total) * 100) : 0;
      const tier0Pct = total > 0 ? Math.round((tier0Count / total) * 100) : 0;
      const hyperlocalPct = tier1Pct + tier2Pct;

      // Calculate daily hyperlocal % for sparkline (last 7 days)
      // null = no stories that day (different from 0% which means stories but none hyperlocal)
      const dailyHyperlocalPct: (number | null)[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const dayStart = subDays(today, i);
        const dayStories = allStories.filter(s => {
          const storyDate = startOfDay(new Date(s.created_at));
          return differenceInCalendarDays(storyDate, dayStart) === 0;
        });
        
        if (dayStories.length === 0) {
          dailyHyperlocalPct.push(null); // No data, not 0%
        } else {
          const dayHyperlocal = dayStories.filter(s => s.geo_tier === 1 || s.geo_tier === 2).length;
          dailyHyperlocalPct.push(Math.round((dayHyperlocal / dayStories.length) * 100));
        }
      }

      // Calculate trend (this week vs previous week)
      const prevWeekStories = allStories.filter(s => {
        const created = new Date(s.created_at);
        return created >= new Date(fourteenDaysAgo) && created < new Date(sevenDaysAgo);
      });
      
      const prevTotal = prevWeekStories.length;
      const prevHyperlocal = prevWeekStories.filter(s => s.geo_tier === 1 || s.geo_tier === 2).length;
      const prevHyperlocalPct = prevTotal > 0 ? Math.round((prevHyperlocal / prevTotal) * 100) : 0;
      
      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (hyperlocalPct > prevHyperlocalPct + 5) trend = 'up';
      else if (hyperlocalPct < prevHyperlocalPct - 5) trend = 'down';

      // Count alert days (only days with stories that fell below threshold)
      const alertDays = dailyHyperlocalPct.filter(pct => pct !== null && pct < TARGETS.alertThreshold).length;

      return {
        tier1Pct,
        tier2Pct,
        tier0Pct,
        hyperlocalPct,
        total,
        tier1Count,
        tier2Count,
        tier0Count,
        dailyHyperlocalPct,
        trend,
        alertDays,
      };
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Hyperlocal Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isHealthy = (data?.hyperlocalPct || 0) >= TARGETS.hyperlocalMin;
  const tier1Healthy = (data?.tier1Pct || 0) >= TARGETS.tier1Min;
  const tier0Healthy = (data?.tier0Pct || 0) <= TARGETS.tier0Max;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Hyperlocal Coverage
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Geo-tier distribution · Last 7 days
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main hyperlocal percentage */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${isHealthy ? 'text-emerald-500' : 'text-amber-500'}`}>
                {data?.hyperlocalPct || 0}%
              </span>
              <TrendIcon trend={data?.trend || 'flat'} />
            </div>
            <p className="text-xs text-muted-foreground">
              Hyperlocal (Tier 1+2) · Target ≥{TARGETS.hyperlocalMin}%
            </p>
          </div>
          <CoverageSparkline 
            values={data?.dailyHyperlocalPct || []} 
            threshold={TARGETS.alertThreshold} 
          />
        </div>

        {/* Tier breakdown bar */}
        <div className="space-y-2">
          <TierBar 
            tier1={data?.tier1Pct || 0} 
            tier2={data?.tier2Pct || 0} 
            tier0={data?.tier0Pct || 0} 
          />
          <div className="flex justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className={tier1Healthy ? 'text-muted-foreground' : 'text-amber-500'}>
                Lake Geneva {data?.tier1Pct || 0}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-muted-foreground">
                Walworth {data?.tier2Pct || 0}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className={tier0Healthy ? 'text-muted-foreground' : 'text-amber-500'}>
                Regional {data?.tier0Pct || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Alert if below threshold */}
        {data && data.alertDays > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Hyperlocal coverage fell below {TARGETS.alertThreshold}% on {data.alertDays} day{data.alertDays > 1 ? 's' : ''} this week.
              Consider adding more Lake Geneva / Walworth sources.
            </p>
          </div>
        )}

        {/* Stats footer with raw counts */}
        <div className="pt-2 border-t space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tier1: {data?.tier1Count || 0} · Tier2: {data?.tier2Count || 0} · Regional: {data?.tier0Count || 0}</span>
            <span>{data?.total || 0} total</span>
          </div>
          <div className="text-[10px] text-muted-foreground/70">
            Target: ≥{TARGETS.tier1Min}% Tier 1, ≤{TARGETS.tier0Max}% Regional
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
