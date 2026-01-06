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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, MousePointerClick, Mail, Eye, Calendar, Package, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

// Package definitions with metadata for ROI calculations
const AD_PACKAGES: Record<string, { name: string; price: number; category: string }> = {
  newsletter_1mo: { name: "Newsletter Banner - 1 Month", price: 299, category: "Newsletter" },
  newsletter_3mo: { name: "Newsletter Banner - 3 Months", price: 799, category: "Newsletter" },
  sidebar_1mo: { name: "Website Sidebar - 1 Month", price: 299, category: "Website" },
  sidebar_3mo: { name: "Website Sidebar - 3 Months", price: 699, category: "Website" },
  social_post: { name: "Social Media Post", price: 199, category: "Social" },
  premium_1mo: { name: "Premium Bundle - 1 Month", price: 1499, category: "Premium" },
  premium_3mo: { name: "Premium Bundle - 3 Months", price: 3999, category: "Premium" },
};

const CHART_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

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

type PackageStats = {
  package_type: string;
  package_name: string;
  category: string;
  placements_count: number;
  total_clicks: number;
  total_impressions: number;
  total_revenue: number;
  avg_ctr: number;
  cost_per_click: number;
};

const SponsorAnalytics = () => {
  // Existing sponsor stats query
  const { data: sponsorStats = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sponsor-analytics"],
    queryFn: async () => {
      const { data: businesses, error: businessError } = await supabase
        .from("business_profiles")
        .select("id, name, logo_url, status")
        .eq("status", "active");

      if (businessError) throw businessError;

      const stats: SponsorStats[] = [];

      for (const business of businesses || []) {
        const today = new Date().toISOString().split("T")[0];
        const { data: activePlacements } = await supabase
          .from("ad_placements")
          .select("id")
          .eq("business_id", business.id)
          .eq("status", "active")
          .lte("start_date", today)
          .gte("end_date", today);

        const { data: clicks } = await supabase
          .from("newsletter_clicks")
          .select("click_source, newsletter_id")
          .eq("business_id", business.id);

        const newsletterIds = [...new Set(clicks?.map((c) => c.newsletter_id).filter(Boolean) || [])];

        let totalOpens = 0;
        if (newsletterIds.length > 0) {
          const { data: opens } = await supabase
            .from("newsletter_opens")
            .select("id")
            .in("newsletter_id", newsletterIds);
          totalOpens = opens?.length || 0;
        }

        const newsletterClicks = clicks?.filter((c) => c.click_source === "newsletter_sponsor" || !c.click_source).length || 0;
        const webClicks = clicks?.filter((c) => c.click_source === "web_brief").length || 0;
        const directoryClicks = clicks?.filter((c) => c.click_source === "directory").length || 0;
        const totalClicks = clicks?.length || 0;

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

      return stats.filter(s => s.active_placements > 0 || s.total_clicks > 0).sort((a, b) => b.total_clicks - a.total_clicks);
    },
    staleTime: 30000,
  });

  // Package-specific analytics query
  const { data: packageStats = [], isLoading: packageLoading } = useQuery({
    queryKey: ["package-analytics"],
    queryFn: async () => {
      // Get all placements with package_type
      const { data: placements, error: placementError } = await supabase
        .from("ad_placements")
        .select("id, package_type, business_id, status, start_date, end_date");

      if (placementError) throw placementError;

      // Get all newsletter clicks with placement info
      const { data: clicks, error: clickError } = await supabase
        .from("newsletter_clicks")
        .select("id, ad_placement_id, newsletter_id");

      if (clickError) throw clickError;

      // Get newsletter opens for impression calculation
      const { data: allOpens } = await supabase
        .from("newsletter_opens")
        .select("id, newsletter_id");

      // Group placements by package_type
      const packageMap = new Map<string, PackageStats>();

      for (const placement of placements || []) {
        const packageType = placement.package_type || "unknown";
        const packageInfo = AD_PACKAGES[packageType] || { name: packageType, price: 0, category: "Other" };
        
        if (!packageMap.has(packageType)) {
          packageMap.set(packageType, {
            package_type: packageType,
            package_name: packageInfo.name,
            category: packageInfo.category,
            placements_count: 0,
            total_clicks: 0,
            total_impressions: 0,
            total_revenue: 0,
            avg_ctr: 0,
            cost_per_click: 0,
          });
        }

        const stats = packageMap.get(packageType)!;
        stats.placements_count += 1;
        stats.total_revenue += packageInfo.price;

        // Count clicks for this placement
        const placementClicks = clicks?.filter(c => c.ad_placement_id === placement.id).length || 0;
        stats.total_clicks += placementClicks;

        // Count impressions (newsletter opens during placement period)
        const placementNewsletterIds = [...new Set(
          clicks?.filter(c => c.ad_placement_id === placement.id).map(c => c.newsletter_id).filter(Boolean) || []
        )];
        const placementImpressions = allOpens?.filter(o => placementNewsletterIds.includes(o.newsletter_id)).length || 0;
        stats.total_impressions += placementImpressions;
      }

      // Calculate CTR and CPC for each package
      const results: PackageStats[] = [];
      packageMap.forEach((stats) => {
        stats.avg_ctr = stats.total_impressions > 0 ? (stats.total_clicks / stats.total_impressions) * 100 : 0;
        stats.cost_per_click = stats.total_clicks > 0 ? stats.total_revenue / stats.total_clicks : 0;
        if (stats.package_type !== "unknown" || stats.placements_count > 0) {
          results.push(stats);
        }
      });

      return results.sort((a, b) => b.total_clicks - a.total_clicks);
    },
    staleTime: 30000,
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

  // Package totals
  const packageTotals = packageStats.reduce(
    (acc, pkg) => ({
      revenue: acc.revenue + pkg.total_revenue,
      clicks: acc.clicks + pkg.total_clicks,
      placements: acc.placements + pkg.placements_count,
    }),
    { revenue: 0, clicks: 0, placements: 0 }
  );

  // Chart data
  const clicksByPackageData = packageStats.map((pkg, idx) => ({
    name: pkg.package_name.split(" - ")[0],
    clicks: pkg.total_clicks,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  const revenueByCategory = packageStats.reduce((acc, pkg) => {
    const existing = acc.find(a => a.category === pkg.category);
    if (existing) {
      existing.revenue += pkg.total_revenue;
      existing.clicks += pkg.total_clicks;
    } else {
      acc.push({ category: pkg.category, revenue: pkg.total_revenue, clicks: pkg.total_clicks });
    }
    return acc;
  }, [] as { category: string; revenue: number; clicks: number }[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sponsor Analytics</h1>
          <p className="text-muted-foreground">Track sponsor performance across all channels and packages</p>
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

      <Tabs defaultValue="sponsors" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sponsors">By Sponsor</TabsTrigger>
          <TabsTrigger value="packages">By Package</TabsTrigger>
        </TabsList>

        <TabsContent value="sponsors" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="packages" className="space-y-6">
          {/* Package Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Placements</p>
                  <p className="text-2xl font-bold">{packageTotals.placements}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${packageTotals.revenue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Package Clicks</p>
                  <p className="text-2xl font-bold">{packageTotals.clicks}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Cost/Click</p>
                  <p className="text-2xl font-bold">
                    ${packageTotals.clicks > 0 ? (packageTotals.revenue / packageTotals.clicks).toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Clicks by Package Type</h3>
              {clicksByPackageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={clicksByPackageData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="clicks"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {clicksByPackageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} clicks`, "Clicks"]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No package data yet
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue & Clicks by Category</h3>
              {revenueByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueByCategory}>
                    <XAxis dataKey="category" />
                    <YAxis yAxisId="left" orientation="left" stroke="#16a34a" />
                    <YAxis yAxisId="right" orientation="right" stroke="#2563eb" />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === "revenue" ? `$${value}` : value,
                        name === "revenue" ? "Revenue" : "Clicks"
                      ]} 
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="#16a34a" name="Revenue ($)" />
                    <Bar yAxisId="right" dataKey="clicks" fill="#2563eb" name="Clicks" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No category data yet
                </div>
              )}
            </Card>
          </div>

          {/* Package Performance Table */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Package Performance & ROI</h2>
              {packageLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading package analytics...</div>
              ) : packageStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No package data yet</p>
                  <p className="text-sm mt-2">Analytics will appear once sponsors purchase packages</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Placements</TableHead>
                      <TableHead className="text-center">Revenue</TableHead>
                      <TableHead className="text-center">Impressions</TableHead>
                      <TableHead className="text-center">Clicks</TableHead>
                      <TableHead className="text-center">CTR</TableHead>
                      <TableHead className="text-center">Cost/Click</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packageStats.map((pkg) => (
                      <TableRow key={pkg.package_type}>
                        <TableCell className="font-medium">{pkg.package_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pkg.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{pkg.placements_count}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">
                          ${pkg.total_revenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">{pkg.total_impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-center">{pkg.total_clicks}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={pkg.avg_ctr >= 2 ? "default" : "secondary"}
                            className={
                              pkg.avg_ctr >= 2
                                ? "bg-green-500/10 text-green-700"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {pkg.avg_ctr.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={pkg.cost_per_click < 10 ? "text-green-600" : pkg.cost_per_click < 25 ? "text-yellow-600" : "text-red-600"}>
                            ${pkg.cost_per_click.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SponsorAnalytics;
