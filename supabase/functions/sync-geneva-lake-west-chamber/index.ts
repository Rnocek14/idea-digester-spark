import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  guid?: string;
  mecStartDate?: string;
  mecStartHour?: string;
  contentEncoded?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🏛️ Starting Geneva Lake West Chamber Events sync...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const feedUrl = "https://genevalakewest.com/events/feed/";
    
    // Fetch RSS feed with comprehensive browser-like headers
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log(`📥 Fetched RSS feed (${xmlText.length} bytes)`);

    // Parse RSS items manually (Deno doesn't have DOMParser for XML easily)
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      const getTagContent = (xml: string, tag: string): string | undefined => {
        // Handle CDATA content
        const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
        if (cdataMatch) return cdataMatch[1].trim();
        
        // Handle regular content
        const regularMatch = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
        if (regularMatch) return regularMatch[1].trim();
        
        return undefined;
      };

      const title = getTagContent(itemXml, 'title');
      const link = getTagContent(itemXml, 'link');
      const pubDate = getTagContent(itemXml, 'pubDate');
      const description = getTagContent(itemXml, 'description');
      const guid = getTagContent(itemXml, 'guid');
      const mecStartDate = getTagContent(itemXml, 'mec:startDate');
      const mecStartHour = getTagContent(itemXml, 'mec:startHour');
      const contentEncoded = getTagContent(itemXml, 'content:encoded');

      if (title && link) {
        items.push({
          title: decodeHtmlEntities(title),
          link,
          pubDate,
          description: description ? decodeHtmlEntities(description) : undefined,
          guid,
          mecStartDate,
          mecStartHour,
          contentEncoded,
        });
      }
    }

    console.log(`📋 Parsed ${items.length} items from RSS feed`);

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      // Determine event date - prefer MEC start date, fallback to pubDate
      let eventDate: string | null = null;
      
      if (item.mecStartDate) {
        eventDate = item.mecStartDate; // Already in YYYY-MM-DD format
      } else if (item.pubDate) {
        const parsed = new Date(item.pubDate);
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed.toISOString().split('T')[0];
        }
      }

      // Extract event time from MEC data
      let eventTime: string | null = item.mecStartHour || null;

      // Skip past events
      if (eventDate) {
        const today = new Date().toISOString().split('T')[0];
        if (eventDate < today) {
          console.log(`⏭️ Skipping past event: "${item.title}" (${eventDate})`);
          skipped++;
          continue;
        }
      }

      // Create dedupe key from guid or hash of title+link+date
      const dedupeKey = item.guid || `${item.title}-${item.link}-${eventDate || ''}`;
      
      // Check for existing entry
      const { data: existing } = await supabase
        .from("content_queue")
        .select("id")
        .or(`original_url.eq.${item.link},title.eq.${item.title}`)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Skipping duplicate: "${item.title}"`);
        skipped++;
        continue;
      }

      // Extract a clean summary from description or content
      let summary = item.description || '';
      // Strip HTML tags for plain text summary
      summary = summary.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (summary.length > 300) {
        summary = summary.substring(0, 297) + '...';
      }

      // Build content
      const content = `Geneva Lake West Chamber Event: ${item.title}${eventDate ? ` on ${eventDate}` : ''}${eventTime ? ` at ${eventTime}` : ''}. ${summary}`;

      // Insert new event
      const { error: insertError } = await supabase
        .from("content_queue")
        .insert({
          title: item.title,
          content,
          summary: summary || `Geneva Lake West Chamber event: ${item.title}`,
          original_url: item.link,
          category: "events",
          status: "auto_published",
          safety_level: "safe",
          geo_tier: 1,
          geo_label: "Geneva Lake West",
          event_date: eventDate,
          event_time: eventTime,
          source_id: await getSourceId(supabase),
          metadata: {
            feed_guid: item.guid,
            mec_start_date: item.mecStartDate,
            mec_start_hour: item.mecStartHour,
            synced_at: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error(`❌ Failed to insert "${item.title}":`, insertError.message);
      } else {
        console.log(`✅ Inserted: "${item.title}" (${eventDate || 'no date'})`);
        inserted++;
      }
    }

    // Update source last_fetched_at
    const sourceId = await getSourceId(supabase);
    if (sourceId) {
      await supabase
        .from("sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", sourceId);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Geneva Lake West Chamber sync complete: ${inserted} inserted, ${skipped} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        itemsFound: items.length,
        inserted,
        skipped,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Geneva Lake West Chamber sync failed:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getSourceId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("id")
    .eq("name", "Geneva Lake West Chamber Events")
    .maybeSingle();
  return data?.id || null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&hellip;/g, '...');
}
