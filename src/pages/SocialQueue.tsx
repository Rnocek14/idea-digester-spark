import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, Clock, Instagram, Facebook, Twitter, RefreshCw, Play, Sparkles, ImagePlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationProgress } from "@/components/ui/OperationProgress";

const SocialQueue = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Count stories needing voice generation
  const { data: needsVoiceCount } = useQuery({
    queryKey: ["needs-voice-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("content_queue")
        .select("*", { count: 'exact', head: true })
        .in("status", ["approved", "auto_published", "published"])
        .or("content_instagram.is.null,content_facebook.is.null,content_x.is.null");
      return count || 0;
    },
  });

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
      toast.info("Preparing posts in background. This may take 2-4 minutes...", {
        duration: 5000
      });

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

  // Backfill voice variants mutation
  const backfillMutation = useMutation({
    mutationFn: async () => {
      const storiesCount = needsVoiceCount || 1;
      const estimatedMinutes = Math.ceil(storiesCount * 0.15); // ~9 seconds per story
      
      toast.info(`Processing ${storiesCount} stories. This will take approximately ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}...`, {
        duration: 5000
      });

      const { data, error } = await supabase.functions.invoke("backfill-voice-variants");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["needs-voice-count"] });
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      toast.success(`Generated voice for ${data.processed} stories (${data.errors || 0} errors)`);
    },
    onError: (error: any) => {
      toast.error(`Failed to generate voice: ${error.message}`);
    },
  });

  // Generate image mutation
  const generateImageMutation = useMutation({
    mutationFn: async (postId: string) => {
      // Get the post to find story_id
      const { data: post } = await supabase
        .from('post_queue')
        .select('story_id, platform')
        .eq('id', postId)
        .single();
      
      if (!post) throw new Error('Post not found');

      const { data, error } = await supabase.functions.invoke("generate-post-image", {
        body: { story_id: post.story_id, platform: post.platform }
      });
      if (error) throw error;
      
      // Update post_queue with generated image
      const { error: updateError } = await supabase
        .from('post_queue')
        .update({ generated_image_url: data.image_url })
        .eq('id', postId);
      
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      toast.success('Image generated successfully');
      queryClient.invalidateQueries({ queryKey: ['post-queue', 'upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['post-queue', 'sent'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to generate image: ${error.message}`);
    },
  });

  // Bulk generate images mutation
  const bulkGenerateImagesMutation = useMutation({
    mutationFn: async () => {
      toast.info("Generating AI images for stories (this may take 3-5 minutes)...", {
        duration: 5000
      });

      const { data, error } = await supabase.functions.invoke("bulk-generate-images");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      queryClient.invalidateQueries({ queryKey: ["needs-voice-count"] });
      toast.success(data.message || "Images generated successfully!");
    },
    onError: (error: any) => {
      toast.error(`Failed to generate images: ${error.message}`);
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

  const getImageSourceBadge = (post: any) => {
    if (post.generated_image_url) {
      return <Badge variant="secondary" className="text-xs">AI</Badge>;
    }
    if (post.image_url) {
      return <Badge variant="outline" className="text-xs">OG</Badge>;
    }
    return null;
  };

  const shouldShowGenerateButton = (post: any) => {
    // Show if no image at all, or if sponsored with scraped image
    return !post.generated_image_url && (!post.image_url || post.is_sponsored);
  };

  const shouldShowRegenerateButton = (post: any) => {
    // Show regenerate button if already has AI-generated image
    return !!post.generated_image_url;
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
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            variant="secondary"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {backfillMutation.isPending ? "Processing..." : `Generate Voice${needsVoiceCount && needsVoiceCount > 0 ? ` (${needsVoiceCount})` : ''}`}
          </Button>
          <Button
            onClick={() => bulkGenerateImagesMutation.mutate()}
            disabled={bulkGenerateImagesMutation.isPending}
            variant="secondary"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {bulkGenerateImagesMutation.isPending ? "Processing..." : "Generate Images"}
          </Button>
          <Button
            onClick={() => prepareMutation.mutate()}
            disabled={prepareMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${prepareMutation.isPending ? "animate-spin" : ""}`} />
            {prepareMutation.isPending ? "Processing..." : "Prepare Posts"}
          </Button>
          <Button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            variant="default"
          >
            <Play className="mr-2 h-4 w-4" />
            {processMutation.isPending ? "Processing..." : "Process Queue Now"}
          </Button>
        </div>
      </div>

      {(backfillMutation.isPending || bulkGenerateImagesMutation.isPending || prepareMutation.isPending) && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <OperationProgress 
              current={1} 
              total={2}
              message={backfillMutation.isPending 
                ? `Generating voice variants for ${needsVoiceCount || 0} stories (2-3 min)...` 
                : bulkGenerateImagesMutation.isPending 
                ? "Generating AI images for stories without images (3-5 min)..."
                : "Preparing social media posts (2-4 min)..."}
            />
            <p className="text-xs text-muted-foreground mt-3">
              The operation is running in the background. You can navigate away and check back later.
            </p>
          </CardContent>
        </Card>
      )}

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
                            {(post.generated_image_url || post.image_url) && (
                              <div className="flex-shrink-0 relative">
                                <img
                                  src={post.generated_image_url || post.image_url}
                                  alt=""
                                  className="w-24 h-24 object-cover rounded-md"
                                />
                                <div className="absolute -top-1 -right-1">
                                  {getImageSourceBadge(post)}
                                </div>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {getStatusBadge(post.status)}
                                {post.is_sponsored && (
                                  <Badge variant="default" className="text-xs">Sponsored</Badge>
                                )}
                                {post.is_sponsored && post.image_url && !post.generated_image_url && (
                                  <Badge variant="destructive" className="text-xs">⚠ Use AI Image</Badge>
                                )}
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
                          <div className="flex gap-2">
                            {shouldShowGenerateButton(post) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateImageMutation.mutate(post.id)}
                                disabled={generateImageMutation.isPending}
                                className="flex-1"
                              >
                                {generateImageMutation.isPending ? "Generating..." : "Generate AI Image"}
                              </Button>
                            )}
                            {shouldShowRegenerateButton(post) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => generateImageMutation.mutate(post.id)}
                                disabled={generateImageMutation.isPending}
                                className="flex-1"
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${generateImageMutation.isPending ? "animate-spin" : ""}`} />
                                {generateImageMutation.isPending ? "Regenerating..." : "Regenerate Image"}
                              </Button>
                            )}
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
                      {(post.generated_image_url || post.image_url) && (
                        <div className="flex-shrink-0 relative">
                          <img
                            src={post.generated_image_url || post.image_url}
                            alt=""
                            className="w-24 h-24 object-cover rounded-md"
                          />
                          <div className="absolute -top-1 -right-1">
                            {getImageSourceBadge(post)}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getPlatformIcon(post.platform)}
                          {getStatusBadge(post.status)}
                          {post.is_sponsored && (
                            <Badge variant="default" className="text-xs">Sponsored</Badge>
                          )}
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
