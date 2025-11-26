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
import { ExternalLink, Check, X, Upload } from "lucide-react";
import { logActivity } from "@/lib/logActivity";

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

  const { data: story } = useQuery({
    queryKey: ["content-queue-detail", storyId],
    queryFn: async () => {
      if (!storyId) return null;
      const { data, error } = await supabase
        .from("content_queue")
        .select(`
          *,
          source:sources!source_id(name)
        `)
        .eq("id", storyId)
        .single();

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

  const updateStoryMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!storyId) return;
      const { error } = await supabase
        .from("content_queue")
        .update(updates)
        .eq("id", storyId);

      if (error) throw error;
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
      const updates: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (status === "published") {
        updates.publish_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from("content_queue")
        .update(updates)
        .eq("id", storyId);

      if (error) throw error;
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
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const handleSaveChanges = () => {
    updateStoryMutation.mutate({
      title: editedTitle,
      summary: editedSummary,
      category: editedCategory,
    });
  };

  if (!story) return null;

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
        <div className="mx-auto w-full max-w-4xl overflow-y-auto p-6">
          <DrawerHeader className="px-0">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <DrawerTitle className="text-2xl">Story Details</DrawerTitle>
                <DrawerDescription>
                  Review and edit story information
                </DrawerDescription>
              </div>
              <Badge
                variant="outline"
                className={getStatusColor(story.status)}
              >
                {story.status}
              </Badge>
            </div>
          </DrawerHeader>

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

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveChanges} className="flex-1">
                Save Changes
              </Button>
              {story.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate("approved")}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate("rejected")}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {story.status === "approved" && (
                <Button
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate("published")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
