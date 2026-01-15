import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate stable dedupe key for calendar events
function generateDedupeKey(title: string, eventDate: string, eventUrl: string): string {
  const normalized = `${title.toLowerCase().trim()}|${eventDate}|${eventUrl}`.replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `library-event-${Math.abs(hash).toString(36)}`;
}

// Extract event links from HTML
function extractEventLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  
  // Multiple patterns for different library calendar systems
  const patterns = [
    // LibCal/SpringShare event links (common library platform)
    /href=["']([^"']*\/event\/\d+[^"']*)/gi,
    /href=["']([^"']*\/events\/[^"']+)/gi,
    // Generic event/calendar/program links
    /href=["']([^"']*(?:event|calendar|program)[^"']*)/gi,
    // Links with date-like patterns in path
    /href=["']([^"']*\/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[^"']*)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      
      // Skip anchors, javascript, mailto
      if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
        continue;
      }
      
      // Make absolute URL
      try {
        if (url.startsWith('/')) {
          const base = new URL(baseUrl);
          url = `${base.origin}${url}`;
        } else if (!url.startsWith('http')) {
          url = new URL(url, baseUrl).href;
        }
        
        // Normalize and dedupe
        const normalized = url.split('?')[0].split('#')[0];
        if (!seen.has(normalized)) {
          seen.add(normalized);
          links.push(url);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }
  
  console.log(`[extractEventLinks] Found ${links.length} unique event links from ${patterns.length} patterns`);
  return links.slice(0, 20); // Limit to 20 events per run
}

// Rate limiter for concurrent requests
async function rateLimitedFetch<T>(
  items: T[],
  fetcher: (item: T, index: number) => Promise<any>,
  concurrency: number = 3,
  delayMs: number = 300
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, idx) => fetcher(item, i + idx))
    );
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the library source
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("name", "Lake Geneva Public Library Events")
      .single();
    
    if (sourceError || !source) {
      console.error("Library source not found:", sourceError);
      return new Response(
        JSON.stringify({ error: "Library source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📚 Syncing library events from: ${source.url}`);

    const results = {
      method: "scrape-content",
      scraped: 0,
      future: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      static_fetch_used: true,
      firecrawl_used: false,
    };

    // Step 1: Try static fetch for the main calendar page first
    let html = "";
    let usedFirecrawl = false;
    let hasUsefulContent = false;
    
    try {
      console.log(`[sync-library-events] Attempting static fetch...`);
      const staticRes = await fetch(source.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      
      if (staticRes.ok) {
        html = await staticRes.text();
        // Check actual text content, not just HTML length (JS-rendered pages have lots of HTML but little text)
        const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        hasUsefulContent = textContent.length >= 500;
        console.log(`[sync-library-events] Static fetch: ${html.length} HTML chars, ${textContent.length} text chars, useful: ${hasUsefulContent}`);
      }
    } catch (err) {
      console.log(`[sync-library-events] Static fetch failed, will try scrape-content with firecrawl fallback`);
    }

    // Step 2: If static fetch didn't get useful content, use scrape-content with firecrawl
    if (!hasUsefulContent) {
      console.log(`[sync-library-events] Not enough text content, using scrape-content with firecrawl...`);
      
      const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: source.url,
          extract_type: "event",
          use_firecrawl: true,
          include_raw: true, // Request raw HTML for link extraction
        }),
      });
      
      if (scrapeResponse.ok) {
        const scrapeData = await scrapeResponse.json();
        usedFirecrawl = scrapeData.used_firecrawl || false;
        results.static_fetch_used = !usedFirecrawl;
        results.firecrawl_used = usedFirecrawl;
        
        // If we got structured event data directly, use it
        if (scrapeData.success && scrapeData.data) {
          console.log(`[sync-library-events] Got structured data from scrape-content`);
          // Handle single event extraction - calendar pages need link discovery
        }
        
        // Get the raw HTML for link extraction
        html = scrapeData.html || scrapeData.raw_html || "";
      }
    }

    if (html.length < 200) {
      console.error(`[sync-library-events] Could not get calendar content`);
      return new Response(
        JSON.stringify({ error: "Could not fetch calendar content", results }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Extract event links from calendar page
    const eventLinks = extractEventLinks(html, source.url);
    console.log(`[sync-library-events] Found ${eventLinks.length} event links`);

    // Step 4: For each event link, call scrape-content with extract_type: 'event'
    const eventDetails = await rateLimitedFetch(
      eventLinks,
      async (eventUrl) => {
        try {
          const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "apikey": supabaseKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: eventUrl,
              extract_type: "event",
              use_firecrawl: true, // Allow fallback for JS-rendered pages
            }),
          });

          if (!scrapeResponse.ok) {
            return { url: eventUrl, success: false, error: `HTTP ${scrapeResponse.status}` };
          }

          const data = await scrapeResponse.json();
          if (data.used_firecrawl) {
            results.firecrawl_used = true;
          }
          return { url: eventUrl, ...data };
        } catch (err: any) {
          return { url: eventUrl, success: false, error: err.message };
        }
      },
      3, // Max 3 concurrent
      300 // 300ms delay between batches
    );

    // Step 5: Process extracted events
    const today = new Date().toISOString().split('T')[0];
    
    for (const result of eventDetails) {
      results.scraped++;
      
      if (!result.success || !result.data) {
        if (result.error) results.errors.push(`${result.url}: ${result.error}`);
        continue;
      }

      const event = result.data;
      
      // Skip if no event_date or in the past
      if (!event.event_date || event.event_date < today) {
        continue;
      }
      results.future++;

      const title = event.title || event.performer || "Library Event";
      const dedupeKey = generateDedupeKey(title, event.event_date, result.url);
      
      // Check for existing using normalized_url (safer than .or with JSON paths)
      const normalizedUrl = result.url.toLowerCase().split('?')[0].replace(/\/+$/, '');
      const { data: existing } = await supabase
        .from("content_queue")
        .select("id")
        .eq("source_id", source.id)
        .eq("normalized_url", normalizedUrl)
        .limit(1);
      
      if (existing && existing.length > 0) {
        results.skipped++;
        continue;
      }

      // Insert new event
      const { error: insertError } = await supabase
        .from("content_queue")
        .insert({
          source_id: source.id,
          title: title.substring(0, 200),
          content: event.description || `Library event: ${title}`,
          summary: (event.description || title).substring(0, 200),
          category: "events",
          original_url: result.url,
          normalized_url: normalizedUrl, // For faster dedupe
          event_date: event.event_date,
          event_time: event.start_time || event.event_time,
          performer: event.performer,
          geo_tier: 1,
          geo_label: "Lake Geneva",
          status: "auto_published", // Trusted local source
          safety_level: "safe",
          metadata: {
            dedupe_key: dedupeKey,
            venue: event.venue || "Lake Geneva Public Library",
            location_tags: ["Lake Geneva"],
            trusted_locality: true,
            ai_extracted: true,
          },
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        results.errors.push(`${title}: ${insertError.message}`);
      } else {
        results.inserted++;
        console.log(`✅ Inserted: ${title} (${event.event_date})`);
      }
    }

    // Update source last_fetched_at
    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "source",
      entity_id: source.id,
      action: "sync_library_events",
      message: `Library sync: ${results.inserted} new events, ${results.skipped} duplicates skipped (firecrawl: ${results.firecrawl_used})`,
      details: results,
    });

    console.log(`🏁 Library sync complete:`, results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Library sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
