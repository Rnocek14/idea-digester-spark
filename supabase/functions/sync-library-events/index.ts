import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate stable dedupe key for calendar events
function generateDedupeKey(title: string, eventDate: string): string {
  const normalized = `${title.toLowerCase().trim()}|${eventDate}`.replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `library-event-${Math.abs(hash).toString(36)}`;
}

// Discover PDF links from raw HTML content (not just href attributes)
// This catches PDFs linked via JS, embedded JSON, raw URLs, etc.
function discoverProgramGuidePdfs(html: string, baseUrl: string): string[] {
  const pdfs: string[] = [];
  const seen = new Set<string>();
  
  // BROAD pattern: any URL ending in .pdf anywhere in the HTML
  // This catches: href="...", src="...", data-url="...", JSON strings, etc.
  const broadPattern = /https?:\/\/[^"'\s<>]+\.pdf(?:\?[^"'\s<>]*)?/gi;
  
  let match;
  while ((match = broadPattern.exec(html)) !== null) {
    const url = match[0];
    const normalized = url.toLowerCase().split('?')[0]; // Ignore query params for dedupe
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    pdfs.push(url);
  }
  
  // Also check relative paths: /something.pdf or files/something.pdf
  const relativePattern = /["'](\/[^"'\s]*\.pdf[^"']*)["']/gi;
  while ((match = relativePattern.exec(html)) !== null) {
    try {
      const base = new URL(baseUrl);
      const url = `${base.origin}${match[1]}`;
      const normalized = url.toLowerCase().split('?')[0];
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      pdfs.push(url);
    } catch { /* skip invalid */ }
  }
  
  // Score and sort by relevance (higher = better)
  const scorePdf = (url: string): number => {
    const lower = url.toLowerCase();
    let score = 0;
    // Recent years
    if (lower.includes('2026')) score += 100;
    if (lower.includes('2025')) score += 50;
    // Current months (dynamic based on current date)
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                    'july', 'august', 'september', 'october', 'november', 'december'];
    const currentMonth = months[new Date().getMonth()];
    const nextMonth = months[(new Date().getMonth() + 1) % 12];
    if (lower.includes(currentMonth)) score += 30;
    if (lower.includes(nextMonth)) score += 25;
    // Keywords
    if (lower.includes('program')) score += 20;
    if (lower.includes('newsletter')) score += 20;
    if (lower.includes('calendar')) score += 15;
    if (lower.includes('event')) score += 10;
    return score;
  };
  
  pdfs.sort((a, b) => scorePdf(b) - scorePdf(a));
  
  console.log(`[discoverProgramGuidePdfs] Found ${pdfs.length} PDF links, top 5: ${pdfs.slice(0, 5).join(', ')}`);
  return pdfs.slice(0, 5);
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
      method: "pdf_program_guide",
      pdf_url: null as string | null,
      events_extracted: 0,
      future_events: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      firecrawl_used: false,
    };

    // Step 1: Try multiple pages to find PDF links (use Firecrawl for JS-rendered pages)
    // The library publishes PDF newsletters/program guides with event schedules
    const pagesToScan = [
      "https://lglibrary.org/",  // Homepage
      "https://lglibrary.org/about",  // About page mentions newsletters
      "https://lglibrary.org/newsletter",  // Direct newsletter page
      "https://lglibrary.org/news",  // News/posts page
    ];
    
    let pdfUrls: string[] = [];
    
    for (const pageUrl of pagesToScan) {
      if (pdfUrls.length > 0) break;
      
      try {
        console.log(`[sync-library-events] Scanning for PDFs via scrape-content: ${pageUrl}`);
        
        // Use scrape-content with Firecrawl to handle JS-rendered pages
        const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: pageUrl,
            extract_type: "article", // We just need the HTML for PDF discovery
            use_firecrawl: true,
            include_raw: true, // Get raw HTML for PDF link scanning
          }),
        });
        
        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          const rawHtml = scrapeData.raw_html || scrapeData.raw_content || "";
          
          if (rawHtml.length > 0) {
            pdfUrls = discoverProgramGuidePdfs(rawHtml, pageUrl);
            console.log(`[sync-library-events] Found ${pdfUrls.length} PDFs from ${pageUrl} (firecrawl: ${scrapeData.used_firecrawl})`);
            if (scrapeData.used_firecrawl) {
              results.firecrawl_used = true;
            }
          }
        }
      } catch (err: any) {
        console.log(`[sync-library-events] Failed to scan ${pageUrl}: ${err.message}`);
      }
    }
    
    // If no PDFs found, mark source as needing attention
    if (pdfUrls.length === 0) {
      console.log(`[sync-library-events] No PDF links found on any page - source may need manual review`);
      results.errors.push("No PDF program guides found - library may have changed publishing format");
    }

    // Step 2: Try to extract events from each PDF until we get results
    let eventDetails: any[] = [];
    
    for (const pdfUrl of pdfUrls) {
      if (eventDetails.length > 0) break; // Stop once we have events
      
      console.log(`[sync-library-events] Extracting events from PDF: ${pdfUrl}`);
      results.pdf_url = pdfUrl;
      
      try {
        const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: pdfUrl,
            extract_type: "event_list",
            use_firecrawl: true, // Allow Firecrawl for OCR if needed
          }),
        });
        
        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          results.firecrawl_used = scrapeData.used_firecrawl || false;
          
          if (scrapeData.success && scrapeData.data?.events?.length > 0) {
            console.log(`[sync-library-events] Extracted ${scrapeData.data.events.length} events from PDF`);
            eventDetails = scrapeData.data.events.map((event: any) => ({
              success: true,
              url: pdfUrl,
              data: event,
            }));
            results.events_extracted = eventDetails.length;
          } else {
            console.log(`[sync-library-events] No events extracted from ${pdfUrl}`);
            if (scrapeData.error) {
              results.errors.push(`${pdfUrl}: ${scrapeData.error}`);
            }
          }
        } else {
          const errText = await scrapeResponse.text();
          console.log(`[sync-library-events] scrape-content error: ${errText.slice(0, 200)}`);
          results.errors.push(`${pdfUrl}: HTTP ${scrapeResponse.status}`);
        }
      } catch (err: any) {
        console.log(`[sync-library-events] Error processing PDF: ${err.message}`);
        results.errors.push(`${pdfUrl}: ${err.message}`);
      }
    }

    // Step 3: Process extracted events
    const today = new Date().toISOString().split('T')[0];
    
    for (const result of eventDetails) {
      if (!result.success || !result.data) {
        continue;
      }

      const event = result.data;
      
      // Skip if no event_date or in the past
      if (!event.event_date || event.event_date < today) {
        continue;
      }
      results.future_events++;

      const title = event.title || event.performer || "Library Event";
      const dedupeKey = generateDedupeKey(title, event.event_date);
      
      // Build deterministic normalized_url for dedupe (source + dedupe key)
      const normalizedUrl = `${source.url.toLowerCase().replace(/\/+$/, '')}#${dedupeKey}`;
      
      // Check for existing using normalized_url (fast, indexed)
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
          original_url: results.pdf_url || source.url,
          normalized_url: normalizedUrl,
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
            source_pdf: results.pdf_url,
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
      message: `Library sync: ${results.inserted} new events from PDF, ${results.skipped} duplicates skipped`,
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
