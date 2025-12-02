import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/queryWithTimeout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, CheckCircle2, Target } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Lead = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  notes: string | null;
  source: string;
  status: string;
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

const statusColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 border-gray-200",
  contacted: "bg-blue-100 text-blue-700 border-blue-200",
  interested: "bg-amber-100 text-amber-700 border-amber-200",
  won: "bg-green-100 text-green-700 border-green-200",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};

const Leads = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch all leads
  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("advertiser_leads")
          .select("*")
          .order("created_at", { ascending: false })
          .then(res => res),
        15000
      );

      if (result.error) throw result.error;
      return result.data as Lead[];
    },
    retry: 2,
    staleTime: 30000,
  });

  // Update lead status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("advertiser_leads")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead status updated");
    },
  });

  // Update lead notes
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("advertiser_leads")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Notes updated");
      setSelectedLead(null);
    },
  });

  // Calculate metrics
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const newLeadsCount = leads.filter(
    (lead) => new Date(lead.created_at) >= sevenDaysAgo
  ).length;

  const activeLeadsCount = leads.filter((lead) =>
    ["new", "contacted", "interested"].includes(lead.status)
  ).length;

  const wonThisMonth = leads.filter(
    (lead) =>
      lead.status === "won" && new Date(lead.updated_at) >= startOfMonth
  ).length;

  const conversionRate =
    leads.length > 0 ? ((wonThisMonth / leads.length) * 100).toFixed(1) : "0";

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;
    const matchesSearch =
      !searchQuery ||
      lead.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSource && matchesSearch;
  });

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setEditNotes(lead.notes || "");
  };

  const handleSaveNotes = () => {
    if (!selectedLead) return;
    updateNotesMutation.mutate({
      id: selectedLead.id,
      notes: editNotes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads Pipeline</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage advertiser inquiries and track your sales pipeline
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                New (7 days)
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {newLeadsCount}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Active Leads
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {activeLeadsCount}
              </p>
            </div>
            <Users className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Won (This Month)
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {wonThisMonth}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Conversion Rate
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {conversionRate}%
              </p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search business, contact, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="advertise_page">Advertise Page</SelectItem>
              <SelectItem value="directory">Directory</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Leads Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 flex flex-col items-center gap-3 text-gray-500">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <span>Loading leads...</span>
            <button 
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Taking too long? Click to retry
            </button>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No leads found. Adjust your filters or wait for new inquiries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleLeadClick(lead)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {lead.business_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {lead.contact_name}
                      </div>
                      <div className="text-xs text-gray-500">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 capitalize">
                        {lead.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`capitalize ${statusColors[lead.status]}`}
                      >
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getRelativeTime(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={lead.status}
                        onValueChange={(status) =>
                          updateStatusMutation.mutate({ id: lead.id, status })
                        }
                      >
                        <SelectTrigger className="w-[120px]" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lead Details Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedLead?.business_name}
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Contact Name
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.contact_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Email
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.email}</p>
                </div>
                {selectedLead.phone && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Phone
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{selectedLead.phone}</p>
                  </div>
                )}
                {selectedLead.website && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Website
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      <a
                        href={selectedLead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-accent hover:underline"
                      >
                        {selectedLead.website}
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Source
                  </label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">
                    {selectedLead.source.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Status
                  </label>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`capitalize ${statusColors[selectedLead.status]}`}
                    >
                      {selectedLead.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Created
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedLead.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Last Updated
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {getRelativeTime(selectedLead.updated_at)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Notes
                </label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                  placeholder="Add notes about this lead..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLead(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNotes}
                  disabled={updateNotesMutation.isPending}
                >
                  {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
