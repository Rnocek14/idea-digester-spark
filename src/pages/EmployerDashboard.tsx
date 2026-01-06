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
import { Briefcase, Mail, Clock, CheckCircle, XCircle, AlertCircle, Eye, Loader2 } from "lucide-react";

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        </div>

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
                        <p className="text-xs text-muted-foreground">
                          Posted {getRelativeTime(job.created_at)}
                        </p>
                        {!isExpired && job.status === "approved" && (
                          <p className="text-xs text-muted-foreground">
                            {daysLeft} days remaining
                          </p>
                        )}
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

        {/* Post New Job CTA */}
        {jobs && jobs.length > 0 && (
          <div className="mt-8 text-center">
            <Button onClick={() => navigate("/jobs/post")} size="lg">
              Post Another Job
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
