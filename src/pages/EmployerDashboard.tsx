import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Briefcase, Mail, Clock, CheckCircle, XCircle, AlertCircle, Loader2, MousePointerClick, Globe, Newspaper, RefreshCw, CalendarClock, Pencil } from "lucide-react";
import JobClickTrendsChart from "@/components/JobClickTrendsChart";
import EditJobDialog from "@/components/EditJobDialog";
import EmailPreferencesCard from "@/components/EmailPreferencesCard";

interface ClickBreakdown {
  total: number;
  website: number;
  newsletter: number;
}

interface JobListing {
  id: string;
  title: string;
  business_name: string;
  category: string;
  job_type: string;
  status: string;
  payment_status: string;
  is_featured: boolean;
  created_at: string;
  expires_at: string;
  pay_display: string | null;
  location_text: string | null;
  description: string;
  contact_email: string;
  contact_phone: string | null;
  apply_url: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending Review", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Live", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-800" },
  expired: { label: "Expired", icon: AlertCircle, color: "bg-muted text-muted-foreground" },
};

export default function EmployerDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get("token");
  
  const [email, setEmail] = useState("");
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [validatedEmail, setValidatedEmail] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<JobListing | null>(null);

  // Validate token on load
  const { data: tokenData, isLoading: isValidating } = useQuery({
    queryKey: ["employer-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("employer_access_tokens")
        .select("email, expires_at, used_at")
        .eq("token", token)
        .single();

      if (error || !data) return null;
      
      // Check if expired
      if (new Date(data.expires_at) < new Date()) return null;
      
      return data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (tokenData?.email) {
      setValidatedEmail(tokenData.email);
      
      // Mark token as used if first use
      if (!tokenData.used_at) {
        supabase
          .from("employer_access_tokens")
          .update({ used_at: new Date().toISOString() })
          .eq("token", token)
          .then();
      }
    }
  }, [tokenData, token]);

  // Fetch jobs for validated email
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["employer-jobs", validatedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_listings")
        .select("*")
        .eq("contact_email", validatedEmail!.toLowerCase())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JobListing[];
    },
    enabled: !!validatedEmail,
  });

  // Fetch click counts with source breakdown for all jobs
  const { data: clickData } = useQuery({
    queryKey: ["employer-job-clicks", jobs?.map(j => j.id)],
    queryFn: async () => {
      if (!jobs || jobs.length === 0) return { byJob: {}, totals: { total: 0, website: 0, newsletter: 0 } };
      
      const jobIds = jobs.map(j => j.id);
      const { data, error } = await supabase
        .from("job_clicks")
        .select("job_id, source")
        .in("job_id", jobIds);

      if (error) throw error;
      
      // Count clicks per job with source breakdown
      const byJob: Record<string, ClickBreakdown> = {};
      const totals: ClickBreakdown = { total: 0, website: 0, newsletter: 0 };
      
      data.forEach(click => {
        if (!byJob[click.job_id]) {
          byJob[click.job_id] = { total: 0, website: 0, newsletter: 0 };
        }
        byJob[click.job_id].total++;
        totals.total++;
        
        if (click.source === "newsletter") {
          byJob[click.job_id].newsletter++;
          totals.newsletter++;
        } else {
          byJob[click.job_id].website++;
          totals.website++;
        }
      });
      
      return { byJob, totals };
    },
    enabled: !!jobs && jobs.length > 0,
  });

  // Request magic link mutation
  const requestLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.functions.invoke("send-employer-magic-link", {
        body: { email },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Check your email for the access link!");
      setEmail("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send access link");
    },
  });

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsRequestingLink(true);
    await requestLinkMutation.mutateAsync(email);
    setIsRequestingLink(false);
  };

  // Renew job mutation
  const renewJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await supabase.functions.invoke("renew-job-listing", {
        body: { job_id: jobId, token, days: 30 },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Job listing renewed successfully!");
      queryClient.invalidateQueries({ queryKey: ["employer-jobs", validatedEmail] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to renew job listing");
    },
  });

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Show login form if no valid token
  if (!token || (token && !isValidating && !tokenData)) {
    return (
      <PageShell>
        <div className="container max-w-md mx-auto py-16 px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Employer Dashboard</CardTitle>
              <CardDescription>
                Enter your email to access your job listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestLink} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isRequestingLink || !email.trim()}
                >
                  {isRequestingLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    "Send Access Link"
                  )}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-4">
                A secure link will be sent to your email if you have job listings with us.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Show loading while validating
  if (isValidating) {
    return (
      <PageShell>
        <div className="container max-w-4xl mx-auto py-16 px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Validating access...</p>
        </div>
      </PageShell>
    );
  }

  // Main dashboard
  return (
    <PageShell>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Your Job Listings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your job postings on Lake Geneva Media
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{jobs?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Total Listings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {jobs?.filter(j => j.status === "approved").length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">
                {jobs?.filter(j => j.status === "pending").length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {jobs?.filter(j => j.is_featured).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Featured</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600 flex items-center gap-1">
                <MousePointerClick className="h-5 w-5" />
                {clickData?.totals.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total Clicks</p>
            </CardContent>
          </Card>
        </div>

        {/* Click Source Breakdown */}
        {clickData && clickData.totals.total > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Click Sources</CardTitle>
              <CardDescription>Where your job listing clicks are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{clickData.totals.website}</span>
                  <span className="text-muted-foreground text-sm">from Website</span>
                  <span className="text-muted-foreground text-xs">
                    ({clickData.totals.total > 0 ? Math.round((clickData.totals.website / clickData.totals.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">{clickData.totals.newsletter}</span>
                  <span className="text-muted-foreground text-sm">from Newsletter</span>
                  <span className="text-muted-foreground text-xs">
                    ({clickData.totals.total > 0 ? Math.round((clickData.totals.newsletter / clickData.totals.total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Click Trends Chart */}
        {jobs && jobs.length > 0 && (
          <div className="mb-8">
            <JobClickTrendsChart 
              jobIds={jobs.filter(j => j.status === "approved").map(j => j.id)}
              jobTitles={Object.fromEntries(jobs.map(j => [j.id, j.title]))}
            />
          </div>
        )}

        {/* Jobs List */}
        {isLoadingJobs ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : jobs && jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => {
              const config = statusConfig[job.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const daysLeft = getDaysUntilExpiry(job.expires_at);
              const isExpired = daysLeft <= 0;

              return (
                <Card key={job.id} className={isExpired ? "opacity-60" : ""}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{job.title}</h3>
                          {job.is_featured && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              Featured
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">{job.business_name}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">{job.category}</Badge>
                          <Badge variant="outline">{job.job_type}</Badge>
                          {job.location_text && (
                            <Badge variant="outline">{job.location_text}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {isExpired ? "Expired" : config.label}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-purple-600 font-medium flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" />
                            {clickData?.byJob[job.id]?.total || 0}
                          </span>
                          {clickData?.byJob[job.id]?.total > 0 && (
                            <span className="text-muted-foreground">
                              (<Globe className="h-3 w-3 inline" /> {clickData.byJob[job.id].website} · 
                              <Newspaper className="h-3 w-3 inline ml-1" /> {clickData.byJob[job.id].newsletter})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Posted {getRelativeTime(job.created_at)}
                        </p>
                        {!isExpired && job.status === "approved" && (
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            daysLeft <= 3 
                              ? "text-red-600" 
                              : daysLeft <= 7 
                                ? "text-amber-600" 
                                : "text-green-600"
                          }`}>
                            <CalendarClock className="h-3 w-3" />
                            {daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
                          </div>
                        )}
                        {isExpired && (
                          <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                            <CalendarClock className="h-3 w-3" />
                            Expired {Math.abs(daysLeft)} {Math.abs(daysLeft) === 1 ? "day" : "days"} ago
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingJob(job)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          {(isExpired || (daysLeft <= 7 && daysLeft > 0)) && (
                            <Button
                              size="sm"
                              variant={isExpired ? "default" : "outline"}
                              onClick={() => renewJobMutation.mutate(job.id)}
                              disabled={renewJobMutation.isPending}
                            >
                              {renewJobMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1" />
                              )}
                              {isExpired ? "Renew" : "Extend"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Job Listings Found</h3>
              <p className="text-muted-foreground mb-4">
                You haven't posted any jobs yet.
              </p>
              <Button onClick={() => navigate("/jobs/post")}>
                Post Your First Job
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Email Preferences */}
        {validatedEmail && (
          <div className="mt-8">
            <EmailPreferencesCard email={validatedEmail} />
          </div>
        )}

        {/* Post New Job CTA */}
        {jobs && jobs.length > 0 && (
          <div className="mt-8 text-center">
            <Button onClick={() => navigate("/jobs/post")} size="lg">
              Post Another Job
            </Button>
          </div>
        )}

        {/* Edit Job Dialog */}
        <EditJobDialog
          job={editingJob}
          open={!!editingJob}
          onOpenChange={(open) => !open && setEditingJob(null)}
          employerEmail={validatedEmail || ""}
        />
      </div>
    </PageShell>
  );
}
