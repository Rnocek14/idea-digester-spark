import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FBVenueConfig {
  name: string;
  fbPageUrl: string;
  venue: string;
  city: string;
}

// Facebook pages for Lake Geneva area venues
const FACEBOOK_VENUES: FBVenueConfig[] = [
  {
    name: "Fat Cat",
    fbPageUrl: "https://www.facebook.com/fatcatslg",
    venue: "Fat Cat",
    city: "Lake Geneva",
  },
  {
    name: "Chuck's Lakeshore Inn",
    fbPageUrl: "https://www.facebook.com/ChucksLakeshoreInn",
    venue: "Chuck's Lakeshore Inn",
    city: "Lake Geneva",
  },
  {
    name: "DJs in the Drink",
    fbPageUrl: "https://www.facebook.com/inthedrink.lakecomo",
    venue: "DJs in the Drink",
    city: "Lake Como",
  },
  {
    name: "House of Music",
    fbPageUrl: "https://www.facebook.com/lghouseofmusic",
    venue: "House of Music",
    city: "Lake Geneva",
  },
  {
    name: "Topsy Turvy Brewery",
    fbPageUrl: "https://www.facebook.com/topsyturvybrewery",
    venue: "Topsy Turvy Brewery",
    city: "Lake Geneva",
  },
  {
    name: "Harpoon Willie's",
    fbPageUrl: "https://www.facebook.com/HarpoonWillies",
    venue: "Harpoon Willie's",
    city: "Williams Bay",
  },
];

// Keywords that indicate a music/entertainment event
const EVENT_KEYWORDS = [
  "live music",
  "tonight",
  "this weekend",
  "this friday",
  "this saturday",
  "this sunday",
  "playing live",
  "performing",
  "dj ",
  "band",
  "acoustic",
  "karaoke",
  "open mic",
  "trivia",
  "poker",
  "comedy",
  "show starts",
  "doors open",
  "no cover",
  "cover charge",
  "pm -",
  "pm-",
  ":00 pm",
  ":30 pm",
];

// Patterns to extract event details
const extractEventDate = (text: string): string | null => {
  const today = new Date();
  const lowerText = text.toLowerCase();
  
  // Check for "tonight", "today"
  if (lowerText.includes("tonight") || lowerText.includes("today")) {
    return today.toISOString().split("T")[0];
  }
  
  // Check for day names
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i]) || lowerText.includes(`this ${days[i]}`)) {
      const todayDay = today.getDay();
      let diff = i - todayDay;
      if (diff < 0) diff += 7;
      if (diff === 0 && !lowerText.includes("this")) continue; // Skip if just day name without "this"
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + diff);
      return eventDate.toISOString().split("T")[0];
    }
  }
  
  // Check for specific dates like "January 15" or "Jan 15"
  const monthMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i);
  if (monthMatch) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };
    const month = monthNames[monthMatch[1].toLowerCase()];
    const day = parseInt(monthMatch[2]);
    const eventDate = new Date(today.getFullYear(), month, day);
    // If date is in the past, assume next year
    if (eventDate < today) {
      eventDate.setFullYear(today.getFullYear() + 1);
    }
    return eventDate.toISOString().split("T")[0];
  }
  
  return null;
};

const extractEventTime = (text: string): string | null => {
  // Match times like "8pm", "8:00 PM", "8:30pm"
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] || "00";
    const ampm = timeMatch[3].toLowerCase();
    
    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  }
  return null;
};

const extractPerformer = (text: string): string | null => {
  // Look for patterns like "featuring X", "with X", or quoted names
  const featuringMatch = text.match(/(?:featuring|feat\.?|with|presents?:?)\s+([A-Z][A-Za-z\s&]+?)(?:\s+(?:live|playing|performing|at|on|\!|\.|$))/i);
  if (featuringMatch) {
    return featuringMatch[1].trim();
  }
  
  // Look for "X plays/performs"
  const playsMatch = text.match(/([A-Z][A-Za-z\s&]+?)\s+(?:plays?|performs?|live)/i);
  if (playsMatch && playsMatch[1].length < 40) {
    return playsMatch[1].trim();
  }
  
  return null;
};

const isEventContent = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return EVENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

const generateSlug = (venue: string, date: string): string => {
  const slug = `${venue}-event-${date}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const results: Array<{ venue: string; found: number; inserted: number; error?: string }> = [];
    let totalInserted = 0;

    for (const venue of FACEBOOK_VENUES) {
      console.log(`Scraping ${venue.name} Facebook page...`);
      
      try {
        // Use Firecrawl to scrape the Facebook page
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url: venue.fbPageUrl,
            formats: ["markdown"],
            timeout: 30000,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text();
          console.error(`Firecrawl error for ${venue.name}: ${errorText}`);
          results.push({ venue: venue.name, found: 0, inserted: 0, error: `Scrape failed: ${scrapeResponse.status}` });
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData.data?.markdown || "";
        
        if (!markdown) {
          console.log(`No content found for ${venue.name}`);
          results.push({ venue: venue.name, found: 0, inserted: 0 });
          continue;
        }

        // Split into chunks (Facebook posts are often separated by newlines)
        const chunks = markdown.split(/\n{2,}/).filter((chunk: string) => chunk.length > 50);
        
        let foundEvents = 0;
        let insertedEvents = 0;

        for (const chunk of chunks) {
          if (!isEventContent(chunk)) continue;
          
          foundEvents++;
          
          const eventDate = extractEventDate(chunk);
          const eventTime = extractEventTime(chunk);
          const performer = extractPerformer(chunk);
          
          // Skip if we can't determine a date
          if (!eventDate) {
            console.log(`Skipping event (no date): ${chunk.substring(0, 100)}...`);
            continue;
          }

          // Check for duplicates
          const slug = generateSlug(venue.venue, eventDate);
          const { data: existing } = await supabase
            .from("content_queue")
            .select("id")
            .eq("original_url", `${venue.fbPageUrl}#${slug}`)
            .single();

          if (existing) {
            console.log(`Skipping duplicate: ${slug}`);
            continue;
          }

          // Create title
          let title = performer 
            ? `${performer} at ${venue.venue}`
            : `Live Entertainment at ${venue.venue}`;
          
          if (eventTime) {
            title += ` - ${eventTime}`;
          }

          // Insert into content_queue
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              title,
              content: chunk.substring(0, 500),
              summary: `${performer || "Live entertainment"} at ${venue.venue} in ${venue.city}`,
              category: "events",
              status: "pending",
              safety_level: "safe",
              original_url: `${venue.fbPageUrl}#${slug}`,
              normalized_url: slug,
              event_date: eventDate,
              event_time: eventTime,
              performer: performer,
              geo_tier: 0,
              geo_label: venue.city,
              source_type: "facebook",
              metadata: {
                venue: venue.venue,
                city: venue.city,
                verticals: ["nightlife", "entertainment"],
                facebook_source: venue.fbPageUrl,
              },
            });

          if (insertError) {
            console.error(`Insert error: ${insertError.message}`);
          } else {
            insertedEvents++;
            totalInserted++;
            console.log(`Inserted: ${title}`);
          }
        }

        results.push({ venue: venue.name, found: foundEvents, inserted: insertedEvents });
        
      } catch (venueError) {
        console.error(`Error processing ${venue.name}:`, venueError);
        results.push({ venue: venue.name, found: 0, inserted: 0, error: String(venueError) });
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "source",
      action: "facebook_events_sync",
      actor_type: "system",
      message: `Synced Facebook events: ${totalInserted} new events from ${FACEBOOK_VENUES.length} venues`,
      details: { results, totalInserted },
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalInserted,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
