import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Twitter, ImageIcon, CheckCircle, Clock, XCircle, PlayCircle } from "lucide-react";

export function XAnalyticsCard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["x-analytics"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // Get all X posts for analysis
      const { data: allXPosts, error } = await supabase
        .from("post_queue")
        .select("id, status, sent_at, image_url, generated_image_url, metadata, created_at")
        .eq("platform", "x")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const posts = allXPosts || [];
      
      // Count by status
      const sent = posts.filter(p => p.status === "sent");
      const sentToday = sent.filter(p => p.sent_at && new Date(p.sent_at) >= today);
      const pending = posts.filter(p => p.status === "pending");
      const failed = posts.filter(p => p.status === "failed");
      const simulated = posts.filter(p => p.status === "simulated");
      const blocked = posts.filter(p => p.status === "blocked");

      // Count posts with images
      const sentWithImages = sent.filter(p => {
        const meta = p.metadata as any;
        return meta?.has_image === true;
      });

      return {
        sentToday: sentToday.length,
        sentLast7Days: sent.length,
        pending: pending.length,
        failed: failed.length,
        simulated: simulated.length,
        blocked: blocked.length,
        withImages: sentWithImages.length,
        imagePercent: sent.length > 0 
          ? Math.round((sentWithImages.length / sent.length) * 100) 
          : 0,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            X Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Twitter className="h-4 w-4" />
          X Analytics (7 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Today's posts */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Posts Today</span>
          <Badge variant="default">{stats?.sentToday || 0} / 5</Badge>
        </div>

        {/* Last 7 days */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last 7 Days</span>
          <span className="text-sm font-medium">{stats?.sentLast7Days || 0} sent</span>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-xs text-muted-foreground">Sent</span>
            <span className="text-xs font-medium ml-auto">{stats?.sentLast7Days || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-xs text-muted-foreground">Pending</span>
            <span className="text-xs font-medium ml-auto">{stats?.pending || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 text-destructive" />
            <span className="text-xs text-muted-foreground">Failed</span>
            <span className="text-xs font-medium ml-auto">{stats?.failed || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PlayCircle className="h-3 w-3 text-blue-500" />
            <span className="text-xs text-muted-foreground">Simulated</span>
            <span className="text-xs font-medium ml-auto">{stats?.simulated || 0}</span>
          </div>
        </div>

        {/* Image stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">With Images</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {stats?.imagePercent || 0}% ({stats?.withImages || 0}/{stats?.sentLast7Days || 0})
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
