import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Radio, Megaphone, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PipelineHealthCard } from "@/components/PipelineHealthCard";
import { IncidentHealthCard } from "@/components/IncidentHealthCard";
const Dashboard = () => {
  const { data: pendingCount = 0, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["dashboard-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: activeSourcesCount = 0, isLoading: sourcesLoading, refetch: refetchSources } = useQuery({
    queryKey: ["dashboard-sources-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: activeSponsorsCount = 0, isLoading: sponsorsLoading, refetch: refetchSponsors } = useQuery({
    queryKey: ["dashboard-sponsors-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sponsors")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: publishedTodayCount = 0, isLoading: publishedLoading, refetch: refetchPublished } = useQuery({
    queryKey: ["dashboard-published-today-count"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("content_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .gte("publish_date", today)
        .lt("publish_date", `${today}T23:59:59.999Z`);
      if (error) throw error;
      return count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const isLoading = pendingLoading || sourcesLoading || sponsorsLoading || publishedLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground">Loading dashboard...</p>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            refetchPending();
            refetchSources();
            refetchSponsors();
            refetchPublished();
          }}
        >
          Taking too long? Click to retry
        </Button>
      </div>
    );
  }

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

      <div className="grid gap-6 md:grid-cols-2">
        <PipelineHealthCard />
        <IncidentHealthCard />
      </div>

      <ActivityFeed />
    </div>
  );
};

export default Dashboard;