import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Radio, Megaphone, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivityFeed } from "@/components/ActivityFeed";

const Dashboard = () => {
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
  });

  const { data: activeSourcesCount = 0 } = useQuery({
    queryKey: ["dashboard-sources-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  const { data: activeSponsorsCount = 0 } = useQuery({
    queryKey: ["dashboard-sponsors-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sponsors")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  const { data: publishedTodayCount = 0 } = useQuery({
    queryKey: ["dashboard-published-today-count"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .gte("publish_date", today)
        .lt("publish_date", `${today}T23:59:59.999Z`);
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Autonomous Local Media Network control center
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Content</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Articles awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSourcesCount}</div>
            <p className="text-xs text-muted-foreground">Content sources monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sponsors</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSponsorsCount}</div>
            <p className="text-xs text-muted-foreground">Business partnerships</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published Today</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedTodayCount}</div>
            <p className="text-xs text-muted-foreground">Articles published</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Set Up Content Sources</h3>
            <p className="text-sm text-muted-foreground">
              Add RSS feeds, APIs, or web scraping sources to begin ingesting content
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Configure External Automation</h3>
            <p className="text-sm text-muted-foreground">
              Connect your n8n or Make workflows to populate the content queue
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Add Sponsors</h3>
            <p className="text-sm text-muted-foreground">
              Manage local business sponsors and their advertising campaigns
            </p>
          </div>
        </CardContent>
      </Card>

      <ActivityFeed />
    </div>
  );
};

export default Dashboard;