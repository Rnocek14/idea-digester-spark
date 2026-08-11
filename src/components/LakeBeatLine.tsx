import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCityId, maybeCity, runCityScoped } from "@/lib/cityId";

function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * One-line "on the lake today" beat, generated each morning by
 * `generate-lake-beat`. Renders nothing if no beat is stored yet.
 */
export default function LakeBeatLine() {
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("lake_beats")
        .select("body, temp_f"), scoped)
        .eq("beat_date", todayCT())
        .maybeSingle()
      );
      if (cancelled) return;
      const text = data?.body?.trim() || null;
      const temp = data?.temp_f;
      // Guard against beats written off missing weather data (e.g. "0° and clear
      // on the lake") — a wrong number reads worse than no line at all.
      const badTemp =
        temp === null || temp === undefined || Number(temp) === 0 ||
        Number(temp) < -40 || Number(temp) > 130;
      const mentionsZero = !!text && /(^|\D)0\s*°/.test(text);
      setBody(badTemp || mentionsZero ? null : text);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!body) return null;

  return (
    <p
      className="mb-5 flex items-center gap-2 text-[13px] sm:text-[13.5px] text-slate-600 italic"
      style={{ fontFamily: "Georgia, serif" }}
    >
      <Waves className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />
      <span>{body}</span>
    </p>
  );
}