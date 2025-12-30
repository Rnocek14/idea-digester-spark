import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Briefcase, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";

type JobListing = {
  id: string;
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
  apply_url: string | null;
  is_featured: boolean;
  created_at: string;
  expires_at: string;
};

const CATEGORIES = [
  { value: "all", label: "All Jobs" },
  { value: "hospitality", label: "Hospitality" },
  { value: "retail", label: "Retail" },
  { value: "services", label: "Services" },
  { value: "trades", label: "Trades" },
  { value: "seasonal", label: "Seasonal" },
];

const JOB_TYPES = [
  { value: "all", label: "All Types" },
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "seasonal", label: "Seasonal" },
  { value: "contract", label: "Contract" },
];

const Jobs = () => {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_listings")
        .select("*")
        .eq("status", "approved")
        .gt("expires_at", new Date().toISOString())
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JobListing[];
    },
    staleTime: 60000,
  });

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesCategory = categoryFilter === "all" || job.category === categoryFilter;
    const matchesType = typeFilter === "all" || job.job_type === typeFilter;
    const matchesSearch =
      !searchQuery ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  const featuredJobs = filteredJobs.filter(j => j.is_featured);
  const regularJobs = filteredJobs.filter(j => !j.is_featured);

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Now Hiring in Lake Geneva
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Local work opportunities from Lake Geneva area businesses. 
            Find your next job in hospitality, retail, services, and more.
          </p>
        </div>

        {/* CTA for employers */}
        <Card className="p-6 mb-8 bg-primary/5 border-primary/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Hiring locally?</h3>
              <p className="text-sm text-muted-foreground">
                Post your job to reach Lake Geneva area job seekers
              </p>
            </div>
            <Button asChild>
              <Link to="/jobs/post">
                <Plus className="h-4 w-4 mr-2" />
                Post a Job
              </Link>
            </Button>
          </div>
        </Card>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={categoryFilter === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Job type filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {JOB_TYPES.map((type) => (
            <Button
              key={type.value}
              variant={typeFilter === type.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter(type.value)}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-muted-foreground">
          {isLoading ? (
            "Loading jobs..."
          ) : (
            <>
              <span className="font-medium text-foreground">{filteredJobs.length}</span>
              {filteredJobs.length === 1 ? " job" : " jobs"} available
            </>
          )}
        </div>

        {/* Jobs grid */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            <span>Loading local jobs...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="p-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No jobs found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || categoryFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters to see more jobs."
                : "Check back soon for new opportunities!"}
            </p>
            <Button asChild variant="outline">
              <Link to="/jobs/post">Post a Job</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Featured jobs */}
            {featuredJobs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="text-yellow-500">★</span> Featured Positions
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {featuredJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular jobs */}
            {regularJobs.length > 0 && (
              <div>
                {featuredJobs.length > 0 && (
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    All Positions
                  </h2>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {regularJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom CTA */}
        <Card className="mt-12 p-8 text-center bg-muted/50">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Are you hiring?
          </h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Reach local job seekers in the Lake Geneva area. 
            Listings start at $50 for 30 days.
          </p>
          <Button asChild size="lg">
            <Link to="/jobs/post">
              <Plus className="h-4 w-4 mr-2" />
              Post Your Job
            </Link>
          </Button>
        </Card>
      </div>
    </PageShell>
  );
};

export default Jobs;
