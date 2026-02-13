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

// Detect if HTML is a bot challenge page
function detectChallenge(content: string): boolean {
  const markers = ["cloudflare", "captcha", "attention required", "enable javascript", "just a moment", "checking your browser", "cf-browser-verification"];
  const lower = content.substring(0, 5000).toLowerCase();
  return markers.some(m => lower.includes(m));
}

// Update source fetch health in DB
async function updateSourceHealth(
  supabase: any,
  sourceId: string,
  success: boolean,
  errorCode?: string,
  errorDetail?: string,
) {
  const update: Record<string, any> = { last_fetched_at: new Date().toISOString() };
  if (success) {
    update.last_successful_fetch_at = new Date().toISOString();
    update.last_error_code = null;
    update.last_error_detail = null;
  } else {
    update.last_error_code = errorCode || "unknown";
    update.last_error_detail = (errorDetail || "").substring(0, 500);
  }
  await supabase.from("sources").update(update).eq("id", sourceId);
}

// Clean up title - remove redundant venue mentions, "Live Music @" prefixes
function cleanTitle(title: string, venueName: string): string {
  let cleaned = title;
  cleaned = cleaned.replace(/^Live Music\s*(with|featuring|by|@|at|-|–|:)?\s*/i, '');
  const venueVariants = [
    venueName,
    venueName.replace(/\s*-\s*Events?$/i, ''),
    venueName.replace(/\s*Events?$/i, ''),
  ];
  for (const variant of venueVariants) {
    const regex = new RegExp(`\\s*(at|@|–|-|—)?\\s*${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(–|-|—)?\\s*`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  cleaned = cleaned.replace(/[\s\-–—@]+$/g, '').trim();
  return cleaned || title;
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

    const results: Array<{ source: string; events: number; inserted: number; errors: string[]; fetch_health: any }> = [];

    for (const source of sources) {
      console.log(`\n[sync-venue-calendars] Processing: ${source.name}`);
      const sourceResult = { source: source.name, events: 0, inserted: 0, errors: [] as string[], fetch_health: {} as any };

      try {
        let pageContent = "";
        let fetchStatusCode = 0;
        let fetchContentType = "";
        let fetchContentLength = 0;
        let containsChallenge = false;
        let fetchMethod = "none";
        
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

            fetchStatusCode = scrapeResponse.status;
            fetchContentType = scrapeResponse.headers.get("content-type") || "";

            if (scrapeResponse.ok) {
              const data = await scrapeResponse.json();
              pageContent = data.data?.markdown || data.markdown || "";
              fetchContentLength = pageContent.length;
              fetchMethod = "firecrawl";
              containsChallenge = detectChallenge(pageContent);
              console.log(`  ✓ Firecrawl: ${pageContent.length} chars, challenge=${containsChallenge}`);
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Cache-Control": "no-cache",
              },
            });

            fetchStatusCode = staticResponse.status;
            fetchContentType = staticResponse.headers.get("content-type") || "";

            if (staticResponse.ok) {
              const html = await staticResponse.text();
              fetchContentLength = html.length;
              containsChallenge = detectChallenge(html);
              
              pageContent = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              fetchMethod = "static";
              console.log(`  ✓ Static fetch: ${pageContent.length} chars, challenge=${containsChallenge}`);
            } else {
              console.log(`  ⚠️ Static fetch: ${staticResponse.status}`);
            }
          } catch (e) {
            console.log(`  ⚠️ Static fetch error: ${e}`);
          }
        }

        // Log fetch health
        const fetchHealth = {
          status_code: fetchStatusCode,
          content_type: fetchContentType,
          content_length: fetchContentLength,
          contains_challenge: containsChallenge,
          fetch_method: fetchMethod,
        };
        sourceResult.fetch_health = fetchHealth;
        console.log(`  📊 Fetch health:`, JSON.stringify(fetchHealth));

        // Determine error state
        if (containsChallenge) {
          await updateSourceHealth(supabase, source.id, false, "blocked", "Bot challenge/Cloudflare page detected");
          sourceResult.errors.push("Blocked: bot challenge page detected");
          results.push(sourceResult);
          continue;
        }

        if (fetchStatusCode === 403 || fetchStatusCode === 401) {
          await updateSourceHealth(supabase, source.id, false, `http_${fetchStatusCode}`, `HTTP ${fetchStatusCode} from ${source.url}`);
          sourceResult.errors.push(`HTTP ${fetchStatusCode}`);
          results.push(sourceResult);
          continue;
        }

        if (!pageContent || pageContent.length < 100) {
          await updateSourceHealth(supabase, source.id, false, "empty_content", `Only ${pageContent?.length || 0} chars fetched`);
          sourceResult.errors.push("Could not fetch page content");
          results.push(sourceResult);
          continue;
        }

        // Use AI to extract events
        if (!openaiKey) {
          await updateSourceHealth(supabase, source.id, false, "config_error", "No OpenAI key configured");
          sourceResult.errors.push("No OpenAI key configured");
          results.push(sourceResult);
          continue;
        }

        const today = new Date().toISOString().split('T')[0];
        let venueName = source.name
          .replace(/\s*[-–—]\s*Events?$/gi, '')
          .replace(/\s*Events?$/gi, '')
          .replace(/\s*Calendar$/gi, '')
          .replace(/\s*Live Music$/gi, '')
          .replace(/\s*Entertainment$/gi, '')
          .replace(/\s*[-–—]\s*$/g, '')
          .trim();
        
        const isAggregator = venueName.toLowerCase().includes('visit lake geneva');

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

BAD examples (DO NOT output these):
[{"title": "Live Music", ...}] - too generic
[{"title": "Live Music @ Venue", ...}] - don't include venue in title`
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
          await updateSourceHealth(supabase, source.id, false, "ai_error", `OpenAI ${aiResponse.status}: ${errText.substring(0, 200)}`);
          sourceResult.errors.push(`OpenAI error: ${aiResponse.status}`);
          console.log(`  ⚠️ OpenAI error: ${errText}`);
          results.push(sourceResult);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content?.trim() || "";
        
        let events: ExtractedEvent[] = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            events = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.log(`  ⚠️ JSON parse error: ${e}`);
          await updateSourceHealth(supabase, source.id, false, "parse_error", "Failed to parse AI response");
          sourceResult.errors.push("Failed to parse AI response");
          results.push(sourceResult);
          continue;
        }

        sourceResult.events = events.length;
        sourceResult.fetch_health.parse_items_found = events.length;
        console.log(`  → Extracted ${events.length} events`);

        if (events.length === 0) {
          // 200 OK but nothing parsed — markup drift or empty calendar
          await updateSourceHealth(supabase, source.id, false, "parse_zero", `Fetched ${fetchContentLength} chars but extracted 0 events`);
        } else {
          // Success!
          await updateSourceHealth(supabase, source.id, true);
        }

        // Insert events
        for (const event of events) {
          if (!event.title || !event.date) continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
          if (event.date < today) continue;

          const dedupeKey = generateDedupeKey(event.title, event.date, venueName);

          const { data: existing } = await supabase
            .from("content_queue")
            .select("id")
            .eq("metadata->>dedupe_key", dedupeKey)
            .maybeSingle();

          if (existing) continue;

          const cleanedTitle = cleanTitle(event.title, venueName);
          let title: string;
          let displayVenue: string;
          
          if (isAggregator && event.location_detail) {
            displayVenue = event.location_detail;
            title = `${cleanedTitle} @ ${event.location_detail}`;
          } else {
            displayVenue = venueName;
            const locationPart = event.location_detail ? ` (${event.location_detail})` : '';
            title = `${cleanedTitle} @ ${venueName}${locationPart}`;
          }

          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title,
              content: event.description || `${cleanedTitle} at ${displayVenue}`,
              original_url: source.url,
              category: "events",
              status: "auto_published",
              safety_level: "safe",
              event_date: event.date,
              event_time: event.time,
              performer: event.performer,
              geo_tier: source.default_geo_tier || 1,
              geo_label: "Lake Geneva",
              decision_path: "venue_calendar_auto_publish",
              metadata: {
                dedupe_key: dedupeKey,
                venue: displayVenue,
                source_name: source.name,
                location_detail: event.location_detail,
                source_type: "venue_calendar",
                verticals: ["local", "nightlife"],
                is_recurring: event.is_recurring || false,
                is_aggregator: isAggregator,
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

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await updateSourceHealth(supabase, source.id, false, "exception", msg.substring(0, 500));
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
