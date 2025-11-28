import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Power, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SourceDialog } from "@/components/SourceDialog";
import { format, formatDistanceToNow } from "date-fns";
import { logActivity } from "@/lib/logActivity";

const Sources = () => {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const fixScrapeSelectorMutation = useMutation({
    mutationFn: async () => {
      console.log("🔧 Attempting to fix scrape selector...");
      
      const { data: scrapeSource, error: fetchError } = await supabase
        .from("sources")
        .select("*")
        .eq("type", "scrape")
        .eq("name", "Visit Lake Geneva – Events")
        .single();

      if (fetchError) {
        console.error("❌ Failed to fetch source:", fetchError);
        throw new Error(`Failed to fetch source: ${fetchError.message}`);
      }
      if (!scrapeSource) {
        throw new Error("Scrape source not found");
      }

      console.log("📝 Current metadata:", scrapeSource.metadata);

      const currentMetadata = (scrapeSource.metadata || {}) as Record<string, any>;
      const updatedMetadata = {
        ...currentMetadata,
        scrape_selector: "article.slide"
      };

      console.log("📝 Updating to new metadata:", updatedMetadata);

      const { error: updateError } = await supabase
        .from("sources")
        .update({ metadata: updatedMetadata })
        .eq("id", scrapeSource.id);

      if (updateError) {
        console.error("❌ Failed to update source:", updateError);
        throw new Error(`Failed to update: ${updateError.message}. Check console for auth status.`);
      }
      
      console.log("✅ Successfully updated scrape selector");
      return scrapeSource.id;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Updated scrape selector to 'article.slide' - triggering sync...");
      
      // Automatically trigger sync after fixing selector
      setTimeout(() => {
        syncRssMutation.mutate();
      }, 500);
    },
    onError: (error: any) => {
      console.error("❌ Fix mutation error:", error);
      toast.error(`Fix failed: ${error.message}. The edge function will auto-fix on next sync.`);
    },
  });

  const seedSampleSourcesMutation = useMutation({
    mutationFn: async () => {
      const sampleSources = [
        {
          name: "City of Lake Geneva – Civic Alerts",
          type: "rss",
          url: "https://www.cityoflakegeneva.gov/rss.aspx",
          category: "news",
          status: "active",
          fetch_frequency_minutes: 60,
          metadata: { location_tags: ["Lake Geneva"] },
        },
        {
          name: "Walworth County Community News – Lake Geneva",
          type: "rss",
          url: "https://walworthcountycommunitynews.com/feed/",
          category: "news",
          status: "active",
          fetch_frequency_minutes: 60,
          metadata: { location_tags: ["Lake Geneva"] },
        },
        {
          name: "Visit Lake Geneva – Events",
          type: "scrape",
          url: "https://www.visitlakegeneva.com/events/",
          category: "events",
          status: "active",
          fetch_frequency_minutes: 120,
          metadata: { location_tags: ["Lake Geneva"], scrape_selector: "article.slide" },
        },
      ];

      const { error } = await supabase.from("sources").insert(sampleSources);
      if (error) throw error;
      return sampleSources.length;
    },
    onSuccess: async (count) => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(`Successfully seeded ${count} Lake Geneva sources`);

      await logActivity({
        entityType: "source",
        entityId: null,
        action: "seeded",
        message: `Seeded ${count} sample Lake Geneva sources`,
        details: { count },
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to seed sample sources");
    },
  });

  const syncRssMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rss");
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
      
      toast.success(
        `RSS sync completed: ${data.articlesInserted} articles added, ${data.skipped} skipped`
      );
      
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} errors occurred during sync`);
        console.log("Sync errors:", data.errors);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync RSS feeds");
    },
  });

  const { data: lastSync } = useQuery({
    queryKey: ["last-sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("action", "rss_sync")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      console.log("🔄 Toggling source status:", { id, currentStatus });
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      
      const { data, error } = await supabase
        .from("sources")
        .update({ status: newStatus })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("❌ Toggle failed:", error);
        throw error;
      }
      
      console.log("✅ Toggle succeeded:", data);
      return newStatus;
    },
    onSuccess: async (newStatus, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(`Source ${newStatus === "active" ? "activated" : "deactivated"}`);

      // Log activity
      const source = sources?.find(s => s.id === variables.id);
      await logActivity({
        entityType: "source",
        entityId: variables.id,
        action: "status_changed",
        message: `Source "${source?.name || variables.id}" ${newStatus === "active" ? "activated" : "deactivated"}`,
        details: {
          old_status: variables.currentStatus,
          new_status: newStatus,
        },
      });
    },
    onError: (error: any) => {
      console.error("❌ Toggle mutation error:", error);
      toast.error(`Failed to update: ${error.message || "Unknown error"}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "inactive":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "rss":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "api":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "scrape":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleEdit = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedSourceId(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Sources</h1>
          <p className="text-muted-foreground mt-2">
            Manage RSS feeds, APIs, and web scraping sources
          </p>
          {lastSync && (
            <p className="text-sm text-muted-foreground mt-1">
              Last synced {formatDistanceToNow(new Date(lastSync.created_at), { addSuffix: true })} •{" "}
              {(lastSync.details as any)?.articlesInserted || 0} articles added
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(!sources || sources.length === 0) && (
            <Button
              variant="outline"
              onClick={() => seedSampleSourcesMutation.mutate()}
              disabled={seedSampleSourcesMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {seedSampleSourcesMutation.isPending ? "Seeding..." : "Seed Lake Geneva Sources"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => fixScrapeSelectorMutation.mutate()}
            disabled={fixScrapeSelectorMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {fixScrapeSelectorMutation.isPending ? "Fixing..." : "Fix & Test Scraper"}
          </Button>
          <Button
            variant="outline"
            onClick={() => syncRssMutation.mutate()}
            disabled={syncRssMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncRssMutation.isPending ? "animate-spin" : ""}`} />
            {syncRssMutation.isPending ? "Syncing..." : "Sync RSS Now"}
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Sources Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Last Fetched</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading sources...
                </TableCell>
              </TableRow>
            ) : !sources || sources.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No sources configured yet. Add your first source to start ingesting content.
                </TableCell>
              </TableRow>
            ) : (
              sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeColor(source.type)}>
                      {source.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {source.category || "Uncategorized"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusColor(source.status)}
                    >
                      {source.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {source.url}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {source.last_fetched_at
                      ? format(new Date(source.last_fetched_at), "MMM d, yyyy HH:mm")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(source.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: source.id,
                            currentStatus: source.status,
                          })
                        }
                      >
                        <Power
                          className={`h-4 w-4 ${
                            source.status === "active"
                              ? "text-green-500"
                              : "text-gray-500"
                          }`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <SourceDialog
        sourceId={selectedSourceId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

export default Sources;