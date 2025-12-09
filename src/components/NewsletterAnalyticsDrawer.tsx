import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, MousePointerClick, TrendingUp, Users, Eye, Percent } from "lucide-react";
import { format } from "date-fns";

interface NewsletterAnalyticsDrawerProps {
  newsletter: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewsletterAnalyticsDrawer({ newsletter, open, onOpenChange }: NewsletterAnalyticsDrawerProps) {
  // Fetch analytics for this specific newsletter
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["newsletter-analytics", newsletter?.id],
    queryFn: async () => {
      if (!newsletter?.id) return null;

      // Fetch total subscribers count at time of send
      const { data: subscribersData } = await supabase
        .from("subscribers")
        .select("id", { count: "exact" })
        .eq("status", "active");

      const totalSubscribers = subscribersData?.length || 0;

      // Fetch opens with subscriber emails
      const { data: opens, error: opensError } = await supabase
        .from("newsletter_opens")
        .select("*, subscribers(email)")
        .eq("newsletter_id", newsletter.id)
        .order("opened_at", { ascending: false });

      if (opensError) throw opensError;

      // Fetch clicks with subscriber emails
      const { data: clicks, error: clicksError } = await supabase
        .from("newsletter_clicks")
        .select("*, subscribers(email)")
        .eq("newsletter_id", newsletter.id)
        .order("clicked_at", { ascending: false });

      if (clicksError) throw clicksError;

      // Calculate unique opens and clicks
      const uniqueOpens = new Set(opens?.map(o => o.subscriber_id || o.subscriber_email)).size;
      const uniqueClicks = new Set(clicks?.map(c => c.subscriber_id || c.subscriber_email)).size;

      // Calculate rates
      const openRate = totalSubscribers > 0 ? (uniqueOpens / totalSubscribers) * 100 : 0;
      const clickRate = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) * 100 : 0;
      const clickToOpenRate = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) * 100 : 0;

      // Group clicks by URL
      const clicksByUrl: Record<string, number> = {};
      clicks?.forEach(click => {
        clicksByUrl[click.link_url] = (clicksByUrl[click.link_url] || 0) + 1;
      });

      const topLinks = Object.entries(clicksByUrl)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      return {
        totalSubscribers,
        totalOpens: opens?.length || 0,
        uniqueOpens,
        totalClicks: clicks?.length || 0,
        uniqueClicks,
        openRate,
        clickRate,
        clickToOpenRate,
        opens: opens || [],
        clicks: clicks || [],
        topLinks,
      };
    },
    enabled: !!newsletter?.id && open,
  });

  // Fetch aggregate trends across all newsletters
  const { data: aggregateData } = useQuery({
    queryKey: ["newsletter-aggregate-analytics"],
    queryFn: async () => {
      // Fetch all sent newsletters
      const { data: newsletters } = await supabase
        .from("newsletters")
        .select("id, edition_date, story_count")
        .eq("status", "sent")
        .order("edition_date", { ascending: true });

      if (!newsletters?.length) return null;

      // Fetch all opens and clicks
      const { data: allOpens } = await supabase
        .from("newsletter_opens")
        .select("newsletter_id, subscriber_id, subscriber_email, opened_at");

      const { data: allClicks } = await supabase
        .from("newsletter_clicks")
        .select("newsletter_id, subscriber_id, subscriber_email, clicked_at");

      // Calculate average metrics per newsletter
      const newsletterMetrics = newsletters.map(nl => {
        const nlOpens = allOpens?.filter(o => o.newsletter_id === nl.id) || [];
        const nlClicks = allClicks?.filter(c => c.newsletter_id === nl.id) || [];
        
        const uniqueOpens = new Set(nlOpens.map(o => o.subscriber_id || o.subscriber_email)).size;
        const uniqueClicks = new Set(nlClicks.map(c => c.subscriber_id || c.subscriber_email)).size;

        return {
          date: nl.edition_date,
          opens: uniqueOpens,
          clicks: uniqueClicks,
        };
      });

      // Calculate averages
      const avgOpens = newsletterMetrics.reduce((sum, m) => sum + m.opens, 0) / newsletterMetrics.length;
      const avgClicks = newsletterMetrics.reduce((sum, m) => sum + m.clicks, 0) / newsletterMetrics.length;
      const avgOpenRate = avgOpens > 0 ? (avgOpens / 100) * 100 : 0; // Placeholder calculation
      const avgClickRate = avgClicks > 0 ? (avgClicks / avgOpens) * 100 : 0;

      // Subscriber growth (mock for now - would track over time)
      const totalSubs = allOpens ? new Set(allOpens.map(o => o.subscriber_id || o.subscriber_email)).size : 0;

      return {
        totalNewslettersSent: newsletters.length,
        avgOpenRate,
        avgClickRate,
        totalSubscribers: totalSubs,
        newsletterMetrics,
      };
    },
    enabled: open,
  });

  if (!newsletter) {
    return null;
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Newsletter Analytics</DrawerTitle>
          <DrawerDescription>
            {newsletter.subject} • {format(new Date(newsletter.edition_date), "MMM d, yyyy")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {isLoading ? (
                <p className="text-muted-foreground">Loading analytics...</p>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Sent To</p>
                      </div>
                      <p className="text-2xl font-bold">{analytics.totalSubscribers}</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Opens</p>
                      </div>
                      <p className="text-2xl font-bold">{analytics.uniqueOpens}</p>
                      <p className="text-xs text-muted-foreground">{analytics.totalOpens} total</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clicks</p>
                      </div>
                      <p className="text-2xl font-bold">{analytics.uniqueClicks}</p>
                      <p className="text-xs text-muted-foreground">{analytics.totalClicks} total</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Open Rate</p>
                      </div>
                      <p className="text-2xl font-bold">{analytics.openRate.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        CTR: {analytics.clickRate.toFixed(1)}%
                      </p>
                    </Card>
                  </div>

                  {analytics.topLinks.length > 0 && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Top Clicked Links</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>URL</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.topLinks.map(([url, count], idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs max-w-md truncate">
                                {url}
                              </TableCell>
                              <TableCell className="text-right font-medium">{count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No analytics data available yet.</p>
              )}
            </TabsContent>

            <TabsContent value="engagement" className="space-y-4 mt-4">
              {isLoading ? (
                <p className="text-muted-foreground">Loading engagement data...</p>
              ) : analytics ? (
                <div className="grid gap-4">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Recent Opens</h3>
                    {analytics.opens.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {analytics.opens.slice(0, 20).map((open: any) => (
                          <div key={open.id} className="flex justify-between items-center text-sm border-b pb-2">
                            <span className="font-medium truncate max-w-xs">
                              {open.subscribers?.email || open.subscriber_email || "Anonymous"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(open.opened_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No opens yet</p>
                    )}
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Recent Clicks</h3>
                    {analytics.clicks.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {analytics.clicks.slice(0, 20).map((click: any) => (
                          <div key={click.id} className="border-b pb-2">
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span className="font-medium truncate max-w-xs">
                                {click.subscribers?.email || click.subscriber_email || "Anonymous"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(click.clicked_at), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-xs font-mono truncate text-muted-foreground">
                              {click.link_url}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No clicks yet</p>
                    )}
                  </Card>
                </div>
              ) : (
                <p className="text-muted-foreground">No engagement data available yet.</p>
              )}
            </TabsContent>

            <TabsContent value="trends" className="space-y-4 mt-4">
              {aggregateData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Sent</p>
                      </div>
                      <p className="text-2xl font-bold">{aggregateData.totalNewslettersSent}</p>
                      <p className="text-xs text-muted-foreground">newsletters</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Subscribers</p>
                      </div>
                      <p className="text-2xl font-bold">{aggregateData.totalSubscribers}</p>
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Active
                      </p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Avg Open Rate</p>
                      </div>
                      <p className="text-2xl font-bold">{aggregateData.avgOpenRate.toFixed(1)}%</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Avg CTR</p>
                      </div>
                      <p className="text-2xl font-bold">{aggregateData.avgClickRate.toFixed(1)}%</p>
                    </Card>
                  </div>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Performance Over Time</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {aggregateData.newsletterMetrics.map((metric: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center border-b pb-2">
                          <span className="text-sm">{format(new Date(metric.date), "MMM d, yyyy")}</span>
                          <div className="flex gap-4 text-sm">
                            <Badge variant="outline">{metric.opens} opens</Badge>
                            <Badge variant="outline">{metric.clicks} clicks</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              ) : (
                <p className="text-muted-foreground">Send your first newsletter to see trends.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
