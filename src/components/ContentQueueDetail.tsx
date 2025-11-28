import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { ExternalLink, Check, X, Upload, Send, Sparkles } from "lucide-react";
import { logActivity } from "@/lib/logActivity";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ContentQueueDetailProps = {
  storyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ContentQueueDetail({
  storyId,
  open,
  onOpenChange,
}: ContentQueueDetailProps) {
  const queryClient = useQueryClient();
  const [editedTitle, setEditedTitle] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [activeVoiceTab, setActiveVoiceTab] = useState("base");

  const { data: story, isLoading: isLoadingStory, error: storyError } = useQuery({
    queryKey: ["content-queue-detail", storyId],
    queryFn: async () => {
      console.log("🚀 Query function STARTING for story:", storyId);
      
      if (!storyId) {
        console.log("⚠️ No storyId, returning null");
        return null;
      }
      
      // Verify auth session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("🔐 Auth session result:", { 
        hasSession: !!session, 
        userId: session?.user?.id,
        error: sessionError?.message 
      });
      
      if (!session) {
        throw new Error("No active session - please sign in again");
      }
      
      console.log("🔍 Fetching story from database:", storyId);
      
      // Try with join first
      let { data, error } = await supabase
        .from("content_queue")
        .select(`*, source:sources(name)`)
        .eq("id", storyId)
        .maybeSingle();

      console.log("📦 Query result:", { hasData: !!data, error: error?.message });

      // If that fails, try without join
      if (!data && !error) {
        console.log("⚠️ Join query returned null, trying without join");
        const fallback = await supabase
          .from("content_queue")
          .select("*")
          .eq("id", storyId)
          .maybeSingle();
        
        if (fallback.data) {
          data = { ...fallback.data, source: null };
        }
        error = fallback.error;
      }

      if (error) {
        console.error("❌ Story detail fetch failed:", error);
        throw error;
      }
      
      console.log("✅ Query completed, data:", data ? "found" : "null");
      return data;
    },
    enabled: !!storyId && open,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  // Debug log on component mount/update
  useEffect(() => {
    console.log("🔧 ContentQueueDetail mounted/updated:", { 
      storyId, 
      open, 
      isLoadingStory, 
      hasStory: !!story,
      error: storyError?.message 
    });
  }, [storyId, open, isLoadingStory, story, storyError]);

  const { data: channels = [] } = useQuery({
    queryKey: ["distribution-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_channels")
        .select("*")
        .eq("is_active", true)
        .order("type");

      if (error) throw error;
      return data;
    },
  });

  const { data: existingTargets = [] } = useQuery({
    queryKey: ["content-targets", storyId],
    queryFn: async () => {
      if (!storyId) return [];
      const { data, error } = await supabase
        .from("content_targets")
        .select("channel_id")
        .eq("content_id", storyId);

      if (error) throw error;
      return data;
    },
    enabled: !!storyId,
  });

  useEffect(() => {
    if (story) {
      setEditedTitle(story.title);
      setEditedSummary(story.summary || "");
      setEditedCategory(story.category || "");
    }
  }, [story]);

  useEffect(() => {
    if (existingTargets.length > 0) {
      setSelectedTargets(new Set(existingTargets.map((t) => t.channel_id)));
    }
  }, [existingTargets]);

  const updateStoryMutation = useMutation({
    mutationFn: async (updates: { title?: string; summary?: string; category?: string }) => {
      console.log("📝 Updating story:", storyId, updates);
      
      const { data: updated, error } = await supabase
        .from("content_queue")
        .update(updates)
        .eq("id", storyId!)
        .select()
        .single();

      if (error) {
        console.error("❌ Update failed:", error);
        throw new Error(error.message);
      }

      if (!updated) {
        console.error("❌ No row returned after update - check RLS");
        throw new Error("Update failed - no data returned");
      }

      console.log("✅ Story updated successfully:", updated.title);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      queryClient.invalidateQueries({ queryKey: ["content-queue-detail"] });
      toast.success("Story updated successfully");

      // Log activity
      await logActivity({
        entityType: "content",
        entityId: storyId,
        action: "updated",
        message: `Story "${editedTitle}" updated`,
        details: {
          fields_updated: ["title", "summary", "category"],
        },
      });
    },
    onError: () => {
      toast.error("Failed to update story");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!storyId) return;
      console.log("🔄 Updating story status (from drawer):", { storyId, status });
      
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      };

      if (status === "published") {
        updates.publish_date = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from("content_queue")
        .update(updates)
        .eq("id", storyId)
        .select()
        .single();

      if (error) {
        console.error("❌ Update failed:", error);
        throw new Error(error.message);
      }

      if (!updated) {
        console.error("❌ No row returned after update - check RLS");
        throw new Error("Update failed - no data returned");
      }

      console.log("✅ Status updated successfully:", updated.status);
    },
    onSuccess: async (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      queryClient.invalidateQueries({ queryKey: ["content-queue-detail"] });
      toast.success(`Story ${status}`);

      // Log activity
      await logActivity({
        entityType: "content",
        entityId: storyId,
        action: status,
        message: `Story "${story?.title || storyId}" ${status}`,
        details: {
          new_status: status,
        },
      });
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
      toast.error(`Failed to update status: ${error.message || "Unknown error"}`);
    },
  });

  const saveTargetsMutation = useMutation({
    mutationFn: async () => {
      if (!storyId) return;
      console.log("🎯 Saving publishing targets:", { storyId, targets: Array.from(selectedTargets) });

      try {
        // Delete existing targets
        const { error: deleteError } = await supabase
          .from("content_targets")
          .delete()
          .eq("content_id", storyId);

        if (deleteError) {
          console.error("❌ Failed to delete existing targets:", deleteError);
          throw new Error(deleteError.message);
        }

        // Insert new targets
        if (selectedTargets.size > 0) {
          const targets = Array.from(selectedTargets).map((channelId) => ({
            content_id: storyId,
            channel_id: channelId,
            status: "pending",
          }));

          const { error: insertError } = await supabase
            .from("content_targets")
            .insert(targets);

          if (insertError) {
            console.error("❌ Failed to insert new targets:", insertError);
            throw new Error(insertError.message);
          }
        }
        
        console.log("✅ Publishing targets saved successfully");
      } catch (err: any) {
        console.error("❌ Exception during targets save:", err);
        throw err;
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["content-targets"] });
      toast.success("Publishing targets updated");

      await logActivity({
        entityType: "content",
        entityId: storyId,
        action: "targets_updated",
        message: `Publishing targets updated for "${story?.title || storyId}"`,
        details: {
          target_count: selectedTargets.size,
        },
      });
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
      toast.error(`Failed to update targets: ${error.message || "Unknown error"}`);
    },
  });

  const handleSaveChanges = () => {
    updateStoryMutation.mutate({
      title: editedTitle,
      summary: editedSummary,
      category: editedCategory,
    });
  };

  const handleToggleTarget = (channelId: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const generateVoiceMutation = useMutation({
    mutationFn: async () => {
      if (!storyId) return;
      console.log("✨ Generating Lake Geneva voice for:", storyId);

      const { data, error } = await supabase.functions.invoke('transform-voice', {
        body: { mode: 'single', id: storyId }
      });

      if (error) {
        console.error("❌ Voice generation failed:", error);
        throw error;
      }

      console.log("✅ Voice generated successfully:", data);
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["content-queue-detail"] });
      toast.success("Lake Geneva voice generated!");

      await logActivity({
        entityType: "content",
        entityId: storyId,
        action: "voice_generated",
        message: `Lake Geneva voice generated for "${story?.title || storyId}"`,
        details: {
          voice_version: 'lg_voice_v1',
        },
      });
    },
    onError: (error: any) => {
      console.error("❌ Voice generation error:", error);
      toast.error(`Failed to generate voice: ${error.message || "Unknown error"}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "approved":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "published":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "";
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="px-6">
          <DrawerTitle>Story Details</DrawerTitle>
          <DrawerDescription>
            {isLoadingStory 
              ? "Loading story information..." 
              : storyError 
              ? "Error loading story" 
              : !story 
              ? "Story not available"
              : "Review and edit story information"}
          </DrawerDescription>
        </DrawerHeader>

        {isLoadingStory ? (
          <div className="p-8 text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading story details...</p>
            <p className="text-xs text-muted-foreground">Verifying permissions...</p>
          </div>
        ) : storyError ? (
          <div className="p-8 text-center space-y-4">
            <p className="text-destructive font-semibold">Failed to load story</p>
            <p className="text-sm text-muted-foreground">{storyError.message}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : !story ? (
          <div className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">Story not found</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <Badge
                variant="outline"
                className={getStatusColor(story.status)}
              >
                {story.status}
              </Badge>
            </div>

            {/* Safety Information */}
            {story.safety_level && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-semibold mb-2 block">Safety Evaluation</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Level:</span>
                    <Badge
                      variant="outline"
                      className={
                        story.safety_level === "safe"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : story.safety_level === "sensitive"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      }
                    >
                      {story.safety_level}
                    </Badge>
                  </div>
                  {story.safety_tags && Array.isArray(story.safety_tags) && story.safety_tags.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-sm text-muted-foreground min-w-fit">Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {story.safety_tags.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {story.safety_reason && (
                    <div className="flex items-start gap-2">
                      <span className="text-sm text-muted-foreground min-w-fit">Reason:</span>
                      <p className="text-sm">{story.safety_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          <div className="space-y-6 mt-6">
            {/* Editable Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={editedCategory} onValueChange={setEditedCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="events">Events</SelectItem>
                    <SelectItem value="dining">Dining</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>

            <Separator />

            {/* Content */}
            <div>
              <Label>Full Content</Label>
              <div className="mt-2 p-4 border rounded-md bg-muted/20 max-h-96 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm">{story.content}</p>
              </div>
            </div>

            <Separator />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Source</Label>
                <p className="mt-1">{story.source?.name || "Unknown"}</p>
              </div>
              {story.author && (
                <div>
                  <Label className="text-muted-foreground">Author</Label>
                  <p className="mt-1">{story.author}</p>
                </div>
              )}
              {story.original_url && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Original URL</Label>
                  <a
                    href={story.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline mt-1"
                  >
                    {story.original_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <Separator />

            {/* Lake Geneva Voice */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-base font-semibold">Lake Geneva Voice</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate channel-specific branded content
                  </p>
                </div>
                {story.voice_generated_at && (
                  <Badge variant="secondary" className="text-xs">
                    Generated {new Date(story.voice_generated_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>

              {!story.voice_generated_at ? (
                <div className="border border-dashed rounded-lg p-8 text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate Lake Geneva-branded versions for all distribution channels
                  </p>
                  <Button
                    onClick={() => generateVoiceMutation.mutate()}
                    disabled={generateVoiceMutation.isPending || story.safety_level === 'blocked'}
                    className="gap-2"
                  >
                    <Sparkles className={`h-4 w-4 ${generateVoiceMutation.isPending ? "animate-pulse" : ""}`} />
                    {generateVoiceMutation.isPending ? "Generating..." : "Generate Lake Geneva Voice"}
                  </Button>
                  {story.safety_level === 'blocked' && (
                    <p className="text-xs text-destructive mt-2">
                      Cannot generate voice for blocked content
                    </p>
                  )}
                </div>
              ) : (
                <Tabs value={activeVoiceTab} onValueChange={setActiveVoiceTab}>
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="base">Base</TabsTrigger>
                    <TabsTrigger value="website">Website</TabsTrigger>
                    <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
                    <TabsTrigger value="facebook">Facebook</TabsTrigger>
                    <TabsTrigger value="instagram">Instagram</TabsTrigger>
                    <TabsTrigger value="x">X</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="base" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_lg_base || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="website" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_website || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="newsletter" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_newsletter || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="facebook" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_facebook || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="instagram" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_instagram || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="x" className="mt-4">
                    <div className="border rounded-lg p-4 bg-muted/20 min-h-[120px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {story.content_x || "No content generated"}
                      </p>
                    </div>
                  </TabsContent>

                  <Button
                    onClick={() => generateVoiceMutation.mutate()}
                    variant="outline"
                    disabled={generateVoiceMutation.isPending}
                    className="mt-4 w-full gap-2"
                  >
                    <Sparkles className={`h-4 w-4 ${generateVoiceMutation.isPending ? "animate-pulse" : ""}`} />
                    Regenerate Voice
                  </Button>
                </Tabs>
              )}
            </div>

            <Separator />

            {/* Publishing Targets */}
            <div>
              <Label className="text-base font-semibold">Publishing Targets</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Select where this story should be published
              </p>
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={channel.id}
                      checked={selectedTargets.has(channel.id)}
                      onCheckedChange={() => handleToggleTarget(channel.id)}
                    />
                    <label
                      htmlFor={channel.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {channel.name}
                    </label>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => saveTargetsMutation.mutate()}
                variant="outline"
                className="mt-4 w-full"
                disabled={saveTargetsMutation.isPending}
              >
                <Send className={`h-4 w-4 mr-2 ${saveTargetsMutation.isPending ? "animate-pulse" : ""}`} />
                Save Publishing Targets
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSaveChanges} 
                className="flex-1"
                disabled={updateStoryMutation.isPending}
              >
                Save Changes
              </Button>
              {story.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("approved")}
                  >
                    <Check className={`h-4 w-4 mr-2 ${updateStatusMutation.isPending ? "animate-pulse" : ""}`} />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("rejected")}
                  >
                    <X className={`h-4 w-4 mr-2 ${updateStatusMutation.isPending ? "animate-pulse" : ""}`} />
                    Reject
                  </Button>
                </>
              )}
              {story.status === "approved" && (
                <Button
                  variant="outline"
                  disabled={updateStatusMutation.isPending}
                  onClick={() => updateStatusMutation.mutate("published")}
                >
                  <Upload className={`h-4 w-4 mr-2 ${updateStatusMutation.isPending ? "animate-pulse" : ""}`} />
                  Publish
                </Button>
              )}
            </div>
          </div>
        </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
