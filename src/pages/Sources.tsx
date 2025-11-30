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

  const { data: sources, isLoading, error: sourcesError } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      console.log("🔍 Fetching sources...");
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("📊 Sources query result:", { data, error });
      if (error) {
        console.error("❌ Sources query error:", error);
        throw error;
      }
      console.log("✅ Sources loaded:", data?.length || 0);
      return data;
    },
    retry: 1,
  });
  
  // Log error if query failed
  if (sourcesError) {
    console.error("❌ Sources query failed:", sourcesError);
  }

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
      // Check if sources already exist
      const { count, error: countError } = await supabase
        .from("sources")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error(`${count} sources already exist. Delete existing sources first to re-seed.`);
      }

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
      console.error("❌ Seed mutation error:", error);
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

  const backfillSafetyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-safety");
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast.success(`Safety analysis complete: ${data.analyzed} articles analyzed`);
      
      if (data.failed > 0) {
        toast.warning(`${data.failed} articles failed analysis`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to backfill safety data");
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

  const { data: rulesCount, isLoading: isLoadingRulesCount } = useQuery({
    queryKey: ["auto-publish-rules-count"],
    queryFn: async () => {
      console.log("🔍 Fetching auto-publish rules count...");
      const { count, error } = await supabase
        .from("auto_publish_rules")
        .select("*", { count: "exact", head: true });
      
      console.log("📊 Rules count result:", { count, error });
      if (error) {
        console.error("❌ Rules count error:", error);
        throw error;
      }
      return count || 0;
    },
  });

  const { data: activeRules } = useQuery({
    queryKey: ["auto-publish-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_publish_rules")
        .select("*, sources(name)")
        .eq("enabled", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: (rulesCount ?? 0) > 0,
  });

  const seedAutoPublishRulesMutation = useMutation({
    mutationFn: async () => {
      console.log("🌱 Starting auto-publish rules seeding...");
      
      const rules = [
        {
          source_id: 'b219479c-5c29-49d0-82df-adaa230e8761', // Visit Lake Geneva
          category: 'events',
          action: 'auto_publish'
        },
        {
          source_id: 'b36bbc11-b579-4b69-bd23-751612c6c1d7', // Walworth County
          category: 'community', 
          action: 'auto_publish'
        },
        {
          source_id: null, // Global rule
          category: 'news',
          action: 'needs_review'
        }
      ];
      
      console.log("📝 Rules to insert:", rules);
      
      const { data, error } = await supabase
        .from("auto_publish_rules")
        .insert(rules)
        .select();
      
      console.log("📊 Insert result:", { data, error, count: data?.length });
      
      if (error) {
        console.error("❌ Insert error:", error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.error("❌ No rows inserted - possible RLS issue");
        throw new Error("No rows inserted. Check RLS policies and authentication.");
      }
      
      console.log("✅ Successfully inserted", data.length, "rules");
      return data.length;
    },
    onSuccess: async (count) => {
      console.log("🎉 Mutation success, invalidating queries...");
      queryClient.invalidateQueries({ queryKey: ["auto-publish-rules-count"] });
      queryClient.invalidateQueries({ queryKey: ["auto-publish-rules"] });
      toast.success(`Seeded ${count} auto-publish rules`);
      
      try {
        await logActivity({
          entityType: "system",
          entityId: null,
          action: "rules_seeded",
          message: `Seeded ${count} auto-publish rules for Lake Geneva sources`,
          details: { count }
        });
      } catch (logError) {
        console.error("⚠️ Failed to log activity:", logError);
        // Don't fail the mutation just because logging failed
      }
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
      toast.error(error.message || "Failed to seed rules");
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      console.log("🔄 Toggling source status:", { id, currentStatus });
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      
      try {
        const { error, count } = await supabase
          .from("sources")
          .update({ status: newStatus })
          .eq("id", id);

        if (error) {
          console.error("❌ Toggle failed:", error);
          throw new Error(error.message || "Database update failed");
        }
        
        // Verify the update actually happened
        if (count === 0) {
          throw new Error("No rows updated - check permissions");
        }
        
        console.log("✅ Toggle succeeded, rows updated:", count);
        return newStatus;
      } catch (err: any) {
        console.error("❌ Toggle exception:", err);
        throw err;
      }
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
          {(rulesCount === 0 || rulesCount === undefined) && !isLoadingRulesCount && (
            <Button
              variant="outline"
              onClick={() => seedAutoPublishRulesMutation.mutate()}
              disabled={seedAutoPublishRulesMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {seedAutoPublishRulesMutation.isPending ? "Seeding..." : "Seed Auto-Publish Rules"}
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
          <Button
            variant="outline"
            onClick={() => backfillSafetyMutation.mutate()}
            disabled={backfillSafetyMutation.isPending}
          >
            <Sparkles className={`h-4 w-4 mr-2 ${backfillSafetyMutation.isPending ? "animate-pulse" : ""}`} />
            {backfillSafetyMutation.isPending ? "Analyzing..." : "Backfill Safety"}
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Sources Table */}
      <div className="border rounded-lg bg-card">
        {sourcesError && (
          <div className="p-8 text-center text-destructive">
            <p className="font-semibold">Failed to load sources</p>
            <p className="text-sm mt-2">{(sourcesError as any)?.message || "Unknown error"}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["sources"] })}
            >
              Retry
            </Button>
          </div>
        )}
        {!sourcesError && (
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
                        disabled={toggleStatusMutation.isPending}
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
        )}
      </div>

      {/* Auto-Publish Rules Display */}
      {(rulesCount ?? 0) > 0 && activeRules && (
        <div className="border rounded-lg bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Active Auto-Publish Rules</h3>
          <div className="space-y-3">
            {activeRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="capitalize">
                    {rule.category || "All"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {rule.source_id 
                      ? `From: ${(rule.sources as any)?.name || "Unknown Source"}`
                      : "Global rule"}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={rule.action === 'auto_publish' 
                    ? "bg-green-500/10 text-green-500 border-green-500/20" 
                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}
                >
                  {rule.action === 'auto_publish' ? 'Auto-Publish' : 'Needs Review'}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {rulesCount} {rulesCount === 1 ? 'rule' : 'rules'} configured • Events auto-publish, News needs review
          </p>
        </div>
      )}

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