import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackStoryEvent } from "@/lib/trackStoryEvent";

type Story = {
  id: string;
  business_name: string;
  story_type: string;
  headline: string;
  final_body: string | null;
  ai_draft: string | null;
  photo_url: string | null;
  source_citation: string | null;
  published_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  new_on_menu: "On the menu",
  owner_spotlight: "Owner spotlight",
  behind_the_business: "Behind the business",
  seasonal_update: "Seasonal update",
  history: "Business history",
  event: "At the business",
  reopening: "Launch",
};

/**
 * Homepage rotating Business Story block.
 * One real, approved business story per day. Body is human-approved AI text
 * expanded from a real owner/editor input — never invented.
 */
export default function BusinessStoryBlock() {
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Rotation strategy: most recently published in last 7 days.
      // Keeps the block alive even if a fresh story wasn't published today.
      const { data } = await supabase
        .from("business_stories")
        .select("id,business_name,story_type,headline,final_body,ai_draft,photo_url,source_citation,published_at")
        .eq("status", "published")
        .gte("published_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setStory((data as Story) ?? null);
        setLoading(false);
        if (data?.id) {
          trackStoryEvent({
            pillar: "business",
            eventType: "homepage_impression",
            entityType: "business_story",
            entityId: (data as Story).id,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !story) return null;
  const body = story.final_body || story.ai_draft || "";

  return (
    <aside
      aria-label="Business spotlight"
      className="mb-8 rounded-md border border-slate-200 bg-white px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-200">
        <h2
          className="text-base sm:text-lg text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
        >
          {TYPE_LABEL[story.story_type] ?? "Business spotlight"}
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
          {story.business_name}
        </span>
      </div>

      {story.photo_url && (
        <img
          src={story.photo_url}
          alt={story.headline}
          loading="lazy"
          className="w-full h-48 sm:h-56 object-cover rounded mb-3"
        />
      )}

      <h3
        className="text-[17px] sm:text-[18px] text-slate-900 mb-2 leading-snug"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600 }}
      >
        {story.headline}
      </h3>
      <div className="text-[14.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{body}</div>

      {story.source_citation && (
        <p className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Source: {story.source_citation}
        </p>
      )}
    </aside>
  );
}