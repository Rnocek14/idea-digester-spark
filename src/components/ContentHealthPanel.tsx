import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { HeartPulse, Calendar, Mail, AlertTriangle, Shield } from "lucide-react";

export function ContentHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['content-health-panel'],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        tierDist7d,
        freshEvents24h,
        pendingSafeEvents,
        softSensitiveStats,
        recentNewsletters
      ] = await Promise.all([
        // Tier distribution last 7d
        supabase
          .from('content_queue')
          .select('geo_tier')
          .in('status', ['published', 'auto_published', 'approved'])
          .gte('created_at', sevenDaysAgo),
        // Fresh events with event_date today or future, last 24h
        supabase
          .from('content_queue')
          .select('id', { count: 'exact', head: true })
          .eq('category', 'events')
          .in('status', ['published', 'auto_published', 'approved'])
          .gte('event_date', today)
          .gte('created_at', oneDayAgo),
        // Pending safe/soft_sensitive events (should be 0)
        supabase
          .from('content_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('safety_level', ['safe', 'soft_sensitive'])
          .eq('category', 'events'),
        // Soft-sensitive breakdown by geo_tier and status (last 7d)
        supabase
          .from('content_queue')
          .select('geo_tier, status')
          .eq('safety_level', 'soft_sensitive')
          .gte('created_at', sevenDaysAgo),
        // Recent newsletters (last 7)
        supabase
          .from('newsletters')
          .select('id, status, story_count, sent_at, edition_date, metadata')
          .order('edition_date', { ascending: false })
          .limit(7)
      ]);

      // Calculate tier percentages
      const calcTierPct = (data: any[]) => {
        if (!data || data.length === 0) return { t1: 0, t2: 0, t0: 0, total: 0 };
        const total = data.length;
        const t1 = data.filter(d => d.geo_tier === 1).length;
        const t2 = data.filter(d => d.geo_tier === 2).length;
        const t0 = data.filter(d => d.geo_tier === 0).length;
        return {
          t1: Math.round((t1 / total) * 100),
          t2: Math.round((t2 / total) * 100),
          t0: Math.round((t0 / total) * 100),
          total
        };
      };

      const tiers7d = calcTierPct(tierDist7d.data || []);

      // Newsletter stats
      const newsletters = recentNewsletters.data || [];
      const sent = newsletters.filter(n => n.status === 'sent');
      const skipped = newsletters.filter(n => n.status === 'skipped');
      const zeroStory = sent.filter(n => n.story_count === 0);

      // Soft-sensitive stats
      const ssData = softSensitiveStats.data || [];
      const ssAutoPublished = ssData.filter(s => ['auto_published', 'published'].includes(s.status)).length;
      const ssHeld = ssData.filter(s => s.status === 'pending').length;
      const ssHeldT0 = ssData.filter(s => s.status === 'pending' && (s.geo_tier === 0 || s.geo_tier === null)).length;
      const ssAutoT1T2 = ssData.filter(s => ['auto_published', 'published'].includes(s.status) && (s.geo_tier ?? 0) >= 1).length;

      return {
        tiers7d,
        freshEvents24h: freshEvents24h.count || 0,
        pendingSafeEvents: pendingSafeEvents.count || 0,
        newslettersSent: sent.length,
        newslettersSkipped: skipped.length,
        zeroStorySends: zeroStory.length,
        softSensitive: {
          total: ssData.length,
          autoPublished: ssAutoPublished,
          held: ssHeld,
          heldT0: ssHeldT0,
          autoT1T2: ssAutoT1T2,
        },
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5" />
            Content Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hyperlocalPct7d = data.tiers7d.t1 + data.tiers7d.t2;
  const hyperlocalHealthy = hyperlocalPct7d >= 40;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          Content Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier Mix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Hyperlocal Mix (T1+T2)</span>
            <Badge variant={hyperlocalHealthy ? "default" : "destructive"}>
              {hyperlocalPct7d}% 7d
            </Badge>
          </div>
          <div className="flex gap-1 h-3 rounded overflow-hidden">
            <div className="bg-primary" style={{ width: `${data.tiers7d.t1}%` }} title={`Tier 1: ${data.tiers7d.t1}%`} />
            <div className="bg-primary/60" style={{ width: `${data.tiers7d.t2}%` }} title={`Tier 2: ${data.tiers7d.t2}%`} />
            <div className="bg-muted" style={{ width: `${data.tiers7d.t0}%` }} title={`Tier 0: ${data.tiers7d.t0}%`} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>T1: {data.tiers7d.t1}%</span>
            <span>T2: {data.tiers7d.t2}%</span>
            <span>T0: {data.tiers7d.t0}%</span>
            <span>{data.tiers7d.total} stories</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Fresh Events (24h)</span>
            </div>
            <Badge variant={data.freshEvents24h > 0 ? "secondary" : "destructive"}>
              {data.freshEvents24h}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span>Stuck Safe Events</span>
            </div>
            <Badge variant={data.pendingSafeEvents > 0 ? "destructive" : "secondary"}>
              {data.pendingSafeEvents}
            </Badge>
          </div>

          {/* Soft-sensitive stats */}
          {data.softSensitive.total > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Soft-Sensitive (7d)</span>
              </div>
              <div className="flex gap-1">
                <Badge variant="secondary">{data.softSensitive.autoT1T2} auto</Badge>
                <Badge variant="outline">{data.softSensitive.heldT0} held</Badge>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Newsletters (7d)</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary">{data.newslettersSent} sent</Badge>
              {data.newslettersSkipped > 0 && (
                <Badge variant="outline">{data.newslettersSkipped} skip</Badge>
              )}
            </div>
          </div>

          {data.zeroStorySends > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>0-Story Sends</span>
              </div>
              <Badge variant="destructive">{data.zeroStorySends}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
