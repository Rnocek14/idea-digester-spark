import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Flame, Car, CloudLightning, Shield, Zap, ChevronRight } from "lucide-react";
import QuickReportIncident from "./QuickReportIncident";

type Incident = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
  incident_type: string;
};

const typeIcons: Record<string, React.ReactNode> = {
  accident: <Car className="h-3.5 w-3.5" />,
  fire: <Flame className="h-3.5 w-3.5" />,
  weather: <CloudLightning className="h-3.5 w-3.5" />,
  police: <Shield className="h-3.5 w-3.5" />,
  utility: <Zap className="h-3.5 w-3.5" />,
  other: <AlertTriangle className="h-3.5 w-3.5" />,
};

const statusDots: Record<string, string> = {
  active: "🔴",
  monitoring: "🟡",
  resolved: "🟢",
};

type LiveIncidentsSidebarProps = {
  onHide?: () => void;
  showCloseButton?: boolean;
};

export default function LiveIncidentsSidebar({ onHide, showCloseButton = false }: LiveIncidentsSidebarProps) {
  const { data: incidents } = useQuery({
    queryKey: ["incidents-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, slug, title, status, updated_at, incident_type")
        .in("status", ["active", "monitoring"])
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Incident[];
    },
    refetchInterval: 30000,
  });

  const hasIncidents = incidents && incidents.length > 0;
  const hasActive = incidents?.some(i => i.status === "active");

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  };

  return (
    <Card className={hasActive ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {hasActive && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            Live Incidents
          </CardTitle>
          {showCloseButton && onHide && (
            <button
              onClick={onHide}
              className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
              aria-label="Hide incidents sidebar"
            >
              ×
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasIncidents ? (
          <div className="text-xs text-muted-foreground mb-2">
            🎉 All clear right now in Lake Geneva.
          </div>
        ) : (
          <div className="space-y-2 mb-2">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.slug}`}
                className="block rounded-md hover:bg-accent/50 px-2 py-1.5 -mx-2 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">
                    {typeIcons[incident.incident_type] || typeIcons.other}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight line-clamp-2">
                      {statusDots[incident.status]} {incident.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Updated {formatTimeAgo(incident.updated_at)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            <Link
              to="/incidents"
              className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-2"
            >
              View all incidents
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        <QuickReportIncident />
      </CardContent>
    </Card>
  );
}
