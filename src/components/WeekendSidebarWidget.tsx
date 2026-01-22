import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";

type WeekendEvent = {
  id: string;
  title: string;
  category: string | null;
  publish_date: string | null;
  event_date: string | null;
  event_time: string | null;
  performer: string | null;
  metadata: Record<string, unknown> | null;
};

function formatShortDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  // Already formatted like "7:00 PM" - just return
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  // Handle 24h format like "19:00"
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return timeStr;
  let hours = parseInt(match[1]);
  const minutes = match[2] || "00";
  const period = hours >= 12 ? "PM" : "AM";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

function isGarbagePerformer(performer: string | null): boolean {
  if (!performer) return true;
  if (performer.length > 50) return true;
  if (performer.includes("http")) return true;
  const garbage = ["enjoy", "menu", "featuring", "performance", "craft beer", "join us"];
  return garbage.some((g) => performer.toLowerCase().includes(g));
}

function categoryEmoji(category: string | null) {
  const c = (category || "").toLowerCase();
  if (c.includes("dining")) return "🍽️";
  if (c.includes("music") || c.includes("entertainment")) return "🎵";
  if (c.includes("family")) return "👨‍👩‍👧‍👦";
  if (c.includes("nightlife")) return "🌙";
  if (c.includes("outdoor")) return "🌲";
  if (c.includes("shopping")) return "🛍️";
  if (c.includes("sports")) return "⚽";
  return "🎉";
}

export default function WeekendSidebarWidget() {
  const { data: events } = useQuery({
    queryKey: ["weekend-events-sidebar"],
    queryFn: async () => {
      const now = new Date();
      const day = now.getDay(); // 0=Sun..6=Sat

      // Only show widget Thu (4) through Sun (0)
      if (day > 0 && day < 4) {
        return [];
      }

      // Calculate this weekend's Friday–Sunday
      const daysUntilFriday = day === 0 ? -2 : (5 - day + 7) % 7;
      const friday = new Date(now);
      friday.setDate(now.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);

      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, category, publish_date, event_date, event_time, performer, metadata")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .in("category", ["events", "community", "entertainment", "dining"])
        .gte("publish_date", friday.toISOString())
        .lte("publish_date", sunday.toISOString())
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(6);

      if (error) {
        console.error("[WeekendSidebar] Error loading events", error);
        return [];
      }

      return data || [];
    },
    staleTime: 300000, // 5 min
  });

  // Hide if no relevant events or outside Thu-Sun window
  if (!events || events.length === 0) return null;

  // Build weekend range label
  const now = new Date();
  const day = now.getDay();
  const daysUntilFriday = day === 0 ? -2 : (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  const weekendLabel = `${friday.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} – ${sunday.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })}`;

  return (
    <aside className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          This Weekend
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{weekendLabel}</p>
      
      <ul className="space-y-2.5">
        {events.map((e) => {
          const time = formatTime(e.event_time);
          const performer = !isGarbagePerformer(e.performer) ? e.performer : null;
          const dateStr = e.event_date || e.publish_date;
          
          return (
            <li key={e.id} className="flex gap-2 items-start">
              <span className="mt-0.5 text-sm">{categoryEmoji(e.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug line-clamp-2">
                  {e.title}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                  {dateStr && (
                    <span>{formatShortDate(dateStr)}</span>
                  )}
                  {time && (
                    <>
                      {dateStr && <span>·</span>}
                      <span className="font-medium">{time}</span>
                    </>
                  )}
                  {performer && (
                    <>
                      <span>·</span>
                      <span className="truncate">{performer}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        to="/lake-geneva"
        className="mt-3 block text-xs text-primary hover:underline font-medium"
      >
        View all events →
      </Link>
    </aside>
  );
}
