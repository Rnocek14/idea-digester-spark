import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Eye, Check, X, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ContentQueueDetail } from "@/components/ContentQueueDetail";
import { NewStoryDialog } from "@/components/NewStoryDialog";
import { format } from "date-fns";
import { logActivity } from "@/lib/logActivity";
import { cn } from "@/lib/utils";

type ContentStatus = "pending" | "approved" | "rejected" | "published" | "auto_published" | "flagged";

const ContentQueue = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isNewStoryOpen, setIsNewStoryOpen] = useState(false);
  const [updatingStoryId, setUpdatingStoryId] = useState<string | null>(null);

  // Track drawer state changes for debugging
  useEffect(() => {
    console.log("📦 Drawer state changed:", { selectedStoryId, open: !!selectedStoryId });
  }, [selectedStoryId]);
  const queryClient = useQueryClient();

  const { data: stories, isLoading, error } = useQuery({
    queryKey: ["content-queue", statusFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("content_queue")
        .select(`
          *,
          source:sources(name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ContentStatus;
    }) => {
      console.log("🔄 ContentQueue: Updating status:", id, status);
      setUpdatingStoryId(id);
      
      try {
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
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("❌ Status update failed:", error);
          throw new Error(error.message);
        }

        if (!updated) {
          console.error("❌ No row returned after update - check RLS");
          throw new Error("Update failed - no data returned");
        }

        console.log("✅ Status updated successfully:", updated.status);
        return updated;
      } finally {
        setUpdatingStoryId(null);
      }
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      
      const statusLabel = 
        variables.status === "approved" ? "approved" :
        variables.status === "rejected" ? "rejected" : "published";
      
      toast.success(`Story ${statusLabel}`);

      // Log activity
      const story = stories?.find(s => s.id === variables.id);
      await logActivity({
        entityType: "content",
        entityId: variables.id,
        action: variables.status,
        message: `Story "${story?.title || variables.id}" ${statusLabel}`,
        details: {
          new_status: variables.status,
        },
      });
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
      toast.error(`Failed to update status: ${error.message || "Unknown error"}`);
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
      case "auto_published":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "flagged":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const categories = [
    "all",
    "news",
    "events",
    "dining",
    "real-estate",
    "community",
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading content queue</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load stories. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage AI-generated articles
          </p>
        </div>
        <Button onClick={() => setIsNewStoryOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Story
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="auto_published">Auto-Published</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading stories...
                </TableCell>
              </TableRow>
            ) : !stories || stories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No stories found
                </TableCell>
              </TableRow>
            ) : (
              stories.map((story) => (
                <TableRow key={story.id}>
                  <TableCell className="font-medium max-w-md truncate">
                    {story.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {story.category || "Uncategorized"}
                    </Badge>
                  </TableCell>
                  <TableCell>{story.source?.name || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusColor(story.status)}
                    >
                      {story.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(story.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStoryId(story.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {story.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingStoryId === story.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({
                                id: story.id,
                                status: "approved",
                              });
                            }}
                          >
                            <Check className={cn("h-4 w-4 text-green-500", updatingStoryId === story.id && "animate-pulse")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingStoryId === story.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({
                                id: story.id,
                                status: "rejected",
                              });
                            }}
                          >
                            <X className={cn("h-4 w-4 text-red-500", updatingStoryId === story.id && "animate-pulse")} />
                          </Button>
                        </>
                      )}
                      {story.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingStoryId === story.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatusMutation.mutate({
                              id: story.id,
                              status: "published",
                            });
                          }}
                        >
                          <Upload className={cn("h-4 w-4 text-blue-500", updatingStoryId === story.id && "animate-pulse")} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Drawer */}
      <ContentQueueDetail
        storyId={selectedStoryId}
        open={!!selectedStoryId}
        onOpenChange={(open) => !open && setSelectedStoryId(null)}
      />

      {/* New Story Dialog */}
      <NewStoryDialog
        open={isNewStoryOpen}
        onOpenChange={setIsNewStoryOpen}
      />
    </div>
  );
};

export default ContentQueue;
