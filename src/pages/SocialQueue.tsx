import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, Clock, Instagram, Facebook, Twitter, RefreshCw, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const SocialQueue = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Fetch upcoming posts
  const { data: upcomingPosts, isLoading: upcomingLoading } = useQuery({
    queryKey: ["post-queue", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_queue")
        .select("*, content_queue(title, category)")
        .in("status", ["pending", "queued"])
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch sent/simulated posts
  const { data: sentPosts, isLoading: sentLoading } = useQuery({
    queryKey: ["post-queue", "sent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_queue")
        .select("*, content_queue(title, category)")
        .in("status", ["sent", "simulated", "failed"])
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Prepare posts mutation
  const prepareMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("prepare-posts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      toast.success(`Prepared ${data.prepared} posts for social media`);
    },
    onError: (error: any) => {
      toast.error(`Failed to prepare posts: ${error.message}`);
    },
  });

  // Process queue mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-post-queue");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      toast.success(`${data.mode}: ${data.processed} posts processed`);
    },
    onError: (error: any) => {
      toast.error(`Failed to process queue: ${error.message}`);
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return <Instagram className="h-4 w-4" />;
      case "facebook":
        return <Facebook className="h-4 w-4" />;
      case "x":
        return <Twitter className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "default",
      queued: "secondary",
      sent: "default",
      simulated: "outline",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status === "simulated" ? "SIMULATED" : status}
      </Badge>
    );
  };

  const upcomingByPlatform = upcomingPosts?.reduce((acc: any, post: any) => {
    if (!acc[post.platform]) acc[post.platform] = [];
    acc[post.platform].push(post);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Queue</h1>
          <p className="text-muted-foreground">
            Manage scheduled social media posts (SIMULATED MODE)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => prepareMutation.mutate()}
            disabled={prepareMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${prepareMutation.isPending ? "animate-spin" : ""}`} />
            Prepare Posts
          </Button>
          <Button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            variant="default"
          >
            <Play className="mr-2 h-4 w-4" />
            Process Queue Now
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !upcomingPosts || upcomingPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No posts scheduled. Click "Prepare Posts" to queue eligible stories.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {["instagram", "facebook", "x"].map((platform) => {
                const posts = upcomingByPlatform?.[platform] || [];
                if (posts.length === 0) return null;

                return (
                  <Card key={platform}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {getPlatformIcon(platform)}
                        {platform.charAt(0).toUpperCase() + platform.slice(1)} ({posts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {posts.map((post: any) => (
                        <div
                          key={post.id}
                          className="border rounded-lg p-4 space-y-2"
                        >
                          <div className="flex gap-4">
                            {post.image_url && (
                              <div className="flex-shrink-0">
                                <img
                                  src={post.image_url}
                                  alt=""
                                  className="w-24 h-24 object-cover rounded-md"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {getStatusBadge(post.status)}
                                <span className="text-sm text-muted-foreground truncate">
                                  {post.content_queue?.title}
                                </span>
                              </div>
                              <p className="text-sm line-clamp-3">{post.post_text}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(post.scheduled_for), "MMM d, yyyy")}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(post.scheduled_for), "h:mm a")}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {sentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !sentPosts || sentPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No posts have been sent or simulated yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Post History</CardTitle>
                <CardDescription>Recent sent and simulated posts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sentPosts.map((post: any) => (
                  <div
                    key={post.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex gap-4">
                      {post.image_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-24 h-24 object-cover rounded-md"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getPlatformIcon(post.platform)}
                          {getStatusBadge(post.status)}
                          <span className="text-sm text-muted-foreground truncate">
                            {post.content_queue?.title}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">{post.post_text}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.sent_at
                              ? format(new Date(post.sent_at), "MMM d, yyyy h:mm a")
                              : "Not sent"}
                          </div>
                          {post.error_message && (
                            <span className="text-destructive">{post.error_message}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialQueue;
