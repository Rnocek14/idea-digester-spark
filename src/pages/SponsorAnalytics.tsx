import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingUp, MousePointerClick, Mail, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";

type SponsorStats = {
  business_id: string;
  business_name: string;
  logo_url: string | null;
  active_placements: number;
  newsletter_appearances: number;
  total_opens: number;
  total_clicks: number;
  web_clicks: number;
  directory_clicks: number;
  ctr_percent: number;
};

const SponsorAnalytics = () => {
  const { data: sponsorStats = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sponsor-analytics"],
    queryFn: async () => {
      // Get all businesses with active or recent placements
      const { data: businesses, error: businessError } = await supabase
        .from("business_profiles")
        .select("id, name, logo_url, status")
        .eq("status", "active");

      if (businessError) throw businessError;

      const stats: SponsorStats[] = [];

      for (const business of businesses || []) {
        // Get active placements
        const today = new Date().toISOString().split("T")[0];
        const { data: activePlacements } = await supabase
          .from("ad_placements")
          .select("id")
          .eq("business_id", business.id)
          .eq("status", "active")
          .lte("start_date", today)
          .gte("end_date", today);

        // Get all clicks for this business
        const { data: clicks } = await supabase
          .from("newsletter_clicks")
          .select("click_source, newsletter_id")
          .eq("business_id", business.id);

        // Get newsletter appearances (unique newsletters with this sponsor)
        const newsletterIds = [...new Set(clicks?.map((c) => c.newsletter_id).filter(Boolean) || [])];

        // Get opens for newsletters this sponsor appeared in
        let totalOpens = 0;
        if (newsletterIds.length > 0) {
          const { data: opens } = await supabase
            .from("newsletter_opens")
            .select("id")
            .in("newsletter_id", newsletterIds);
          totalOpens = opens?.length || 0;
        }

        // Calculate click breakdown
        const newsletterClicks = clicks?.filter((c) => c.click_source === "newsletter_sponsor" || !c.click_source).length || 0;
        const webClicks = clicks?.filter((c) => c.click_source === "web_brief").length || 0;
        const directoryClicks = clicks?.filter((c) => c.click_source === "directory").length || 0;
        const totalClicks = clicks?.length || 0;

        // Calculate CTR
        const ctr = totalOpens > 0 ? (newsletterClicks / totalOpens) * 100 : 0;

        stats.push({
          business_id: business.id,
          business_name: business.name,
          logo_url: business.logo_url,
          active_placements: activePlacements?.length || 0,
          newsletter_appearances: newsletterIds.length,
          total_opens: totalOpens,
          total_clicks: totalClicks,
          web_clicks: webClicks,
          directory_clicks: directoryClicks,
          ctr_percent: Math.round(ctr * 10) / 10,
        });
      }

      // Sort by total clicks descending
      return stats.filter(s => s.active_placements > 0 || s.total_clicks > 0).sort((a, b) => b.total_clicks - a.total_clicks);
    },
    staleTime: 30000, // 30 seconds
  });

  // Calculate totals
  const totals = sponsorStats.reduce(
    (acc, stat) => ({
      appearances: acc.appearances + stat.newsletter_appearances,
      opens: acc.opens + stat.total_opens,
      clicks: acc.clicks + stat.total_clicks,
    }),
    { appearances: 0, opens: 0, clicks: 0 }
  );

  const avgCtr = totals.opens > 0 ? (totals.clicks / totals.opens) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sponsor Analytics</h1>
          <p className="text-muted-foreground">Track sponsor performance across all channels</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Appearances</p>
              <p className="text-2xl font-bold">{totals.appearances}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Eye className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Opens</p>
              <p className="text-2xl font-bold">{totals.opens.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <MousePointerClick className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Clicks</p>
              <p className="text-2xl font-bold">{totals.clicks}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Avg CTR</p>
              <p className="text-2xl font-bold">{avgCtr.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-8 text-center">
          <p className="text-destructive mb-4">Failed to load analytics</p>
          <button onClick={() => refetch()} className="text-primary hover:underline">
            Try again
          </button>
        </Card>
      )}

      {/* Sponsor Stats Table */}
      {!isLoading && !error && (
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Sponsor Performance</h2>
            {sponsorStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sponsor data yet</p>
                <p className="text-sm mt-2">Analytics will appear once sponsors have active placements</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sponsor</TableHead>
                    <TableHead className="text-center">Active Placements</TableHead>
                    <TableHead className="text-center">Newsletter Appearances</TableHead>
                    <TableHead className="text-center">Opens</TableHead>
                    <TableHead className="text-center">Newsletter Clicks</TableHead>
                    <TableHead className="text-center">Web Clicks</TableHead>
                    <TableHead className="text-center">Directory Clicks</TableHead>
                    <TableHead className="text-center">Total Clicks</TableHead>
                    <TableHead className="text-center">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsorStats.map((stat) => (
                    <TableRow key={stat.business_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {stat.logo_url && (
                            <img
                              src={stat.logo_url}
                              alt={stat.business_name}
                              className="h-8 w-8 object-contain rounded"
                            />
                          )}
                          <span className="font-medium">{stat.business_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={stat.active_placements > 0 ? "default" : "secondary"}>
                          {stat.active_placements}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{stat.newsletter_appearances}</TableCell>
                      <TableCell className="text-center">{stat.total_opens.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        {stat.total_clicks - stat.web_clicks - stat.directory_clicks}
                      </TableCell>
                      <TableCell className="text-center">{stat.web_clicks}</TableCell>
                      <TableCell className="text-center">{stat.directory_clicks}</TableCell>
                      <TableCell className="text-center font-semibold">{stat.total_clicks}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={stat.ctr_percent >= 2 ? "default" : "secondary"}
                          className={
                            stat.ctr_percent >= 2
                              ? "bg-green-500/10 text-green-700"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {stat.ctr_percent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SponsorAnalytics;
