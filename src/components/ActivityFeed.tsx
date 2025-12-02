import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/queryWithTimeout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { FileText, Radio, Megaphone, Activity } from "lucide-react";

type ActivityLog = {
  id: string;
  actor_type: string;
  entity_type: string;
  action: string;
  message: string;
  created_at: string;
  user_id: string | null;
};

export function ActivityFeed() {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["activity-log", "recent"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("activity_log")
          .select(
            `
            id,
            actor_type,
            entity_type,
            action,
            message,
            created_at,
            user_id
          `
          )
          .order("created_at", { ascending: false })
          .limit(10)
          .then(res => res),
        15000
      );

      if (result.error) throw result.error;
      return result.data as ActivityLog[];
    },
    retry: 2,
    staleTime: 30000,
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "content":
        return <FileText className="h-4 w-4" />;
      case "source":
        return <Radio className="h-4 w-4" />;
      case "sponsor":
        return <Megaphone className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEntityColor = (entityType: string) => {
    switch (entityType) {
      case "content":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "source":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "sponsor":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity logged yet. Actions like approving stories, adding sources, or creating sponsors will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {activity.map((event) => (
              <li key={event.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="mt-0.5">
                  <Badge variant="outline" className={getEntityColor(event.entity_type)}>
                    {getEntityIcon(event.entity_type)}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </span>
                    {event.actor_type === "user" && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          by user
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
