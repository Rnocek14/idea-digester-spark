import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, MapPin, CheckCircle, AlertCircle, Info } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { PageMeta } from "@/components/PageMeta";
import IncidentStatusControls from "@/components/IncidentStatusControls";
import TipSubmissionForm from "@/components/TipSubmissionForm";
import { ShareButtons } from "@/components/ShareButtons";

type Incident = {
  id: string;
  slug: string;
  title: string;
  incident_type: string;
  status: string;
  location: string | null;
  started_at: string;
  updated_at: string;
  priority_score: number;
};

type IncidentUpdate = {
  id: string;
  created_at: string;
  source: string;
  source_label: string | null;
  text: string;
  is_verified: boolean;
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  active: { color: "text-red-600", icon: <AlertCircle className="h-5 w-5" />, label: "🔴 Active" },
  monitoring: { color: "text-yellow-600", icon: <Info className="h-5 w-5" />, label: "🟡 Monitoring" },
  resolved: { color: "text-green-600", icon: <CheckCircle className="h-5 w-5" />, label: "🟢 Resolved" },
  false_alarm: { color: "text-muted-foreground", icon: <Info className="h-5 w-5" />, label: "False Alarm" },
};

export default function IncidentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      
      const hasAdmin = roles?.some(r => r.role === "admin");
      setIsAdmin(!!hasAdmin);
    };
    
    checkAdmin();
  }, []);

  const { data: incident, isLoading: incidentLoading } = useQuery({
    queryKey: ["incident", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data as Incident | null;
    },
    enabled: !!slug,
  });

  const { data: updates, isLoading: updatesLoading } = useQuery({
    queryKey: ["incident-updates", incident?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_updates")
        .select("*")
        .eq("incident_id", incident!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as IncidentUpdate[];
    },
    enabled: !!incident?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return formatDate(dateString);
  };

  const isLoading = incidentLoading || updatesLoading;
  const status = incident ? statusConfig[incident.status] : statusConfig.active;

  const metaTitle = incident
    ? `${incident.title.slice(0, 70)} — Lake Geneva Incidents`
    : "Lake Geneva Incident — Live Updates";
  const metaDescription = incident
    ? `Live updates on ${incident.title}${incident.location ? ` near ${incident.location}` : ""}. Status: ${incident.status}. Latest verified reports from local sources.`.slice(0, 300)
    : "Live local incident tracker for Lake Geneva and Walworth County.";
  const incidentJsonLd = incident
    ? {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: incident.title,
        datePublished: incident.started_at,
        dateModified: incident.updated_at,
        url: `https://lakegenevabrief.com/incidents/${incident.slug}`,
        publisher: {
          "@type": "NewsMediaOrganization",
          name: "Lake Geneva Brief",
        },
      }
    : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta
        title={metaTitle}
        description={metaDescription}
        path={`/incidents/${slug ?? ""}`}
        jsonLd={incidentJsonLd}
        ogType="article"
      />
      <PublicHeader />

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-8">
        <Link to="/incidents">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Incidents
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full mt-8" />
          </div>
        ) : !incident ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Incident Not Found</h2>
              <p className="text-muted-foreground mb-4">
                This incident may have been removed or the link is incorrect.
              </p>
              <Link to="/incidents">
                <Button>View All Incidents</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <header className="border-b border-border pb-6">
              <div className="flex items-start gap-3 mb-3">
                <Badge variant="outline" className="capitalize shrink-0">
                  {incident.incident_type}
                </Badge>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {incident.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Started {formatDate(incident.started_at)} at {formatTime(incident.started_at)}
                </span>
                {incident.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {incident.location}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mt-3">
                <p className="text-sm text-muted-foreground">
                  Last updated {formatTimeAgo(incident.updated_at)}
                </p>
                <ShareButtons 
                  title={incident.title} 
                  url={`${window.location.origin}/incidents/${incident.slug}`} 
                />
              </div>
            </header>

            {/* Subscribe CTA */}
            <Card className="bg-brand-accent/5 border-brand-accent/20">
              <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Get alerts like this via email</p>
                  <p className="text-sm text-muted-foreground">Lake Geneva news + incidents delivered every Friday.</p>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('subscribe');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="rounded-full bg-brand-accent hover:bg-blue-700 text-white shrink-0"
                >
                  Subscribe Free
                </Button>
              </CardContent>
            </Card>

            {/* Timeline */}
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Timeline
              </h2>

              {!updates?.length ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No updates yet. Check back soon for more information.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="flex gap-4">
                      <div className="w-16 shrink-0 text-sm text-muted-foreground text-right pt-0.5">
                        {formatTime(update.created_at)}
                      </div>
                      <div className="flex-1 pb-4 border-l-2 border-border pl-4 relative">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                        <p className="text-foreground leading-relaxed">{update.text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {update.is_verified ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="h-3 w-3" />
                              Unconfirmed
                            </span>
                          )}
                          <span>•</span>
                          <span>{update.source_label || update.source}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Admin Status Controls - only show for admins */}
            {isAdmin && (
              <IncidentStatusControls 
                incidentId={incident.id} 
                currentStatus={incident.status} 
              />
            )}

            {/* Community Tips */}
            <TipSubmissionForm incidentId={incident.id} />

            {/* Disclaimer */}
            <Card className="bg-muted/50">
              <CardContent className="py-4 text-sm text-muted-foreground">
                <strong>Note:</strong> Information may change as we learn more. We avoid publishing 
                names until officially released. Have a correction?{" "}
                <a href="mailto:newsletter@citybrief.info" className="text-primary hover:underline">
                  Contact us
                </a>.
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
