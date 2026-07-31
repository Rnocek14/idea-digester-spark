import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Mail, Share2, FileText, AlertTriangle, Power, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface AutomationSettings {
  enabled: boolean;
  newsletter_enabled: boolean;
  social_enabled: boolean;
  publish_enabled: boolean;
  x_enabled?: boolean;
  facebook_enabled?: boolean;
  instagram_enabled?: boolean;
}

export function SystemHealthCard() {
  const queryClient = useQueryClient();

  // Fetch automation settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'automation')
        .single();
      if (error) throw error;
      return data?.value as unknown as AutomationSettings;
    },
    staleTime: 10000,
  });

  // Fetch health metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-health-metrics'],
    queryFn: async () => {
      const [
        lastIngest,
        lastAutoPublish,
        pendingSensitive,
        lastNewsletter,
        socialPending,
        newestLiveStory
      ] = await Promise.all([
        supabase
          .from('content_queue')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('content_queue')
          .select('updated_at')
          .eq('status', 'auto_published')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('content_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('safety_level', 'sensitive'),
        supabase
          .from('newsletters')
          .select('sent_at')
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('post_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        // Same status + safety filters the public feed applies — "Last Ingest"
        // can look healthy while everything lands in pending and the site
        // itself goes stale. This metric watches what readers actually see.
        supabase
          .from('content_queue')
          .select('created_at')
          .in('status', ['published', 'auto_published'])
          .in('safety_level', ['safe', 'soft_sensitive'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      ]);

      return {
        lastIngestAt: lastIngest.data?.created_at,
        lastAutoPublishAt: lastAutoPublish.data?.updated_at,
        pendingSensitiveCount: pendingSensitive.count || 0,
        lastNewsletterSentAt: lastNewsletter.data?.sent_at,
        socialPendingCount: socialPending.count || 0,
        newestLiveStoryAt: newestLiveStory.data?.created_at,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Toggle automation mutation
  const toggleMutation = useMutation({
    mutationFn: async (newSettings: AutomationSettings) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: newSettings as unknown as Json, updated_at: new Date().toISOString() })
        .eq('key', 'automation');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Automation settings updated');
    },
    onError: () => {
      toast.error('Failed to update settings');
    }
  });

  const handleToggle = (key: keyof AutomationSettings) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    toggleMutation.mutate(newSettings);
  };

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const STALE_LIVE_STORY_HOURS = 24;
  const liveStoryStale = !metrics?.newestLiveStoryAt ||
    Date.now() - new Date(metrics.newestLiveStoryAt).getTime() > STALE_LIVE_STORY_HOURS * 60 * 60 * 1000;

  const isLoading = settingsLoading || metricsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Kill Switch Section */}
        <div className="space-y-3 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Master Automation</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={settings?.enabled ? "default" : "destructive"}>
                {settings?.enabled ? "ON" : "OFF"}
              </Badge>
              <Switch
                checked={settings?.enabled || false}
                onCheckedChange={() => handleToggle('enabled')}
              />
            </div>
          </div>
          
          {settings?.enabled && (
            <div className="pl-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Publishing</span>
                <Switch
                  checked={settings?.publish_enabled || false}
                  onCheckedChange={() => handleToggle('publish_enabled')}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Newsletter</span>
                <Switch
                  checked={settings?.newsletter_enabled || false}
                  onCheckedChange={() => handleToggle('newsletter_enabled')}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Social</span>
                <Switch
                  checked={settings?.social_enabled || false}
                  onCheckedChange={() => handleToggle('social_enabled')}
                />
              </div>
              
              {/* Per-platform toggles under Social */}
              {settings?.social_enabled && (
                <div className="pl-4 pt-2 space-y-2 border-l border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">X (Twitter)</span>
                    <Switch
                      checked={settings?.x_enabled !== false}
                      onCheckedChange={() => handleToggle('x_enabled')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Facebook</span>
                    <Switch
                      checked={settings?.facebook_enabled !== false}
                      onCheckedChange={() => handleToggle('facebook_enabled')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Instagram</span>
                    <Switch
                      checked={settings?.instagram_enabled !== false}
                      onCheckedChange={() => handleToggle('instagram_enabled')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Health Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Last Ingest</span>
            </div>
            <span className="text-muted-foreground">{formatTime(metrics?.lastIngestAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>Last Auto-Publish</span>
            </div>
            <span className="text-muted-foreground">{formatTime(metrics?.lastAutoPublishAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Newspaper className={`h-4 w-4 ${liveStoryStale ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span>Newest Live Story</span>
            </div>
            {liveStoryStale ? (
              <Badge variant="destructive">{formatTime(metrics?.newestLiveStoryAt)}</Badge>
            ) : (
              <span className="text-muted-foreground">{formatTime(metrics?.newestLiveStoryAt)}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Last Newsletter</span>
            </div>
            <span className="text-muted-foreground">{formatTime(metrics?.lastNewsletterSentAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span>Social Queue</span>
            </div>
            <Badge variant="secondary">{metrics?.socialPendingCount || 0} pending</Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Needs Review</span>
            </div>
            <Badge variant={metrics?.pendingSensitiveCount ? "destructive" : "secondary"}>
              {metrics?.pendingSensitiveCount || 0} sensitive
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
