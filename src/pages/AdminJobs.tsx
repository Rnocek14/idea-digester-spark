import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Briefcase, Clock, CheckCircle2, XCircle, Star, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type JobListing = {
  id: string;
  business_id: string | null;
  business_name: string;
  title: string;
  category: string;
  job_type: string;
  description: string;
  location_text: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string | null;
  pay_display: string | null;
  contact_email: string;
  contact_phone: string | null;
  apply_url: string | null;
  is_featured: boolean;
  pricing_tier: string;
  payment_status: string;
  status: string;
  expires_at: string;
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
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
  expired: "bg-gray-100 text-gray-700 border-gray-200",
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-600 border-gray-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  comped: "bg-blue-100 text-blue-700 border-blue-200",
};

const AdminJobs = () => {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const queryClient = useQueryClient();

  // Fetch all jobs
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_listings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JobListing[];
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Update job status
  const updateJobMutation = useMutation({
    mutationFn: async (updates: { id: string; status?: string; is_featured?: boolean; payment_status?: string }) => {
      const { id, ...data } = updates;
      const { error } = await supabase
        .from("job_listings")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job updated");
    },
  });

  // Calculate metrics
  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const approvedCount = jobs.filter(j => j.status === 'approved').length;
  const featuredCount = jobs.filter(j => j.is_featured && j.status === 'approved').length;
  const paidCount = jobs.filter(j => j.payment_status === 'paid').length;

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || job.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      job.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const categories = [...new Set(jobs.map(j => j.category))].sort();

  const handleApprove = (job: JobListing) => {
    updateJobMutation.mutate({ id: job.id, status: 'approved' });
  };

  const handleReject = (job: JobListing) => {
    updateJobMutation.mutate({ id: job.id, status: 'rejected' });
  };

  const handleToggleFeatured = (job: JobListing) => {
    updateJobMutation.mutate({ id: job.id, is_featured: !job.is_featured });
  };

  const formatPay = (job: JobListing) => {
    if (job.pay_display) return job.pay_display;
    if (job.pay_min && job.pay_max) {
      return `$${job.pay_min}-${job.pay_max}/${job.pay_type || 'hr'}`;
    }
    if (job.pay_min) return `From $${job.pay_min}/${job.pay_type || 'hr'}`;
    return 'DOE';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Job Listings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage job submissions from local businesses
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Pending Review
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {pendingCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Active Jobs
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {approvedCount}
              </p>
            </div>
            <Briefcase className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Featured
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {featuredCount}
              </p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Paid
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {paidCount}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search business or job title..."
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Jobs Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <span>Loading jobs...</span>
            <button 
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Taking too long? Click to retry
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No job listings found. Adjust your filters or wait for new submissions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pay
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                        <span className="font-medium text-foreground">{job.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{job.job_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{job.business_name}</div>
                      {job.location_text && (
                        <div className="text-xs text-muted-foreground">{job.location_text}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground capitalize">{job.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{formatPay(job)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={`capitalize ${statusColors[job.status]}`}>
                          {job.status}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${paymentColors[job.payment_status]}`}>
                          {job.payment_status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getRelativeTime(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {job.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(job)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50"
                              onClick={() => handleReject(job)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className={job.is_featured ? "text-yellow-600 bg-yellow-50" : ""}
                          onClick={() => handleToggleFeatured(job)}
                        >
                          <Star className={`h-4 w-4 ${job.is_featured ? 'fill-yellow-500' : ''}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {selectedJob?.is_featured && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
              {selectedJob?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={statusColors[selectedJob.status]}>
                  {selectedJob.status}
                </Badge>
                <Badge variant="outline" className={paymentColors[selectedJob.payment_status]}>
                  {selectedJob.payment_status}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {selectedJob.pricing_tier}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Business
                  </label>
                  <p className="mt-1 text-sm text-foreground">{selectedJob.business_name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Category
                  </label>
                  <p className="mt-1 text-sm text-foreground capitalize">{selectedJob.category}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Job Type
                  </label>
                  <p className="mt-1 text-sm text-foreground capitalize">{selectedJob.job_type}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pay
                  </label>
                  <p className="mt-1 text-sm text-foreground">{formatPay(selectedJob)}</p>
                </div>
                {selectedJob.location_text && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Location
                    </label>
                    <p className="mt-1 text-sm text-foreground">{selectedJob.location_text}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Expires
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {format(new Date(selectedJob.expires_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </label>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Contact Information</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="text-sm text-foreground">{selectedJob.contact_email}</p>
                  </div>
                  {selectedJob.contact_phone && (
                    <div>
                      <label className="text-xs text-muted-foreground">Phone</label>
                      <p className="text-sm text-foreground">{selectedJob.contact_phone}</p>
                    </div>
                  )}
                  {selectedJob.apply_url && (
                    <div className="sm:col-span-2">
                      <label className="text-xs text-muted-foreground">Apply URL</label>
                      <a 
                        href={selectedJob.apply_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline block"
                      >
                        {selectedJob.apply_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                {selectedJob.status === 'pending' && (
                  <>
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleApprove(selectedJob);
                        setSelectedJob(null);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => {
                        handleReject(selectedJob);
                        setSelectedJob(null);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  className={selectedJob.is_featured ? "border-yellow-500 bg-yellow-50" : ""}
                  onClick={() => {
                    handleToggleFeatured(selectedJob);
                    setSelectedJob({ ...selectedJob, is_featured: !selectedJob.is_featured });
                  }}
                >
                  <Star className={`h-4 w-4 mr-2 ${selectedJob.is_featured ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  {selectedJob.is_featured ? 'Remove Featured' : 'Make Featured'}
                </Button>
                <Select
                  value={selectedJob.payment_status}
                  onValueChange={(value) => {
                    updateJobMutation.mutate({ id: selectedJob.id, payment_status: value });
                    setSelectedJob({ ...selectedJob, payment_status: value });
                  }}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="comped">Comped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminJobs;
