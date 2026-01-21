import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Flame, Car, CloudLightning, Shield, Zap, ChevronRight, Construction, TrafficCone, Cone } from "lucide-react";
import QuickReportIncident from "./QuickReportIncident";

type IncidentUpdate = {
  is_verified: boolean;
};

type IncidentRaw = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
  incident_type: string;
  location: string | null;
  incident_updates: IncidentUpdate[];
};

type Incident = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
  incident_type: string;
  location: string | null;
  hasUnverified: boolean;
};

// Keywords that indicate Lake Geneva coverage area
const LOCAL_KEYWORDS = [
  'lake geneva', 'williams bay', 'fontana', 'geneva lake', 'walworth county',
  'walworth', 'elkhorn', 'delavan', 'como', 'darien', 'whitewater', 'east troy',
  'lyons', 'bloomfield', 'sharon', 'linn', 'highway 50', 'hwy 50', 'highway 12',
  'hwy 12', 'us-12', 'highway 67', 'hwy 67', 'highway 120', 'hwy 120'
];

// Keywords that indicate NON-local incidents (should be excluded)
const NON_LOCAL_KEYWORDS = [
  'milwaukee', 'kenosha', 'racine', 'madison', 'waukesha', 'janesville',
  'beloit', 'chicago', 'rockford', 'green bay', 'brookfield', 'wauwatosa',
  'minneapolis', 'minnesota', 'illinois', 'indiana', 'iowa', 'michigan'
];

// Check if an incident is local to Lake Geneva area - STRICT MODE
function isLocalIncident(title: string, location: string | null): boolean {
  const titleLower = title.toLowerCase();
  const locationLower = (location || '').toLowerCase();
  
  // Priority 1: Check for non-local keywords FIRST - exclude if found
  const hasNonLocalKeyword = NON_LOCAL_KEYWORDS.some(keyword => titleLower.includes(keyword));
  if (hasNonLocalKeyword) return false;
  
  // Priority 2: If location field explicitly mentions local areas, it's local
  const locationHasLocal = LOCAL_KEYWORDS.some(keyword => locationLower.includes(keyword));
  if (locationHasLocal) return true;
  
  // Priority 3: Check for local keywords in title
  const titleHasLocal = LOCAL_KEYWORDS.some(keyword => titleLower.includes(keyword));
  if (titleHasLocal) return true;
  
  // Priority 4: Weather alerts from "NWS Milwaukee" are regional and cover our area
  const isNWSAlert = titleLower.includes('nws milwaukee') || titleLower.includes('nws sullivan');
  if (isNWSAlert) return true;
  
  // STRICT MODE: If no positive local signal found, exclude it
  // This prevents ambiguous/unknown incidents from appearing
  return false;
}

const typeIcons: Record<string, React.ReactNode> = {
  accident: <Car className="h-3.5 w-3.5" />,
  fire: <Flame className="h-3.5 w-3.5" />,
  weather: <CloudLightning className="h-3.5 w-3.5" />,
  police: <Shield className="h-3.5 w-3.5" />,
  utility: <Zap className="h-3.5 w-3.5" />,
  road_closure: <Construction className="h-3.5 w-3.5" />,
  construction: <Construction className="h-3.5 w-3.5" />,
  hazard: <TrafficCone className="h-3.5 w-3.5" />,
  traffic: <Car className="h-3.5 w-3.5" />,
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
        .select(`
          id,
          slug,
          title,
          status,
          updated_at,
          incident_type,
          location,
          incident_updates (
            is_verified
          )
        `)
        .in("status", ["active", "monitoring"])
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(10); // Fetch more to filter

      if (error) throw error;
      
      // Map and filter to only local incidents
      return ((data as IncidentRaw[]) || [])
        .filter(incident => isLocalIncident(incident.title, incident.location))
        .slice(0, 5) // Take top 5 after filtering
        .map((incident) => {
          const updates = incident.incident_updates || [];
          const hasUnverified = updates.some((u) => u.is_verified === false);
          return {
            id: incident.id,
            slug: incident.slug,
            title: incident.title,
            status: incident.status,
            updated_at: incident.updated_at,
            incident_type: incident.incident_type,
            location: incident.location,
            hasUnverified,
          };
        });
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

  // Calculate incident-free streak
  const getIncidentFreeMessage = () => {
    // In a real implementation, we'd check the last resolved incident date
    // For now, show encouraging "all clear" message with correct proximity language
    return "✓ No active incidents near Lake Geneva";
  };

  return (
    <Card className={hasActive ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-green-200 bg-green-50/30"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {hasActive ? (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            ) : (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
            {hasActive ? "Live Incidents" : "Community Status"}
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
          <div className="text-sm text-green-700 dark:text-green-400 mb-3 font-medium">
            {getIncidentFreeMessage()}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        Updated {formatTimeAgo(incident.updated_at)}
                      </span>
                      {incident.hasUnverified && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                          Unconfirmed
                        </span>
                      )}
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
