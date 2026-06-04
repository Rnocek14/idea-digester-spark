import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Download,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import {
  categoryEmoji,
  downloadIcs,
  extractVenue,
  formatEventTime,
  formatFullDate,
  friendlyDayLabel,
  getShortTitle,
  localDateStr,
  type EventRow,
} from "@/lib/eventUtils";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select(
          "id, title, summary, content_website, content_lg_base, category, event_date, event_time, performer, original_url, image_url, geo_tier, geo_label, metadata",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as EventRow | null;
    },
  });

  const venue = event ? extractVenue(event) : "";

  const { data: relatedAtVenue = [] } = useQuery({
    queryKey: ["event-related-venue", venue, event?.id],
    enabled: !!event && !!venue,
    queryFn: async () => {
      const todayStr = localDateStr(new Date());
      const { data } = await supabase
        .from("content_queue")
        .select(
          "id, title, category, event_date, event_time, original_url, metadata, geo_tier, geo_label",
        )
        .in("status", ["approved", "auto_published", "published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .gte("event_date", todayStr)
        .neq("id", event!.id)
        .order("event_date", { ascending: true })
        .limit(50);
      const v = venue.toLowerCase();
      return ((data || []) as EventRow[])
        .filter((e) => extractVenue(e).toLowerCase() === v)
        .slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500 text-sm">
          Loading event…
        </div>
      </PageShell>
    );
  }

  if (!event || !event.event_date) {
    return (
      <PageShell>
        <PageMeta
          title="Event not found — Lake Geneva Brief"
          description="This event is no longer available."
          path={`/events/${id || ""}`}
        />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-slate-900 font-medium mb-2">Event not found</p>
          <p className="text-slate-500 text-sm mb-6">
            It may have ended or been removed.
          </p>
          <Link
            to="/events"
            className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to all events
          </Link>
        </div>
      </PageShell>
    );
  }

  const title = getShortTitle(event);
  const time = formatEventTime(event.event_time);
  const description =
    event.content_website || event.content_lg_base || event.summary || "";

  // JSON-LD for SEO (Event schema)
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.event_time
      ? `${event.event_date}T${event.event_time}`
      : event.event_date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venue || "Lake Geneva, WI",
      address: {
        "@type": "PostalAddress",
        addressLocality: event.geo_label || "Lake Geneva",
        addressRegion: "WI",
        addressCountry: "US",
      },
    },
    description: description.substring(0, 300),
    url: `https://lakegeneva.citybrief.info/events/${event.id}`,
    image: event.image_url || undefined,
  };

  const mapQuery = encodeURIComponent(
    venue ? `${venue}, Lake Geneva, WI` : "Lake Geneva, WI",
  );

  return (
    <PageShell>
      <PageMeta
        title={`${title} — Lake Geneva Events`}
        description={
          description.substring(0, 155) ||
          `${title} on ${formatFullDate(event.event_date)} in Lake Geneva, WI.`
        }
        path={`/events/${event.id}`}
        ogType="article"
        ogImage={event.image_url || undefined}
        jsonLd={jsonLd}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <Link
          to="/events"
          className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>

        {/* Date pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-3">
          <CalendarDays className="h-3 w-3" />
          {friendlyDayLabel(event.event_date)} · {formatFullDate(event.event_date)}
        </div>

        <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-slate-900 leading-tight mb-3">
          <span className="mr-2">{categoryEmoji(event.category)}</span>
          {title}
        </h1>

        {/* Quick facts */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700 mb-6">
          {time && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-medium">{time}</span>
            </span>
          )}
          {venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              {venue}
            </span>
          )}
          {event.geo_label && (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              {event.geo_label}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            type="button"
            size="sm"
            onClick={() => downloadIcs(event)}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Add to calendar
          </Button>
          {event.original_url && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              asChild
            >
              <a
                href={event.original_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Visit source
              </a>
            </Button>
          )}
        </div>

        {/* Image */}
        {event.image_url && (
          <img
            src={event.image_url}
            alt={title}
            className="w-full rounded-md ring-1 ring-slate-200 mb-6"
            loading="lazy"
          />
        )}

        {/* Description */}
        {description && (
          <div className="prose prose-sm max-w-none text-slate-700 mb-8">
            {description.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {/* Map */}
        <div className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">
            ▪ LOCATION
          </h2>
          <div className="rounded-md overflow-hidden ring-1 ring-slate-200 aspect-[16/9] bg-slate-100">
            <iframe
              title={`Map of ${venue || "Lake Geneva"}`}
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              loading="lazy"
              className="w-full h-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        {/* Related at same venue */}
        {relatedAtVenue.length > 0 && (
          <section className="mb-8 pt-6 border-t border-slate-200">
            <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
              ▪ ALSO AT {venue.toUpperCase()}
            </h2>
            <ul className="space-y-2">
              {relatedAtVenue.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/events/${r.id}`}
                    className="flex items-baseline gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                  >
                    <span className="text-xs font-mono text-slate-500 w-20 shrink-0">
                      {friendlyDayLabel(r.event_date as string)}
                    </span>
                    <span className="text-sm text-slate-900 flex-1">
                      {getShortTitle(r)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </PageShell>
  );
}