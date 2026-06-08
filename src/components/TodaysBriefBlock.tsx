import { Link } from "react-router-dom";

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

/**
 * "Today's Brief" — three-bullet morning summary signed by the desk.
 * Derived from the day's top stories (front of the feed) so it always
 * reflects the actual lead lineup without requiring a manual write-up.
 */
export default function TodaysBriefBlock({ stories }: { stories: BriefStory[] }) {
  const items = stories.slice(0, 3);
  if (items.length < 2) return null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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
        — Lake Geneva Brief desk
      </p>
    </aside>
  );
}