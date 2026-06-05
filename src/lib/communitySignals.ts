import { supabase } from "@/integrations/supabase/client";

export type Venue = {
  id: string;
  slug: string;
  canonical_name: string;
  aliases: string[];
  neighborhood: string | null;
  short_descriptor: string | null;
  editor_note: string | null;
  is_editorial_pick: boolean;
  display_rank: number | null;
};

export type Mention = {
  source: "local_love" | "voices" | "brief";
  id: string;
  title: string | null;
  snippet: string;
  url: string | null;
  at: string; // ISO date
  byline?: string | null;
};

export type VenueSignals = {
  venue: Venue;
  counts: { local_love: number; voices: number; brief: number; total: number };
  recent: Mention[]; // most recent first, capped
  lastMentionAt: string | null;
};

/** Case-insensitive whole-ish-token match. We intentionally avoid fuzzy
 * matching — aliases are curated. We require a non-letter boundary on
 * either side so "Sopra" doesn't match "soprano".
 */
function aliasMatches(text: string | null | undefined, aliases: string[]): boolean {
  if (!text) return false;
  const hay = text.toLowerCase();
  for (const a of aliases) {
    const needle = a.trim().toLowerCase();
    if (!needle) continue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    const before = idx === 0 ? " " : hay[idx - 1];
    const after = idx + needle.length >= hay.length ? " " : hay[idx + needle.length];
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
    return true;
  }
  return false;
}

function shortQuote(text: string, max = 200): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export async function loadCollection(collection: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("community_venues")
    .select("id, slug, canonical_name, aliases, neighborhood, short_descriptor, editor_note, is_editorial_pick, display_rank")
    .eq("collection", collection)
    .eq("status", "active")
    .order("display_rank", { ascending: true, nullsFirst: false })
    .order("canonical_name", { ascending: true });
  if (error) throw error;
  return (data || []) as Venue[];
}

/**
 * Pulls a recent window of public content from the three signal sources
 * and matches it against the curated aliases for each venue.
 * One round-trip per source, then in-memory matching.
 */
export async function loadSignals(
  venues: Venue[],
  opts: { windowDays?: number; recentPerVenue?: number } = {}
): Promise<VenueSignals[]> {
  const windowDays = opts.windowDays ?? 365;
  const cap = opts.recentPerVenue ?? 3;
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [llRes, cvRes, cqRes] = await Promise.all([
    supabase
      .from("community_submissions")
      .select("id, body, subject_name, submitter_name, created_at")
      .eq("kind", "local_love")
      .in("status", ["approved", "published"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("community_posts")
      .select("id, slug, title, excerpt, body_md, published_at")
      .eq("status", "published")
      .gte("published_at", sinceIso)
      .order("published_at", { ascending: false })
      .limit(300),
    supabase
      .from("content_queue")
      .select("id, title, summary, original_url, publish_date, created_at")
      .in("status", ["approved", "published"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(800),
  ]);

  const ll = (llRes.data || []) as Array<{ id: string; body: string; subject_name: string | null; submitter_name: string | null; created_at: string }>;
  const cv = (cvRes.data || []) as Array<{ id: string; slug: string; title: string; excerpt: string | null; body_md: string | null; published_at: string | null }>;
  const cq = (cqRes.data || []) as Array<{ id: string; title: string; summary: string | null; original_url: string | null; publish_date: string | null; created_at: string }>;

  return venues.map((v) => {
    const recent: Mention[] = [];
    let local_love = 0;
    let voices = 0;
    let brief = 0;

    for (const row of ll) {
      if (aliasMatches(row.subject_name, v.aliases) || aliasMatches(row.body, v.aliases)) {
        local_love++;
        recent.push({
          source: "local_love",
          id: row.id,
          title: row.subject_name,
          snippet: shortQuote(row.body),
          url: "/community/local-love",
          at: row.created_at,
          byline: row.submitter_name,
        });
      }
    }
    for (const row of cv) {
      if (aliasMatches(row.title, v.aliases) || aliasMatches(row.excerpt, v.aliases) || aliasMatches(row.body_md, v.aliases)) {
        voices++;
        recent.push({
          source: "voices",
          id: row.id,
          title: row.title,
          snippet: shortQuote(row.excerpt || row.body_md || ""),
          url: `/community/voices`,
          at: row.published_at || new Date().toISOString(),
        });
      }
    }
    for (const row of cq) {
      if (aliasMatches(row.title, v.aliases) || aliasMatches(row.summary, v.aliases)) {
        brief++;
        recent.push({
          source: "brief",
          id: row.id,
          title: row.title,
          snippet: shortQuote(row.summary || ""),
          url: row.original_url,
          at: row.publish_date || row.created_at,
        });
      }
    }

    recent.sort((a, b) => (a.at < b.at ? 1 : -1));
    const lastMentionAt = recent[0]?.at ?? null;

    return {
      venue: v,
      counts: { local_love, voices, brief, total: local_love + voices + brief },
      recent: recent.slice(0, cap),
      lastMentionAt,
    };
  });
}

export function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}