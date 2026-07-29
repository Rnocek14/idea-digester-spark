import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Moon, Music, Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { LG_CORE_KEYWORDS, LG_GEO_KEYWORDS, LG_LANDMARK_KEYWORDS } from "@/lib/seoKeywords";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineSubscribeCTA } from "@/components/InlineSubscribeCTA";
import { getCityId, maybeCity, runCityScoped } from "@/lib/cityId";

type NightlifeEvent = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  event_date: string | null;
  event_time: string | null;
  performer: string | null;
  original_url: string | null;
  image_url: string | null;
  metadata: {
    verticals?: string[];
    content_tags?: string[];
    recurring_days?: string[];
  } | null;
};

// Known venues for extraction and grouping
const KNOWN_VENUES = [
  "Pier 290", "PIER 290",
  "Lookout Bar & Eatery", "The Lookout",
  "Harpoon Willie's",
  "Crafted Americana",
  "Sprecher's",
  "Chuck's Lakeshore Inn",
  "Flat Iron Tap",
  "Topsy Turvy Brewery",
  "The Hive Taproom",
  "Abbey Springs",
  "The Ridge Hotel",
  "Geneva ChopHouse",
  "Avant Cycle Cafe",
  "Delavan Lake Resort",
];

const extractVenue = (title: string): string | null => {
  for (const venue of KNOWN_VENUES) {
    if (title.toLowerCase().includes(venue.toLowerCase())) {
      return venue;
    }
  }
  // Try to extract from "at [Venue]" pattern
  const atMatch = title.match(/at\s+([^,–-]+)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }
  return null;
};

const formatEventDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  if (isToday(date)) return "Tonight";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
};

const getDayName = (date: Date): string => {
  return format(date, "EEEE").toLowerCase();
};

const LakeGenevaNightlife = () => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekendStart = addDays(today, (6 - today.getDay()) % 7 || 7); // Next Saturday
  const weekendEnd = addDays(weekendStart, 1); // Sunday

  // Fetch nightlife events
  const { data: events, isLoading } = useQuery({
    queryKey: ["nightlife-events"],
    queryFn: async () => {
      const { data, error } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("content_queue")
        .select("id, title, summary, content, event_date, event_time, performer, original_url, image_url, metadata"), scoped)
        .in("status", ["published", "auto_published", "approved"])
        .contains("metadata", { verticals: ["nightlife"] })
        .gte("event_date", todayStr)
        .order("event_date", { ascending: true })
        .limit(50)
      );

      if (error) throw error;
      return data as NightlifeEvent[];
    },
  });

  // Fetch recurring events (no specific date but recurring days)
  const { data: recurringEvents } = useQuery({
    queryKey: ["nightlife-recurring"],
    queryFn: async () => {
      const { data, error } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("content_queue")
        .select("id, title, summary, content, event_date, event_time, performer, original_url, image_url, metadata"), scoped)
        .in("status", ["published", "auto_published", "approved"])
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .limit(30)
      );

      if (error) throw error;
      return (data as NightlifeEvent[]).filter(e => 
        e.metadata?.recurring_days && e.metadata.recurring_days.length > 0
      );
    },
  });

  // Filter events by timeframe
  const tonightEvents = events?.filter(e => e.event_date === todayStr) || [];
  const thisWeekEvents = events?.filter(e => {
    if (!e.event_date || e.event_date === todayStr) return false;
    const eventDate = new Date(e.event_date + "T00:00:00");
    return isThisWeek(eventDate, { weekStartsOn: 1 });
  }) || [];
  const weekendEvents = events?.filter(e => {
    if (!e.event_date) return false;
    const eventDate = new Date(e.event_date + "T00:00:00");
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Fri, Sat, Sun
  }) || [];

  // Add recurring events that match today
  const todayDayName = getDayName(today);
  const recurringTonight = recurringEvents?.filter(e => 
    e.metadata?.recurring_days?.some(d => d.toLowerCase() === todayDayName)
  ) || [];

  // Get recurring events for each day of the week
  const getRecurringForDay = (dayName: string) => {
    return recurringEvents?.filter(e => 
      e.metadata?.recurring_days?.some(d => d.toLowerCase() === dayName.toLowerCase())
    ) || [];
  };

  // Build weekly schedule from recurring events
  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weeklySchedule = weekDays.map(day => ({
    day,
    dayLabel: day.charAt(0).toUpperCase() + day.slice(1),
    events: getRecurringForDay(day),
    isToday: day === todayDayName
  })).filter(d => d.events.length > 0);

  // Extract unique venues from all events
  const allEvents = [...(events || []), ...(recurringEvents || [])];
  const venues = [...new Set(allEvents.map(e => extractVenue(e.title)).filter(Boolean))] as string[];

  return (
    <PageShell>
      <PageMeta
        title="Lake Geneva Nightlife — Live Music, Bars & Late-Night Events"
        description="Tonight and this week around Lake Geneva: live music, DJ sets, bar specials, and lakefront nightlife. Updated daily from local venues."
        path="/nightlife"
        keywords={[
          ...LG_CORE_KEYWORDS,
          ...LG_GEO_KEYWORDS,
          ...LG_LANDMARK_KEYWORDS,
          "Lake Geneva nightlife",
          "Lake Geneva live music",
          "Lake Geneva bars",
          "Lake Geneva DJ",
          "Lake Geneva tonight",
          "Lake Geneva this weekend",
          "Riviera Ballroom concerts",
        ]}
      />
      {/* Hero Section */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 mb-8 overflow-hidden rounded-b-sm bg-[hsl(var(--lake-navy))] px-6 py-12 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Moon className="h-5 w-5 text-slate-300" />
            <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Lake Geneva After Dark</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Nightlife & Live Music</h1>
          <p className="text-lg text-slate-200 mb-4">
            Your guide to live music, bars, and nightlife around the lake. Updated daily.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span className="flex items-center gap-1">
              <Music className="h-4 w-4" />
              {allEvents.length} upcoming events
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {venues.length} venues
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tonight Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌙</span>
              <h2 className="text-xl font-bold text-slate-900">Tonight</h2>
              <Badge variant="secondary" className="ml-2">{format(today, "EEE, MMM d")}</Badge>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : tonightEvents.length === 0 && recurringTonight.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-slate-500">
                  <Moon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No events scheduled for tonight</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {[...tonightEvents, ...recurringTonight].map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          {/* This Week Section */}
          {thisWeekEvents.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📅</span>
                <h2 className="text-xl font-bold text-slate-900">This Week</h2>
              </div>
              <div className="space-y-3">
                {thisWeekEvents.slice(0, 6).map(event => (
                  <EventCard key={event.id} event={event} showDate />
                ))}
              </div>
            </section>
          )}

          {/* Weekend Section - show recurring weekend events if no dated ones */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎉</span>
              <h2 className="text-xl font-bold text-slate-900">This Weekend</h2>
            </div>
            {weekendEvents.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {weekendEvents.slice(0, 6).map(event => (
                  <EventCard key={event.id} event={event} showDate compact />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...getRecurringForDay('friday'), ...getRecurringForDay('saturday'), ...getRecurringForDay('sunday')]
                  .slice(0, 6)
                  .map(event => (
                    <EventCard key={event.id} event={event} compact showRecurring />
                  ))}
              </div>
            )}
          </section>

          {/* Weekly Schedule */}
          {weeklySchedule.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📆</span>
                <h2 className="text-xl font-bold text-slate-900">Weekly Schedule</h2>
              </div>
              <div className="space-y-4">
                {weeklySchedule.map(({ day, dayLabel, events: dayEvents, isToday }) => (
                  <div key={day} className={`p-4 rounded-lg ${isToday ? 'bg-slate-50 border border-slate-200' : 'bg-slate-50'}`}>
                    <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      {dayLabel}
                      {isToday && <Badge variant="secondary" className="text-xs">Today</Badge>}
                    </h3>
                    <div className="space-y-2">
                      {dayEvents.map(event => (
                        <div key={event.id} className="flex items-start gap-2">
                          <Music className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <a 
                              href={event.original_url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-slate-900 hover:text-slate-700"
                            >
                              {event.title}
                            </a>
                            {event.event_time && (
                              <p className="text-xs text-slate-500">{event.event_time}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Subscribe CTA */}
          <div className="pt-4">
            <InlineSubscribeCTA />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Venue Directory */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-600" />
                Popular Venues
              </h3>
              <div className="space-y-2">
                {venues.slice(0, 10).map(venue => (
                  <div 
                    key={venue} 
                    className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer flex items-center justify-between group"
                  >
                    <span>{venue}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recurring Events */}
          {recurringEvents && recurringEvents.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-600" />
                  Weekly Events
                </h3>
                <div className="space-y-3">
                  {recurringEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="text-sm">
                      <p className="font-medium text-slate-900 line-clamp-1">{event.title}</p>
                      <p className="text-xs text-slate-500">
                        {event.metadata?.recurring_days?.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </PageShell>
  );
};

// Event Card Component
const EventCard = ({ 
  event, 
  showDate = false,
  compact = false,
  showRecurring = false
}: { 
  event: NightlifeEvent; 
  showDate?: boolean;
  compact?: boolean;
  showRecurring?: boolean;
}) => {
  const venue = extractVenue(event.title);
  const performer = event.performer || event.title.split(" at ")[0]?.trim();
  
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className={compact ? "p-4" : "p-4 sm:p-5"}>
        <div className="flex gap-4">
          {event.image_url && !compact && (
            <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
              <img 
                src={event.image_url} 
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {showDate && event.event_date && (
                  <Badge variant="outline" className="mb-1.5 text-xs">
                    {formatEventDate(event.event_date)}
                  </Badge>
                )}
                {showRecurring && event.metadata?.recurring_days && (
                  <Badge variant="secondary" className="mb-1.5 text-xs">
                    {event.metadata.recurring_days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
                  </Badge>
                )}
                <h3 className={`font-semibold text-slate-900 ${compact ? "text-sm line-clamp-2" : "line-clamp-1"}`}>
                  {performer}
                </h3>
                {venue && (
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {venue}
                  </p>
                )}
              </div>
              {event.event_time && (
                <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {event.event_time}
                </span>
              )}
            </div>
            {!compact && event.summary && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{event.summary}</p>
            )}
            {event.original_url && (
              <a 
                href={event.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-700 mt-2"
              >
                More info <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LakeGenevaNightlife;
