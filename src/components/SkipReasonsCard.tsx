import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { XCircle, AlertTriangle } from "lucide-react";
import { subHours, subDays } from "date-fns";

// Friendly labels for skip reasons
const SKIP_REASON_LABELS: Record<string, { label: string; color: string }> = {
  duplicate_url: { label: "Duplicate URL", color: "bg-blue-100 text-blue-800" },
  duplicate_title: { label: "Duplicate Title", color: "bg-blue-100 text-blue-800" },
  duplicate_event: { label: "Duplicate Event", color: "bg-blue-100 text-blue-800" },
  duplicate_source_date: { label: "Same Title+Date", color: "bg-blue-100 text-blue-800" },
  junk_url: { label: "Junk URL", color: "bg-orange-100 text-orange-800" },
  blocked_title: { label: "Blocked Title", color: "bg-orange-100 text-orange-800" },
  nonlocal_destination: { label: "Non-Local City", color: "bg-purple-100 text-purple-800" },
  regional_nonlocal: { label: "Regional Non-Local", color: "bg-purple-100 text-purple-800" },
  stale_content: { label: "Stale (>14d)", color: "bg-gray-100 text-gray-800" },
  invalid_url: { label: "Invalid URL", color: "bg-red-100 text-red-800" },
  missing_fields: { label: "Missing Fields", color: "bg-red-100 text-red-800" },
  daily_event_cap_reached: { label: "Event Cap Hit", color: "bg-amber-100 text-amber-800" },
  ai_failed: { label: "AI Failed", color: "bg-red-100 text-red-800" },
};

interface SkipData {
  by24h: Record<string, number>;
  by7d: Record<string, number>;
  topSkippedSources: Array<{ name: string; count: number }>;
  total24h: number;
  total7d: number;
}

export const SkipReasonsCard = () => {
  const { data: skipData, isLoading } = useQuery({
    queryKey: ["skip-reasons"],
    queryFn: async (): Promise<SkipData> => {
      const now = new Date();
      const twentyFourHoursAgo = subHours(now, 24).toISOString();
      const sevenDaysAgo = subDays(now, 7).toISOString();

      // Query skips from last 24h
      const { data: skips24h, error: err24h } = await supabase
        .from("sync_skips")
        .select("reason, source_name")
        .gte("created_at", twentyFourHoursAgo);

      if (err24h) {
        console.error("Error fetching 24h skips:", err24h);
      }

      // Query skips from last 7d
      const { data: skips7d, error: err7d } = await supabase
        .from("sync_skips")
        .select("reason")
        .gte("created_at", sevenDaysAgo);

      if (err7d) {
        console.error("Error fetching 7d skips:", err7d);
      }

      // Aggregate by reason (24h)
      const by24h: Record<string, number> = {};
      (skips24h || []).forEach((s: { reason: string }) => {
        by24h[s.reason] = (by24h[s.reason] || 0) + 1;
      });

      // Aggregate by reason (7d)
      const by7d: Record<string, number> = {};
      (skips7d || []).forEach((s: { reason: string }) => {
        by7d[s.reason] = (by7d[s.reason] || 0) + 1;
      });

      // Top skipped sources (24h)
      const sourceSkipCounts: Record<string, number> = {};
      (skips24h || []).forEach((s: { source_name: string | null }) => {
        const name = s.source_name || "Unknown";
        sourceSkipCounts[name] = (sourceSkipCounts[name] || 0) + 1;
      });

      const topSkippedSources = Object.entries(sourceSkipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        by24h,
        by7d,
        topSkippedSources,
        total24h: skips24h?.length || 0,
        total7d: skips7d?.length || 0,
      };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading || !skipData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            Skip Reasons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedReasons24h = Object.entries(skipData.by24h).sort((a, b) => b[1] - a[1]);
  const hasSkips = sortedReasons24h.length > 0;

  // Determine if duplicates dominate (diagnostic insight)
  const duplicateCount = (skipData.by24h.duplicate_url || 0) + 
                         (skipData.by24h.duplicate_title || 0) + 
                         (skipData.by24h.duplicate_event || 0) +
                         (skipData.by24h.duplicate_source_date || 0);
  const nonlocalCount = (skipData.by24h.nonlocal_destination || 0) + 
                        (skipData.by24h.regional_nonlocal || 0);
  const junkCount = (skipData.by24h.junk_url || 0) + (skipData.by24h.blocked_title || 0);

  let dominantIssue = "";
  if (skipData.total24h > 0) {
    const duplicatePct = (duplicateCount / skipData.total24h) * 100;
    const nonlocalPct = (nonlocalCount / skipData.total24h) * 100;
    const junkPct = (junkCount / skipData.total24h) * 100;

    if (duplicatePct > 50) {
      dominantIssue = "Dedupe working - sources overlap";
    } else if (nonlocalPct > 40) {
      dominantIssue = "Geo-filters aggressive or sources noisy";
    } else if (junkPct > 40) {
      dominantIssue = "Scrapers hitting junk pages";
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Skip Reasons (24h) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            Skip Reasons (24h)
          </CardTitle>
          <CardDescription>
            {skipData.total24h} items filtered • {skipData.total7d} in 7d
            {dominantIssue && (
              <span className="block mt-1 text-xs font-medium text-amber-600">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {dominantIssue}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {!hasSkips ? (
              <div className="text-center text-muted-foreground py-8">
                No skips recorded yet
              </div>
            ) : (
              <div className="space-y-2">
                {sortedReasons24h.map(([reason, count]) => {
                  const info = SKIP_REASON_LABELS[reason] || { label: reason, color: "bg-gray-100 text-gray-800" };
                  const pct = Math.round((count / skipData.total24h) * 100);
                  return (
                    <div key={reason} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${info.color}`}>
                          {info.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-sm font-semibold w-10 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Noisiest Sources (24h) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Noisiest Sources (24h)
          </CardTitle>
          <CardDescription>
            Sources producing most filtered content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {skipData.topSkippedSources.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No data yet
              </div>
            ) : (
              <div className="space-y-2">
                {skipData.topSkippedSources.map((source, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[180px]">{source.name}</span>
                    <Badge variant="secondary">{source.count} skipped</Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
