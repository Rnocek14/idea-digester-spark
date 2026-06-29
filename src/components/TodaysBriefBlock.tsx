import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type BriefStory = {
  id: string;
  title: string;
  category: string | null;
  original_url: string | null;
};

const categoryLead = (category: string | null): string => {
  const c = (category || "").toLowerCase();
  if (c === "civic") return "At City Hall";
  if (c === "news") return "Around town";
  if (c === "events") return "On the calendar";
  if (c === "community") return "From the community";
  if (c === "dining") return "On the menu";
  if (c === "schools") return "In our schools";
  if (c === "real_estate") return "On the market";
  return "Worth knowing";
};

function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * "Today's Brief" — an AI-written morning brief in prose, signed by Maggie
 * (the Brief's editor). Generated once each morning by `generate-daily-brief`
 * and stored in `daily_briefs`. Falls back to a title-assembly summary on
 * mornings where the brief hasn't been generated yet.
 */
export default function TodaysBriefBlock({ stories }: { stories: BriefStory[] }) {
  const [briefBody, setBriefBody] = useState<string | null>(null);
  const [briefLoaded, setBriefLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("daily_briefs")
        .select("body")
        .eq("brief_date", todayCT())
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      const body = (data?.body || "").trim();
      setBriefBody(body || null);
      setBriefLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Render the AI brief if we have it
  if (briefLoaded && briefBody) {
    return (
      <aside
        aria-label="Today's Brief"
        className="mb-8 rounded-md border border-slate-200 bg-gradient-to-br from-stone-50 via-white to-sky-50/40 px-5 py-5 sm:px-6 sm:py-6"
      >
        <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-200/80">
          <h2
            className="text-base sm:text-lg text-slate-900"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
          >
            Today's Brief
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
            {today}
          </span>
        </div>

        <p
          className="text-[15px] sm:text-[15.5px] text-slate-800 leading-[1.65] whitespace-pre-line"
          style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}
        >
          {briefBody}
        </p>

        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200/70 text-[11px] font-bold text-amber-900">
            M
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            — Maggie, Editor · Lake Geneva Brief
          </span>
        </div>

        <Link
          to="/selling-lake-geneva"
          className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800 transition-colors group"
        >
          <span className="font-mono uppercase tracking-wider">Brought to you by</span>
          <span className="font-semibold text-slate-700 group-hover:text-blue-700">
            Gina Nocek
          </span>
          <span className="text-slate-400">— Lake Geneva Realtor</span>
        </Link>
      </aside>
    );
  }

  // Fallback: title-assembly brief (used until 5am or on generation failure)
  const items = stories.slice(0, 3);
  if (items.length < 2) return null;

  return (
    <aside
      aria-label="Today's Brief"
      className="mb-8 rounded-md border border-slate-200 bg-gradient-to-br from-stone-50 via-white to-sky-50/40 px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-200/80">
        <h2
          className="text-base sm:text-lg text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
        >
          Today's Brief
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
          {today}
        </span>
      </div>

      <p className="text-[13px] text-slate-600 mb-3 italic">
        Three things worth your attention this morning.
      </p>

      <ol className="space-y-2.5">
        {items.map((story, idx) => {
          const lead = categoryLead(story.category);
          const content = (
            <span className="text-[14.5px] text-slate-800 leading-snug">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">
                {lead}
              </span>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600 }}>
                {story.title}
              </span>
            </span>
          );
          return (
            <li key={story.id} className="flex items-start gap-2.5">
              <span className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums">
                {idx + 1}.
              </span>
              {story.original_url ? (
                <a
                  href={story.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 hover:text-blue-700 transition-colors"
                >
                  {content}
                </a>
              ) : (
                <button
                  onClick={() => {
                    const el = document.getElementById(`story-${story.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex-1 text-left hover:text-blue-700 transition-colors"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-mono uppercase tracking-wider text-slate-500">
        — The Brief desk
      </p>
      <Link
        to="/selling-lake-geneva"
        className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800 transition-colors group"
      >
        <span className="font-mono uppercase tracking-wider">Brought to you by</span>
        <span className="font-semibold text-slate-700 group-hover:text-blue-700">
          Gina Nocek
        </span>
        <span className="text-slate-400">— Lake Geneva Realtor</span>
      </Link>
    </aside>
  );
}