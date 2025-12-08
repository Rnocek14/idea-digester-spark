import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flame, Car, CloudLightning, Shield, Zap } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

type Incident = {
  id: string;
  slug: string;
  title: string;
  incident_type: string;
  status: string;
  updated_at: string;
  started_at: string;
  priority_score: number;
  location: string | null;
};

const typeIcons: Record<string, React.ReactNode> = {
  accident: <Car className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  weather: <CloudLightning className="h-4 w-4" />,
  police: <Shield className="h-4 w-4" />,
  utility: <Zap className="h-4 w-4" />,
  other: <AlertTriangle className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  active: "bg-red-500",
  monitoring: "bg-yellow-500",
  resolved: "bg-green-500",
  false_alarm: "bg-muted",
};

const statusLabels: Record<string, string> = {
  active: "🔴 Active",
  monitoring: "🟡 Monitoring",
  resolved: "🟢 Resolved",
  false_alarm: "False Alarm",
};

export default function Incidents() {
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ["incidents-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .in("status", ["active", "monitoring", "resolved"])
        .order("status", { ascending: true })
        .order("priority_score", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Incident[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds for live updates
  });

  const activeIncidents = incidents?.filter(i => i.status === "active") || [];
  const monitoringIncidents = incidents?.filter(i => i.status === "monitoring") || [];
  const resolvedIncidents = incidents?.filter(i => i.status === "resolved") || [];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Live Incidents</h1>
          <p className="text-muted-foreground">
            Real-time updates on breaking news and incidents in the Lake Geneva area.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Unable to load incidents. Please try again later.
            </CardContent>
          </Card>
        ) : !incidents?.length ? (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-2xl">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">All Clear in Lake Geneva</h3>
              <p className="text-green-700 mb-4">
                No active incidents to report. That's good news for the community.
              </p>
              <p className="text-sm text-slate-500">
                This page updates automatically when incidents are reported.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Active Incidents */}
            {activeIncidents.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Active Incidents ({activeIncidents.length})
                </h2>
                <div className="space-y-3">
                  {activeIncidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              </section>
            )}

            {/* Monitoring */}
            {monitoringIncidents.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-yellow-600 mb-4">
                  Monitoring ({monitoringIncidents.length})
                </h2>
                <div className="space-y-3">
                  {monitoringIncidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              </section>
            )}

            {/* Recently Resolved */}
            {resolvedIncidents.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                  Recently Resolved
                </h2>
                <div className="space-y-3">
                  {resolvedIncidents.slice(0, 5).map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function IncidentCard({ 
  incident, 
  formatTimeAgo 
}: { 
  incident: Incident; 
  formatTimeAgo: (date: string) => string;
}) {
  return (
    <Link to={`/incidents/${incident.slug}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-muted-foreground">
                {typeIcons[incident.incident_type] || typeIcons.other}
              </div>
              <div>
                <h3 className="font-medium text-foreground leading-tight">
                  {incident.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{statusLabels[incident.status]}</span>
                  <span>•</span>
                  <span>Updated {formatTimeAgo(incident.updated_at)}</span>
                  {incident.location && (
                    <>
                      <span>•</span>
                      <span>{incident.location}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 capitalize">
              {incident.incident_type}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
