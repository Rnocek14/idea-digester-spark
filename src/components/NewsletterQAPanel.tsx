import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Calendar, AlertTriangle, CheckCircle, Clock, Eye, Sparkles, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface DailyPreview {
  storyCount: number;
  stories: Array<{ id: string; title: string; category: string | null }>;
  incidentCount: number;
  willSend: boolean;
  skipReason?: string;
}

interface WeekendPreview {
  eventCount: number;
  events: Array<{ id: string; title: string; event_date: string | null; event_time: string | null }>;
  storyCount: number;
  stories: Array<{ id: string; title: string }>;
  sponsor: { business_name: string; id: string } | null;
  willSend: boolean;
  skipReason?: string;
  weekendRange: string;
}

export function NewsletterQAPanel() {
  const queryClient = useQueryClient();
  const [triggeringDaily, setTriggeringDaily] = useState(false);
  const [triggeringWeekend, setTriggeringWeekend] = useState(false);

  // Fetch Daily Preview - matches autopilot-newsletter edge function logic
  const { data: dailyPreview, isLoading: dailyLoading, refetch: refetchDaily } = useQuery({
    queryKey: ["daily-preview"],
    queryFn: async (): Promise<DailyPreview> => {
      const now = new Date();
      const freshCutoff = new Date();
      freshCutoff.setHours(freshCutoff.getHours() - 24);
      const todayStr = now.toISOString().slice(0, 10);

      // Fetch fresh stories (published in last 24h rolling window)
      const { data: stories, error } = await supabase
        .from("content_queue")
        .select("id, title, category")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .is("last_newsletter_id", null)
        .gte("publish_date", freshCutoff.toISOString())
        .lte("publish_date", now.toISOString())
        .or(`event_date.is.null,event_date.gte.${todayStr}`)
        .order("publish_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Check active incidents updated in last 6 hours (matches edge function)
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
      
      const { count: incidentCount } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .gte("updated_at", sixHoursAgo.toISOString());

      const storyCount = stories?.length || 0;
      const incidents = incidentCount || 0;
      const willSend = storyCount >= 3 || (storyCount >= 2 && incidents >= 1);

      return {
        storyCount,
        stories: stories || [],
        incidentCount: incidents,
        willSend,
        skipReason: !willSend
          ? `Only ${storyCount} fresh stories and ${incidents} active incidents (need 3 stories or 2 + incident)`
          : undefined,
      };
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch Weekend Preview
  const { data: weekendPreview, isLoading: weekendLoading, refetch: refetchWeekend } = useQuery({
    queryKey: ["weekend-preview"],
    queryFn: async (): Promise<WeekendPreview> => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilFriday = dayOfWeek <= 4 ? 5 - dayOfWeek : 12 - dayOfWeek;
      
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);

      const fridayStr = friday.toISOString().slice(0, 10);
      const sundayStr = sunday.toISOString().slice(0, 10);

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const weekendRange = `${months[friday.getMonth()]} ${friday.getDate()}–${sunday.getDate()}`;

      // Fetch weekend events
      const { data: events, error: eventsError } = await supabase
        .from("content_queue")
        .select("id, title, event_date, event_time")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .in("category", ["events", "entertainment", "dining", "community"])
        .gte("event_date", fridayStr)
        .lte("event_date", sundayStr)
        .order("event_date", { ascending: true })
        .limit(30);

      if (eventsError) throw eventsError;

      // Fetch week's top stories
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: stories, error: storiesError } = await supabase
        .from("content_queue")
        .select("id, title")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .not("category", "in", "(events,entertainment,weather,alerts)")
        .gte("geo_tier", 1)
        .gte("publish_date", weekAgo.toISOString())
        .lte("publish_date", new Date().toISOString())
        .order("geo_tier", { ascending: true })
        .order("publish_date", { ascending: false })
        .limit(10);

      if (storiesError) throw storiesError;

      // Fetch featured sponsor
      const { data: sponsors } = await supabase
        .from("sponsors")
        .select("id, business_name")
        .eq("status", "active")
        .order("tier", { ascending: false })
        .limit(1);

      const eventCount = events?.length || 0;
      const storyCount = stories?.length || 0;
      const willSend = eventCount >= 3 || (eventCount >= 1 && storyCount >= 3);

      return {
        eventCount,
        events: events || [],
        storyCount,
        stories: stories || [],
        sponsor: sponsors?.[0] || null,
        willSend,
        skipReason: !willSend
          ? `Only ${eventCount} events and ${storyCount} stories (need 3 events or 1 event + 3 stories)`
          : undefined,
        weekendRange,
      };
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Trigger Daily
  const triggerDailyMutation = useMutation({
    mutationFn: async () => {
      setTriggeringDaily(true);
      const { data, error } = await supabase.functions.invoke("autopilot-newsletter", {
        body: { sendNow: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["recent-newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["daily-preview"] });
      if (data.status === "sent") {
        toast.success(`Daily sent to ${data.sent} subscribers`);
      } else if (data.status === "skipped") {
        toast.info(`Daily skipped: ${data.reason}`);
      } else {
        toast.success("Daily newsletter generated");
      }
    },
    onError: (error: any) => {
      toast.error("Failed to trigger daily", { description: error.message });
    },
    onSettled: () => setTriggeringDaily(false),
  });

  // Trigger Weekend
  const triggerWeekendMutation = useMutation({
    mutationFn: async () => {
      setTriggeringWeekend(true);
      const { data, error } = await supabase.functions.invoke("autopilot-weekend-newsletter", {
        body: { sendNow: true, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["recent-newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["weekend-preview"] });
      if (data.status === "sent") {
        toast.success(`Weekend Guide sent to ${data.sent} subscribers`);
      } else if (data.status === "skipped") {
        toast.info(`Weekend Guide skipped: ${data.reason}`);
      } else {
        toast.success("Weekend Guide generated");
      }
    },
    onError: (error: any) => {
      toast.error("Failed to trigger Weekend Guide", { description: error.message });
    },
    onSettled: () => setTriggeringWeekend(false),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Daily Brief Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Tomorrow's Daily Brief
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchDaily()}
              disabled={dailyLoading}
            >
              <RefreshCw className={`h-4 w-4 ${dailyLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {dailyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dailyPreview ? (
            <>
              <div className="flex items-center gap-2">
                {dailyPreview.willSend ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Will Send
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    May Skip
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {dailyPreview.storyCount} stories • {dailyPreview.incidentCount} active incidents
                </span>
              </div>

              {dailyPreview.skipReason && (
                <p className="text-sm text-amber-600">{dailyPreview.skipReason}</p>
              )}

              <div className="space-y-1 max-h-40 overflow-y-auto">
                {dailyPreview.stories.slice(0, 6).map((story) => (
                  <div key={story.id} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="truncate">{story.title}</span>
                    {story.category && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {story.category}
                      </Badge>
                    )}
                  </div>
                ))}
                {dailyPreview.storyCount > 6 && (
                  <p className="text-xs text-muted-foreground">
                    +{dailyPreview.storyCount - 6} more stories
                  </p>
                )}
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={() => triggerDailyMutation.mutate()}
                disabled={triggeringDaily}
              >
                {triggeringDaily ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Generate & Send Now
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Weekend Guide Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Weekend Guide ({weekendPreview?.weekendRange || "..."})
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchWeekend()}
              disabled={weekendLoading}
            >
              <RefreshCw className={`h-4 w-4 ${weekendLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {weekendLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : weekendPreview ? (
            <>
              <div className="flex items-center gap-2">
                {weekendPreview.willSend ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Will Send
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    May Skip
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {weekendPreview.eventCount} events • {weekendPreview.storyCount} recap stories
                </span>
              </div>

              {weekendPreview.skipReason && (
                <p className="text-sm text-amber-600">{weekendPreview.skipReason}</p>
              )}

              {weekendPreview.sponsor && (
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">Sponsor:</span>
                  <span className="font-medium">{weekendPreview.sponsor.business_name}</span>
                </div>
              )}

              <div className="space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground uppercase">Events</p>
                {weekendPreview.events.slice(0, 5).map((event) => (
                  <div key={event.id} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="truncate">{event.title}</span>
                    {event.event_date && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(event.event_date + "T00:00:00"), "EEE")}
                      </span>
                    )}
                  </div>
                ))}
                {weekendPreview.eventCount > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{weekendPreview.eventCount - 5} more events
                  </p>
                )}
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={() => triggerWeekendMutation.mutate()}
                disabled={triggeringWeekend}
              >
                {triggeringWeekend ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Generate & Send Weekend Guide
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
