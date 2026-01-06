import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Upload,
  Download,
  UserPlus,
  Trash2,
  Filter,
  TrendingUp,
  TrendingDown,
  Mail,
  AlertCircle,
  Tag,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logActivity } from "@/lib/logActivity";

interface SubscriberManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriberManagementModal({ open, onOpenChange }: SubscriberManagementModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [updatingEngagement, setUpdatingEngagement] = useState(false);
  
  // Add form state
  const [newEmail, setNewEmail] = useState("");
  const [newTags, setNewTags] = useState("");

  // Fetch all subscribers with analytics
  const { data: subscribers, isLoading } = useQuery({
    queryKey: ["subscribers-management", searchQuery, statusFilter, tagFilter],
    queryFn: async () => {
      let query = supabase
        .from("subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by search query client-side
      let filtered = data || [];
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        filtered = filtered.filter(s => 
          s.email.toLowerCase().includes(lower)
        );
      }

      // Filter by tag client-side
      if (tagFilter !== "all") {
        filtered = filtered.filter(s => 
          s.tags && s.tags.includes(tagFilter)
        );
      }

      return filtered;
    },
    enabled: open,
  });

  // Fetch unsubscribe analytics
  const { data: unsubStats } = useQuery({
    queryKey: ["unsubscribe-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscribers")
        .select("status, unsubscribe_reason, unsubscribed_at")
        .eq("status", "unsubscribed");

      if (error) throw error;

      const byReason: Record<string, number> = {};
      (data || []).forEach(sub => {
        const reason = sub.unsubscribe_reason || "No reason provided";
        byReason[reason] = (byReason[reason] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        byReason,
        recent: (data || []).slice(0, 10),
      };
    },
    enabled: open,
  });

  // Get unique tags
  const allTags = Array.from(
    new Set(
      (subscribers || [])
        .flatMap(s => s.tags || [])
        .filter(Boolean)
    )
  );

  // Add subscriber mutation
  const addSubscriberMutation = useMutation({
    mutationFn: async ({ email, tags }: { email: string; tags: string[] }) => {
      const { data, error } = await supabase
        .from("subscribers")
        .insert({
          email: email.trim().toLowerCase(),
          status: "active",
          tags,
          source: "manual_admin",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["subscribers-management"] });
      toast.success("Subscriber added successfully!");
      setNewEmail("");
      setNewTags("");
      setShowAddForm(false);
      
      await logActivity({
        entityType: "system",
        entityId: data.id,
        action: "subscriber_added",
        message: `Manually added subscriber: ${data.email}`,
      });
    },
    onError: (error: any) => {
      if (error.message.includes("duplicate")) {
        toast.error("This email is already subscribed");
      } else {
        toast.error("Failed to add subscriber", {
          description: error.message,
        });
      }
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("subscribers")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscribers-management"] });
      toast.success(`Deleted ${selectedIds.size} subscribers`);
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      
      await logActivity({
        entityType: "system",
        action: "subscribers_bulk_deleted",
        message: `Bulk deleted ${selectedIds.size} subscribers`,
        details: { count: selectedIds.size },
      });
    },
    onError: (error: any) => {
      toast.error("Failed to delete subscribers", {
        description: error.message,
      });
    },
  });

  const exportCSV = () => {
    if (!subscribers?.length) {
      toast.error("No subscribers to export");
      return;
    }

    const headers = ["email", "status", "tags", "engagement_score", "subscribed_at", "unsubscribed_at", "source"];
    const rows = subscribers.map(s => [
      s.email,
      s.status,
      (s.tags || []).join(";"),
      s.engagement_score || 0,
      s.subscribed_at,
      s.unsubscribed_at || "",
      s.source || "unknown",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${subscribers.length} subscribers to CSV`);
    logActivity({
      entityType: "system",
      action: "subscribers_exported",
      message: `Exported ${subscribers.length} subscribers to CSV`,
      details: { count: subscribers.length },
    });
  };

  // Update engagement scores
  const updateEngagementScores = async () => {
    setUpdatingEngagement(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-engagement-scores");
      
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["subscribers-management"] });
      toast.success(`Updated engagement scores for ${data.updated} subscribers!`);
      
      await logActivity({
        entityType: "system",
        action: "engagement_scores_updated",
        message: `Updated engagement scores for ${data.updated} subscribers`,
        details: { count: data.updated },
      });
    } catch (error: any) {
      toast.error("Failed to update engagement scores", {
        description: error.message,
      });
    } finally {
      setUpdatingEngagement(false);
    }
  };

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        
        const emailIndex = headers.indexOf("email");
        if (emailIndex === -1) {
          toast.error("CSV must have an 'email' column");
          return;
        }

        const tagsIndex = headers.indexOf("tags");
        const sourceIndex = headers.indexOf("source");

        const toImport = lines.slice(1).map(line => {
          const cols = line.split(",");
          return {
            email: cols[emailIndex]?.trim().toLowerCase(),
            tags: tagsIndex >= 0 ? (cols[tagsIndex]?.split(";").filter(Boolean) || []) : [],
            source: sourceIndex >= 0 ? (cols[sourceIndex]?.trim() || "csv_import") : "csv_import",
            status: "active",
          };
        }).filter(s => s.email && s.email.includes("@"));

        if (toImport.length === 0) {
          toast.error("No valid emails found in CSV");
          return;
        }

        // Bulk insert
        const { data, error } = await supabase
          .from("subscribers")
          .upsert(toImport, { onConflict: "email", ignoreDuplicates: false });

        if (error) throw error;

        await queryClient.invalidateQueries({ queryKey: ["subscribers-management"] });
        toast.success(`Imported ${toImport.length} subscribers!`);
        
        await logActivity({
          entityType: "system",
          action: "subscribers_imported",
          message: `Imported ${toImport.length} subscribers from CSV`,
          details: { count: toImport.length },
        });
      } catch (error: any) {
        toast.error("Failed to import CSV", {
          description: error.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === subscribers?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subscribers?.map(s => s.id) || []));
    }
  };

  const stats = {
    total: subscribers?.length || 0,
    active: subscribers?.filter(s => s.status === "active").length || 0,
    unsubscribed: subscribers?.filter(s => s.status === "unsubscribed").length || 0,
    avgEngagement: subscribers?.length 
      ? Math.round(subscribers.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / subscribers.length)
      : 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Subscriber Management
          </DialogTitle>
          <DialogDescription>
            Manage subscribers, import/export lists, track engagement, and analyze unsubscribes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="list" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Subscribers ({stats.total})</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="unsubscribes">Unsubscribes ({stats.unsubscribed})</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="flex-1 overflow-auto space-y-4 mt-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-muted-foreground">Unsubscribed</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.unsubscribed}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Avg Engagement</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.avgEngagement}</p>
              </Card>
            </div>

            {/* Filters and Actions */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                disabled={!subscribers?.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>

              <Button variant="outline" size="sm" asChild>
                <label>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCSVImport}
                  />
                </label>
              </Button>

              <Button
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Subscriber
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={updateEngagementScores}
                disabled={updatingEngagement}
              >
                {updatingEngagement ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Update Scores
                  </>
                )}
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              )}
            </div>

            {/* Add Form */}
            {showAddForm && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Add New Subscriber</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="subscriber@example.com"
                    />
                  </div>
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="newsletter, vip"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => {
                      const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
                      addSubscriberMutation.mutate({ email: newEmail, tags });
                    }}
                    disabled={!newEmail || addSubscriberMutation.isPending}
                  >
                    {addSubscriberMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Subscriber"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Subscribers Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : subscribers && subscribers.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === subscribers.length}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Subscribed</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(sub.id)}
                            onCheckedChange={() => toggleSelection(sub.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{sub.email}</TableCell>
                        <TableCell>
                          {sub.status === "active" ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Unsubscribed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const count = sub.referral_count || 0;
                            if (count >= 10) return <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500"><Crown className="h-3 w-3 mr-1" />VIP</Badge>;
                            if (count >= 5) return <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">💫 Ambassador</Badge>;
                            if (count >= 3) return <Badge variant="secondary">🌟 Advocate</Badge>;
                            if (count >= 1) return <Badge variant="outline">⭐ Supporter</Badge>;
                            return <span className="text-muted-foreground text-xs">—</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(sub.tags || []).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{sub.engagement_score || 0}</span>
                            {(sub.engagement_score || 0) >= 50 ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(sub.subscribed_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sub.source || "unknown"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No subscribers found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Top Engaged Subscribers</h3>
                <div className="space-y-2">
                  {subscribers
                    ?.slice()
                    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
                    .slice(0, 10)
                    .map((sub) => (
                      <div key={sub.id} className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="truncate max-w-xs">{sub.email}</span>
                        <Badge variant="outline">{sub.engagement_score || 0}</Badge>
                      </div>
                    ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Subscribers by Tag</h3>
                <div className="space-y-2">
                  {allTags.map(tag => {
                    const count = subscribers?.filter(s => s.tags?.includes(tag)).length || 0;
                    return (
                      <div key={tag} className="flex justify-between items-center text-sm border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <span>{tag}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    );
                  })}
                  {allTags.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tags defined yet</p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="unsubscribes" className="flex-1 overflow-auto space-y-4 mt-4">
            {unsubStats ? (
              <>
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Unsubscribe Reasons</h3>
                  <div className="space-y-2">
                    {Object.entries(unsubStats.byReason)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <div key={reason} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="flex-1">{reason}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Recent Unsubscribes</h3>
                  <div className="space-y-2">
                    {unsubStats.recent.map((sub: any) => (
                      <div key={sub.id} className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="truncate max-w-xs">{sub.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sub.unsubscribed_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No unsubscribe data yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Subscribers?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the selected subscribers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
