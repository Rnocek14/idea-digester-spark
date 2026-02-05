import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedEvent {
  title: string;
  date: string;
  time: string | null;
  performer: string | null;
  location_detail: string | null;
  description: string | null;
  is_recurring?: boolean;
}

// Clean up title - remove redundant venue mentions, "Live Music @" prefixes
function cleanTitle(title: string, venueName: string): string {
  let cleaned = title;
  
  // Remove "Live Music with/featuring/by" prefixes
  cleaned = cleaned.replace(/^Live Music\s*(with|featuring|by|@|at|-|–|:)?\s*/i, '');
  
  // Remove venue name if it appears in the title
  const venueVariants = [
    venueName,
    venueName.replace(/\s*-\s*Events?$/i, ''),
    venueName.replace(/\s*Events?$/i, ''),
  ];
  for (const variant of venueVariants) {
    const regex = new RegExp(`\\s*(at|@|–|-|—)?\\s*${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(–|-|—)?\\s*`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  // Remove trailing punctuation and whitespace
  cleaned = cleaned.replace(/[\s\-–—@]+$/g, '').trim();
  
  return cleaned || title; // Fallback to original if we removed everything
}

// Generate stable dedupe key
function generateDedupeKey(title: string, date: string, venue: string): string {
  const input = `${title.toLowerCase().trim()}|${date}|${venue.toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `venue-${Math.abs(hash).toString(36)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[sync-venue-calendars] Starting...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse request for optional source filter
  let sourceFilter: string | null = null;
  let limit = 15;
  try {
    const body = await req.json();
    sourceFilter = body?.source_name || null;
    limit = body?.limit || 5;
  } catch {
    // Use defaults
  }

  try {
    // Get venue calendar sources
    let query = supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .contains("metadata", { venue: true });
    
    if (sourceFilter) {
      query = query.ilike("name", `%${sourceFilter}%`);
    }
    
    const { data: sources, error: sourcesError } = await query.limit(limit);

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    console.log(`[sync-venue-calendars] Found ${sources?.length || 0} venue sources`);

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No venue sources found", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ source: string; events: number; inserted: number; errors: string[] }> = [];

    for (const source of sources) {
      console.log(`\n[sync-venue-calendars] Processing: ${source.name}`);
      const sourceResult = { source: source.name, events: 0, inserted: 0, errors: [] as string[] };

      try {
        // Fetch page content
        let pageContent = "";
        
        // Try Firecrawl first for JS-rendered sites
        if (firecrawlKey) {
          try {
            const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${firecrawlKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: source.url,
                formats: ["markdown"],
                onlyMainContent: true,
                waitFor: 3000,
              }),
            });

            if (scrapeResponse.ok) {
              const data = await scrapeResponse.json();
              pageContent = data.data?.markdown || data.markdown || "";
              console.log(`  ✓ Firecrawl: ${pageContent.length} chars`);
            } else {
              console.log(`  ⚠️ Firecrawl: ${scrapeResponse.status}`);
            }
          } catch (e) {
            console.log(`  ⚠️ Firecrawl error: ${e}`);
          }
        }

        // Fallback to static fetch
        if (!pageContent || pageContent.length < 200) {
          try {
            const staticResponse = await fetch(source.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml",
              },
            });

            if (staticResponse.ok) {
              const html = await staticResponse.text();
              pageContent = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              console.log(`  ✓ Static fetch: ${pageContent.length} chars`);
            }
          } catch (e) {
            console.log(`  ⚠️ Static fetch error: ${e}`);
          }
        }

        if (!pageContent || pageContent.length < 100) {
          sourceResult.errors.push("Could not fetch page content");
          results.push(sourceResult);
          continue;
        }

        // Use AI to extract events
        if (!openaiKey) {
          sourceResult.errors.push("No OpenAI key configured");
          results.push(sourceResult);
          continue;
        }

        const today = new Date().toISOString().split('T')[0];
        const venueName = source.name.replace(/ Events?| Calendar| Live Music| Entertainment/gi, '').trim();

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert event data extractor. Extract upcoming events from venue calendar pages with HIGH QUALITY data.

CRITICAL RULES:
1. ALWAYS extract the specific performer/artist/band name - never use generic terms like "Live Music" or "DJ"
2. If you see "Live Music with [Name]" or "[Name] Band" - the performer is that specific name
3. If an event lists a performer, that IS the title (e.g., "The Nightinjails" not "Live Music")
4. SKIP events without a specific performer name unless it's a special themed event (Fish Fry, Trivia, Karaoke, Open Mic, etc.)
5. Detect RECURRING events (same performer on multiple dates, weekly events like "Trivia Night every Tuesday")

For each event, extract:
- title: JUST the performer name or event name (e.g., "Dan Trudell Trio" NOT "Live Music with Dan Trudell Trio")
- date: YYYY-MM-DD format (infer year as 2026 if not specified)  
- time: Start time like "7:00 PM" or "6:30 PM" (null if truly not found)
- performer: Artist/band name - extract from title or separately listed
- location_detail: Specific room/area within venue if mentioned (Bar West, Waterfront, Patio, etc.)
- description: Brief description if available (null otherwise)
- is_recurring: true if this is a weekly/monthly recurring event (like "every Friday")

Today's date is ${today}. Only include events on or after today.
Return a JSON array. Maximum 15 events. QUALITY OVER QUANTITY - skip vague entries.

GOOD examples:
[{"title": "Dan Trudell Trio", "date": "2026-01-25", "time": "8:00 PM", "performer": "Dan Trudell Trio", "location_detail": "Lobby Lounge", "description": "Jazz trio", "is_recurring": false}]
[{"title": "Trivia Night", "date": "2026-01-23", "time": "7:00 PM", "performer": null, "location_detail": null, "description": "Weekly trivia", "is_recurring": true}]
[{"title": "Friday Fish Fry", "date": "2026-01-24", "time": "4:00 PM", "performer": null, "location_detail": "Waterfront", "description": "Weekly special", "is_recurring": true}]

BAD examples (DO NOT output these):
[{"title": "Live Music", ...}] - too generic
[{"title": "Live Music @ Venue", ...}] - don't include venue in title
[{"title": "Saturday Night Entertainment", ...}] - not specific enough`
              },
              {
                role: "user",
                content: `Venue: ${venueName}\n\nPage content:\n${pageContent.substring(0, 8000)}`
              }
            ],
            max_tokens: 2500,
            temperature: 0,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          sourceResult.errors.push(`OpenAI error: ${aiResponse.status}`);
          console.log(`  ⚠️ OpenAI error: ${errText}`);
          results.push(sourceResult);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content?.trim() || "";
        
        // Parse JSON from response
        let events: ExtractedEvent[] = [];
        try {
          // Handle markdown code blocks
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            events = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.log(`  ⚠️ JSON parse error: ${e}`);
          sourceResult.errors.push("Failed to parse AI response");
          results.push(sourceResult);
          continue;
        }

        sourceResult.events = events.length;
        console.log(`  → Extracted ${events.length} events`);

        // Insert events
        for (const event of events) {
          if (!event.title || !event.date) continue;
          
          // Validate date format
          if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
          
          // Skip past events
          if (event.date < today) continue;

          const dedupeKey = generateDedupeKey(event.title, event.date, venueName);

          // Check for existing
          const { data: existing } = await supabase
            .from("content_queue")
            .select("id")
            .eq("metadata->>dedupe_key", dedupeKey)
            .maybeSingle();

          if (existing) {
            continue;
          }

          // Clean and format title: "{Performer/Event} @ {Venue}"
          const cleanedTitle = cleanTitle(event.title, venueName);
          const locationPart = event.location_detail ? ` (${event.location_detail})` : '';
          const title = `${cleanedTitle} @ ${venueName}${locationPart}`;

          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title,
              content: event.description || `${cleanedTitle} performing at ${venueName}`,
              original_url: source.url,
              category: "events",
              status: "auto_published",
              safety_level: "safe",
              event_date: event.date,
              event_time: event.time,
              performer: event.performer,
              geo_tier: source.default_geo_tier || 1,
              geo_label: "Lake Geneva",
              metadata: {
                dedupe_key: dedupeKey,
                venue: venueName,
                location_detail: event.location_detail,
                source_type: "venue_calendar",
                verticals: ["local", "nightlife"],
                is_recurring: event.is_recurring || false,
                extracted_at: new Date().toISOString()
              }
            });

          if (insertError) {
            sourceResult.errors.push(`Insert error: ${insertError.message}`);
          } else {
            sourceResult.inserted++;
            console.log(`    ✅ ${event.title} (${event.date} ${event.time || ''})`);
          }
        }

        // Update last_fetched_at
        await supabase
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sourceResult.errors.push(msg);
        console.error(`  ❌ Error: ${msg}`);
      }

      results.push(sourceResult);
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalEvents = results.reduce((sum, r) => sum + r.events, 0);

    console.log(`\n[sync-venue-calendars] Complete: ${totalEvents} events found, ${totalInserted} inserted`);

    return new Response(
      JSON.stringify({ success: true, totalEvents, totalInserted, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[sync-venue-calendars] Error:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
