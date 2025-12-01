import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOperations } from "@/contexts/OperationsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, Clock, Instagram, Facebook, Twitter, RefreshCw, Play, Sparkles, ImagePlus, X, ExternalLink, Check, Circle, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationProgress } from "@/components/ui/OperationProgress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const SocialQueue = () => {
  const queryClient = useQueryClient();
  const operations = useOperations();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isScheduleSettingsOpen, setIsScheduleSettingsOpen] = useState(false);
  const [fullPrepStep, setFullPrepStep] = useState<'idle' | 'images' | 'voice' | 'posts' | 'complete'>('idle');
  const [prepProgress, setPrepProgress] = useState<{
    images: { current: number; total: number };
    voice: { current: number; total: number };
    posts: { current: number; total: number };
  }>({
    images: { current: 0, total: 0 },
    voice: { current: 0, total: 0 },
    posts: { current: 0, total: 0 },
  });
  const cancelRequestedRef = useRef(false);
  
  // Schedule settings (stored in localStorage)
  const [scheduleEnabled, setScheduleEnabled] = useState(() => {
    const stored = localStorage.getItem('fullPrepScheduleEnabled');
    return stored === 'true';
  });
  const [scheduleTime, setScheduleTime] = useState(() => {
    return localStorage.getItem('fullPrepScheduleTime') || '02:00';
  });

  // Pipeline health metrics
  const { data: pipelineHealth } = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: async () => {
      // Pending safe stories (needs approval)
      const { count: pendingSafe } = await supabase
        .from("content_queue")
        .select("*", { count: 'exact', head: true })
        .eq("status", "pending")
        .eq("safety_level", "safe");

      // Needs voice generation
      const { count: needsVoice } = await supabase
        .from("content_queue")
        .select("*", { count: 'exact', head: true })
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .or("content_instagram.is.null,content_facebook.is.null,content_x.is.null");

      // Needs images (has voice but no image)
      const { count: needsImages } = await supabase
        .from("content_queue")
        .select("*", { count: 'exact', head: true })
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .not("content_instagram", "is", null)
        .is("image_url", null);

      // Ready to post (has voice and image, not yet queued)
      const { data: readyStories } = await supabase
        .from("content_queue")
        .select("id")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .not("content_instagram", "is", null)
        .not("image_url", "is", null);

      // Check which ready stories haven't been queued yet
      let readyToPost = 0;
      if (readyStories && readyStories.length > 0) {
        const storyIds = readyStories.map(s => s.id);
        const { data: queuedStories } = await supabase
          .from("post_queue")
          .select("story_id")
          .in("story_id", storyIds);
        
        const queuedIds = new Set(queuedStories?.map(q => q.story_id) || []);
        readyToPost = storyIds.filter(id => !queuedIds.has(id)).length;
      }

      return {
        pendingSafe: pendingSafe || 0,
        needsVoice: needsVoice || 0,
        needsImages: needsImages || 0,
        readyToPost: readyToPost || 0,
      };
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch prep history from activity log (both completed and failed)
  const { data: prepHistory } = useQuery({
    queryKey: ["full-prep-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, created_at, message, details, action, actor_type")
        .eq("entity_type", "system")
        .in("action", ["full_queue_prep_completed", "full_queue_prep_failed"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch upcoming posts
  const { data: upcomingPosts, isLoading: upcomingLoading, refetch: refetchUpcoming } = useQuery({
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
    retry: 2,
    staleTime: 30000,
  });

  // Fetch sent/simulated posts
  const { data: sentPosts, isLoading: sentLoading, refetch: refetchSent } = useQuery({
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
    retry: 2,
    staleTime: 30000,
  });

  // Prepare posts mutation
  const prepareMutation = useMutation({
    mutationFn: async () => {
      const operationId = operations.startOperation(
        'post-preparation',
        'Preparing posts for social platforms...',
        3 // 2-4 minutes estimate
      );

      try {
        const { data, error } = await supabase.functions.invoke("prepare-posts");
        if (error) throw error;
        return { data, operationId };
      } catch (error) {
        operations.failOperation(operationId, `Failed to prepare posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    onSuccess: ({ data, operationId }: any) => {
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      operations.completeOperation(operationId, `Prepared ${data.prepared} posts for social media`);
    },
    onError: () => {
      // Error already handled in mutationFn
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
      const storiesCount = pipelineHealth?.needsVoice || 1;
      const estimatedMinutes = Math.ceil(storiesCount * 0.15); // ~9 seconds per story
      
      const operationId = operations.startOperation(
        'voice-generation',
        `Generating voice for ${storiesCount} stories...`,
        estimatedMinutes
      );

      try {
        const { data, error } = await supabase.functions.invoke("backfill-voice-variants");
        if (error) throw error;
        return { data, operationId };
      } catch (error) {
        operations.failOperation(operationId, `Failed to generate voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    onSuccess: ({ data, operationId }: any) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-health"] });
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      operations.completeOperation(operationId, `Generated voice for ${data.processed} stories (${data.errors || 0} errors)`);
    },
    onError: () => {
      // Error already handled in mutationFn
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

  // Bulk generate images mutation with batching
  const bulkGenerateImagesMutation = useMutation({
    mutationFn: async () => {
      const operationId = operations.startOperation(
        'image-generation',
        'Generating AI images in batches...',
        5 // 4-6 minutes estimate for batching
      );

      try {
        let totalGenerated = 0;
        let hasMore = true;
        const batchSize = 10;
        
        while (hasMore) {
          const { data, error } = await supabase.functions.invoke("bulk-generate-images", {
            body: { limit: batchSize }
          });
          
          if (error) throw error;
          
          totalGenerated += data.generated;
          console.log(`[Batch] Generated ${data.generated} images (total: ${totalGenerated})`);
          
          // If this batch generated fewer than limit, we're done
          hasMore = data.generated === batchSize;
          
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between batches
          }
        }
        
        return { totalGenerated, operationId };
      } catch (error) {
        operations.failOperation(operationId, `Failed to generate images: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    onSuccess: ({ totalGenerated, operationId }: any) => {
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-health"] });
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      operations.completeOperation(operationId, `Generated ${totalGenerated} images`);
    },
    onError: () => {
      // Error already handled in mutationFn
    },
  });

  // Full Queue Prep - chains all operations
  const fullPrepMutation = useMutation({
    mutationFn: async () => {
      // Reset cancel flag at start
      cancelRequestedRef.current = false;
      
      const operationId = operations.startOperation(
        'bulk-approval',
        'Running full queue preparation...',
        10 // 8-12 minutes estimate
      );

      // Capture initial counts for progress tracking
      const initialNeedsImages = pipelineHealth?.needsImages || 0;
      const initialNeedsVoice = pipelineHealth?.needsVoice || 0;
      const initialReadyToPost = pipelineHealth?.readyToPost || 0;

      try {
        // Step 1: Generate Images
        setFullPrepStep('images');
        setPrepProgress(prev => ({ ...prev, images: { current: 0, total: initialNeedsImages } }));
        
        let totalImages = 0;
        let hasMore = true;
        const batchSize = 10;
        
        while (hasMore && !cancelRequestedRef.current) {
          const { data, error } = await supabase.functions.invoke("bulk-generate-images", {
            body: { limit: batchSize }
          });
          if (error) throw error;
          totalImages += data.generated;
          setPrepProgress(prev => ({ ...prev, images: { current: totalImages, total: initialNeedsImages } }));
          hasMore = data.generated === batchSize;
          if (hasMore && !cancelRequestedRef.current) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Check for cancellation before moving to next step
        if (cancelRequestedRef.current) {
          throw new Error('Operation cancelled by user');
        }

        // Step 2: Generate Voice
        setFullPrepStep('voice');
        setPrepProgress(prev => ({ ...prev, voice: { current: 0, total: initialNeedsVoice } }));
        const { data: voiceData, error: voiceError } = await supabase.functions.invoke("backfill-voice-variants");
        if (voiceError) throw voiceError;
        setPrepProgress(prev => ({ ...prev, voice: { current: voiceData.processed, total: initialNeedsVoice } }));

        // Check for cancellation before moving to next step
        if (cancelRequestedRef.current) {
          throw new Error('Operation cancelled by user');
        }

        // Step 3: Prepare Posts
        setFullPrepStep('posts');
        setPrepProgress(prev => ({ ...prev, posts: { current: 0, total: initialReadyToPost } }));
        const { data: postData, error: postError } = await supabase.functions.invoke("prepare-posts");
        if (postError) throw postError;
        setPrepProgress(prev => ({ ...prev, posts: { current: postData.prepared, total: postData.prepared } }));

        setFullPrepStep('complete');
        return { 
          operationId,
          images: totalImages, 
          voice: voiceData.processed, 
          posts: postData.prepared 
        };
      } catch (error) {
        setFullPrepStep('idle');
        setPrepProgress({ images: { current: 0, total: 0 }, voice: { current: 0, total: 0 }, posts: { current: 0, total: 0 } });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const wasCancelled = errorMessage.includes('cancelled');

        // Log manual failure (best-effort)
        try {
          await supabase.from('activity_log').insert({
            entity_type: 'system',
            action: 'full_queue_prep_failed',
            actor_type: 'user',
            message: `Manual full queue prep failed: ${errorMessage}`,
            details: {
              error: errorMessage,
              timestamp: new Date().toISOString(),
              mode: 'manual',
            },
          });
        } catch (logError) {
          console.error('Failed to log error:', logError);
        }

        operations.failOperation(operationId, `Full prep ${wasCancelled ? 'cancelled' : 'failed'}: ${errorMessage}`);
        throw error;
      }
    },
    onSuccess: async ({ operationId, images, voice, posts }: any) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-health"] });
      queryClient.invalidateQueries({ queryKey: ["post-queue"] });
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      queryClient.invalidateQueries({ queryKey: ["full-prep-history"] });

      // Log manual success (best-effort)
      try {
        await supabase.from('activity_log').insert({
          entity_type: 'system',
          action: 'full_queue_prep_completed',
          actor_type: 'user',
          message: `Manual full queue prep completed: ${images} images, ${voice} voice variants, ${posts} posts queued`,
          details: {
            images,
            voice,
            posts,
            timestamp: new Date().toISOString(),
            mode: 'manual',
          },
        });
      } catch (logError) {
        console.error('Failed to log success:', logError);
      }

      operations.completeOperation(
        operationId, 
        `Full prep complete: ${images} images, ${voice} voice variants, ${posts} posts queued`
      );
      setFullPrepStep('idle');
      setPrepProgress({ images: { current: 0, total: 0 }, voice: { current: 0, total: 0 }, posts: { current: 0, total: 0 } });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["full-prep-history"] });
      setFullPrepStep('idle');
      setPrepProgress({ images: { current: 0, total: 0 }, voice: { current: 0, total: 0 }, posts: { current: 0, total: 0 } });
      cancelRequestedRef.current = false;
    },
  });

  const handleCancelFullPrep = () => {
    cancelRequestedRef.current = true;
    toast.info('Cancelling Full Queue Prep after current step...');
  };

  const handleSaveSchedule = () => {
    localStorage.setItem('fullPrepScheduleEnabled', scheduleEnabled.toString());
    localStorage.setItem('fullPrepScheduleTime', scheduleTime);
    toast.success('Schedule settings saved');
    setIsScheduleSettingsOpen(false);
  };

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

  const openImagePreview = (post: any) => {
    setSelectedPost(post);
    setIsPreviewOpen(true);
  };

  const closeImagePreview = () => {
    setIsPreviewOpen(false);
    setSelectedPost(null);
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
            onClick={() => fullPrepMutation.mutate()}
            disabled={fullPrepMutation.isPending || backfillMutation.isPending || bulkGenerateImagesMutation.isPending || prepareMutation.isPending}
            variant="default"
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {fullPrepMutation.isPending ? (
              fullPrepStep === 'images' ? 'Step 1/3: Images...' :
              fullPrepStep === 'voice' ? 'Step 2/3: Voice...' :
              fullPrepStep === 'posts' ? 'Step 3/3: Posts...' :
              'Preparing...'
            ) : 'Full Queue Prep'}
          </Button>
          <Button
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending || fullPrepMutation.isPending}
            variant="secondary"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {backfillMutation.isPending ? "Processing..." : `Generate Voice${pipelineHealth?.needsVoice && pipelineHealth.needsVoice > 0 ? ` (${pipelineHealth.needsVoice})` : ''}`}
          </Button>
          <Button
            onClick={() => bulkGenerateImagesMutation.mutate()}
            disabled={bulkGenerateImagesMutation.isPending || fullPrepMutation.isPending}
            variant="secondary"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {bulkGenerateImagesMutation.isPending ? "Processing..." : "Generate Images"}
          </Button>
          <Button
            onClick={() => prepareMutation.mutate()}
            disabled={prepareMutation.isPending || fullPrepMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${prepareMutation.isPending ? "animate-spin" : ""}`} />
            {prepareMutation.isPending ? "Processing..." : "Prepare Posts"}
          </Button>
          <Button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending || fullPrepMutation.isPending}
            variant="default"
          >
            <Play className="mr-2 h-4 w-4" />
            {processMutation.isPending ? "Processing..." : "Process Queue Now"}
          </Button>
          <Button
            onClick={() => setIsScheduleSettingsOpen(true)}
            variant="outline"
            size="icon"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Full Prep Progress */}
      {fullPrepMutation.isPending && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Full Queue Prep Running</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">~8-12 minutes</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelFullPrep}
                    className="h-7 text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className={`flex items-center justify-between ${fullPrepStep === 'images' ? 'text-primary' : fullPrepStep !== 'idle' ? 'text-muted-foreground' : ''}`}>
                  <div className="flex items-center gap-2">
                    {fullPrepStep === 'images' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : ['voice', 'posts', 'complete'].includes(fullPrepStep) ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    <span>Step 1/3: Generate AI Images</span>
                  </div>
                  {fullPrepStep === 'images' && prepProgress.images.total > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {prepProgress.images.current} / {prepProgress.images.total}
                    </Badge>
                  )}
                  {['voice', 'posts', 'complete'].includes(fullPrepStep) && prepProgress.images.current > 0 && (
                    <Badge variant="outline" className="text-xs text-green-500">
                      {prepProgress.images.current} done
                    </Badge>
                  )}
                </div>
                
                <div className={`flex items-center justify-between ${fullPrepStep === 'voice' ? 'text-primary' : ['posts', 'complete'].includes(fullPrepStep) ? 'text-muted-foreground' : ''}`}>
                  <div className="flex items-center gap-2">
                    {fullPrepStep === 'voice' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : ['posts', 'complete'].includes(fullPrepStep) ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    <span>Step 2/3: Generate Voice Variants</span>
                  </div>
                  {fullPrepStep === 'voice' && prepProgress.voice.total > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Processing {prepProgress.voice.total} stories...
                    </Badge>
                  )}
                  {['posts', 'complete'].includes(fullPrepStep) && prepProgress.voice.current > 0 && (
                    <Badge variant="outline" className="text-xs text-green-500">
                      {prepProgress.voice.current} done
                    </Badge>
                  )}
                </div>
                
                <div className={`flex items-center justify-between ${fullPrepStep === 'posts' ? 'text-primary' : fullPrepStep === 'complete' ? 'text-muted-foreground' : ''}`}>
                  <div className="flex items-center gap-2">
                    {fullPrepStep === 'posts' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : fullPrepStep === 'complete' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    <span>Step 3/3: Prepare & Queue Posts</span>
                  </div>
                  {fullPrepStep === 'posts' && (
                    <Badge variant="outline" className="text-xs">
                      Queueing posts...
                    </Badge>
                  )}
                  {fullPrepStep === 'complete' && prepProgress.posts.current > 0 && (
                    <Badge variant="outline" className="text-xs text-green-500">
                      {prepProgress.posts.current} queued
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                The operation runs in the background. You can navigate away and check back later.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Automated Schedule Status */}
      {!fullPrepMutation.isPending && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${scheduleEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium">
                    Automated Daily Run: {scheduleEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  {scheduleEnabled && (
                    <p className="text-xs text-muted-foreground">
                      Scheduled for {scheduleTime} daily (UTC)
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsScheduleSettingsOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Health Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Pipeline Health
          </CardTitle>
          <CardDescription>Content flow through the automation pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Pending Safe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Pending Approval</span>
                <Badge variant="outline" className="text-lg font-bold">
                  {pipelineHealth?.pendingSafe || 0}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Safe stories awaiting review</p>
              {pipelineHealth && pipelineHealth.pendingSafe > 0 && (
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link to="/dashboard/content?status=pending">
                    <Clock className="h-3 w-3 mr-1" />
                    Review Now
                  </Link>
                </Button>
              )}
            </div>

            {/* Needs Voice */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Needs Voice</span>
                <Badge variant={pipelineHealth && pipelineHealth.needsVoice > 0 ? "default" : "outline"} className="text-lg font-bold">
                  {pipelineHealth?.needsVoice || 0}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Missing platform variants</p>
              {pipelineHealth && pipelineHealth.needsVoice > 0 && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => backfillMutation.mutate()}
                  disabled={backfillMutation.isPending || fullPrepMutation.isPending}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate
                </Button>
              )}
            </div>

            {/* Needs Images */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Needs Images</span>
                <Badge variant={pipelineHealth && pipelineHealth.needsImages > 0 ? "default" : "outline"} className="text-lg font-bold">
                  {pipelineHealth?.needsImages || 0}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Missing visual assets</p>
              {pipelineHealth && pipelineHealth.needsImages > 0 && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => bulkGenerateImagesMutation.mutate()}
                  disabled={bulkGenerateImagesMutation.isPending || fullPrepMutation.isPending}
                >
                  <ImagePlus className="h-3 w-3 mr-1" />
                  Generate
                </Button>
              )}
            </div>

            {/* Ready to Post */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Ready to Post</span>
                <Badge variant={pipelineHealth && pipelineHealth.readyToPost > 0 ? "default" : "outline"} className="text-lg font-bold bg-green-500">
                  {pipelineHealth?.readyToPost || 0}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Complete & unqueued</p>
              {pipelineHealth && pipelineHealth.readyToPost > 0 && (
                <Button 
                  size="sm" 
                  variant="default" 
                  className="w-full"
                  onClick={() => prepareMutation.mutate()}
                  disabled={prepareMutation.isPending || fullPrepMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Queue Posts
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prep History Card */}
      {prepHistory && prepHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prep History</CardTitle>
            <CardDescription>Last 10 Full Queue Prep runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {prepHistory.map((entry: any) => {
                const isFailed = entry.action === 'full_queue_prep_failed';
                const mode = entry.details?.mode || (entry.actor_type === 'user' ? 'manual' : 'auto');
                
                return (
                  <div 
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isFailed ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isFailed ? 'text-destructive' : ''}`}>
                          {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")} UTC
                        </p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {mode}
                        </Badge>
                      </div>
                      {!isFailed ? (
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{entry.details?.images || 0} images</span>
                          <span>•</span>
                          <span>{entry.details?.voice || 0} voice</span>
                          <span>•</span>
                          <span>{entry.details?.posts || 0} posts</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-destructive">
                          {entry.details?.error || 'Unknown error'}
                        </p>
                      )}
                    </div>
                    <Badge variant={isFailed ? "destructive" : "outline"} className={!isFailed ? "text-green-600" : ""}>
                      {isFailed ? "Failed" : "Completed"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(backfillMutation.isPending || bulkGenerateImagesMutation.isPending || prepareMutation.isPending) && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <OperationProgress 
              current={1} 
              total={2}
              message={backfillMutation.isPending 
                ? `Generating voice variants for ${pipelineHealth?.needsVoice || 0} stories (2-3 min)...` 
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
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-muted-foreground">Loading upcoming posts...</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => refetchUpcoming()}
                    className="mt-2"
                  >
                    Taking too long? Click to retry
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                              <div 
                                className="flex-shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => openImagePreview(post)}
                              >
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
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-muted-foreground">Loading post history...</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => refetchSent()}
                    className="mt-2"
                  >
                    Taking too long? Click to retry
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                        <div 
                          className="flex-shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => openImagePreview(post)}
                        >
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

      {/* Image Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPost && getPlatformIcon(selectedPost.platform)}
              Image Preview
            </DialogTitle>
            <DialogDescription>
              {selectedPost?.content_queue?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPost && (
            <div className="space-y-4">
              {/* Full-size image */}
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedPost.generated_image_url || selectedPost.image_url}
                  alt={selectedPost.content_queue?.title}
                  className="w-full h-auto max-h-[500px] object-contain mx-auto"
                />
                <div className="absolute top-2 right-2">
                  {getImageSourceBadge(selectedPost)}
                </div>
              </div>

              {/* Story Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Post Content</h4>
                  <p className="text-sm text-muted-foreground">{selectedPost.post_text}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Platform:</span>{" "}
                    <span className="capitalize">{selectedPost.platform}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Status:</span>{" "}
                    {getStatusBadge(selectedPost.status)}
                  </div>
                  <div>
                    <span className="font-semibold">Category:</span>{" "}
                    <Badge variant="outline" className="text-xs">
                      {selectedPost.content_queue?.category}
                    </Badge>
                  </div>
                  {selectedPost.scheduled_for && (
                    <div>
                      <span className="font-semibold">Scheduled:</span>{" "}
                      {format(new Date(selectedPost.scheduled_for), "MMM d, yyyy h:mm a")}
                    </div>
                  )}
                </div>

                {selectedPost.is_sponsored && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                    <Badge variant="default">Sponsored Content</Badge>
                    {selectedPost.image_url && !selectedPost.generated_image_url && (
                      <Badge variant="destructive" className="text-xs">
                        ⚠ Should use AI-generated image
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {shouldShowRegenerateButton(selectedPost) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      generateImageMutation.mutate(selectedPost.id);
                      closeImagePreview();
                    }}
                    disabled={generateImageMutation.isPending}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Image
                  </Button>
                )}
                {shouldShowGenerateButton(selectedPost) && (
                  <Button
                    variant="default"
                    onClick={() => {
                      generateImageMutation.mutate(selectedPost.id);
                      closeImagePreview();
                    }}
                    disabled={generateImageMutation.isPending}
                    className="flex-1"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Image
                  </Button>
                )}
                {selectedPost.image_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedPost.generated_image_url || selectedPost.image_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Full Size
                  </Button>
                )}
                <Button variant="ghost" onClick={closeImagePreview}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Settings Dialog */}
      <Dialog open={isScheduleSettingsOpen} onOpenChange={setIsScheduleSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Automated Full Queue Prep Schedule</DialogTitle>
            <DialogDescription>
              Configure when Full Queue Prep should run automatically each day
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-enabled" className="text-base">
                  Enable Automated Runs
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically run Full Queue Prep daily
                </p>
              </div>
              <Switch
                id="schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
            </div>

            {scheduleEnabled && (
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Run Time (UTC)</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Full Queue Prep will run automatically at this time every day (UTC timezone)
                </p>
              </div>
            )}

            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Setup Required
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    To enable automated runs, set up a pg_cron job in Supabase. Click below to copy SQL, 
                    then paste into Supabase SQL Editor and replace YOUR_ANON_KEY_HERE with your actual 
                    anon key from Settings → API → Project API keys.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const cronTime = scheduleTime.split(':');
                      const cronMinute = cronTime[1] || '0';
                      const cronHour = cronTime[0] || '2';
                      
                      const sql = `-- Enable pg_cron extension (run once)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule Full Queue Prep to run daily at ${scheduleTime} UTC
SELECT cron.schedule(
  'full-queue-prep-daily',
  '${cronMinute} ${cronHour} * * *', -- ${scheduleTime} UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/full-queue-prep',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY_HERE"}'::jsonb
    ) as request_id;
  $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove the schedule:
-- SELECT cron.unschedule('full-queue-prep-daily');`;
                      
                      navigator.clipboard.writeText(sql);
                      toast.success('SQL copied to clipboard!');
                    }}
                  >
                    Copy SQL Setup Code
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsScheduleSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSchedule}>
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialQueue;
