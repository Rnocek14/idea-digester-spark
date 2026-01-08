import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RestaurantData {
  name: string;
  hours?: Record<string, string>;
  fish_fry?: {
    available: boolean;
    day?: string;
    price?: string;
    description?: string;
  };
  happy_hour?: {
    days?: string[];
    times?: string;
    deals?: string[];
  };
  weekly_specials?: Array<{
    day: string;
    name: string;
    description?: string;
  }>;
  menu_highlights?: string[];
  categories?: string[];
  tags?: string[];
  address?: string;
  phone?: string;
}

// Extract structured data from markdown using patterns
function extractRestaurantData(markdown: string, sourceName: string): RestaurantData {
  const data: RestaurantData = { name: sourceName };
  const lowerMarkdown = markdown.toLowerCase();

  // Extract fish fry info
  const fishFryPatterns = [
    /fish\s*fry[^\n]*\$(\d+\.?\d*)/gi,
    /friday\s*fish\s*fry/gi,
    /beer[- ]?battered\s*(cod|fish)[^\n]*/gi,
    /all[- ]you[- ]can[- ]eat\s*fish/gi,
  ];

  if (fishFryPatterns.some((p) => p.test(lowerMarkdown))) {
    data.fish_fry = { available: true, day: "Friday" };

    // Try to extract price
    const priceMatch = markdown.match(/fish\s*fry[^\n]*\$(\d+\.?\d*)/i);
    if (priceMatch) {
      data.fish_fry.price = `$${priceMatch[1]}`;
    }

    // Try to extract description
    const descMatch = markdown.match(/fish\s*fry[^\n]*?([.!][^\n]*)/i);
    if (descMatch) {
      data.fish_fry.description = descMatch[1].slice(1).trim().substring(0, 200);
    }
  }

  // Extract happy hour info
  const happyHourMatch = markdown.match(/happy\s*hour[^\n]*/gi);
  if (happyHourMatch) {
    data.happy_hour = { deals: [] };

    // Try to extract times
    const timeMatch = happyHourMatch[0].match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      data.happy_hour.times = `${timeMatch[1]}-${timeMatch[2]}`;
    }

    // Try to extract days
    const daysMatch = happyHourMatch[0].match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)[-–\s]*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)?/gi);
    if (daysMatch) {
      data.happy_hour.days = daysMatch.map((d) => d.trim());
    }

    // Extract deals
    const dealPatterns = [
      /\$\d+\.?\d*\s*(?:drinks?|beers?|apps?|appetizers?|wells?|wines?)/gi,
      /half[- ]?(?:off|price)\s*(?:apps?|appetizers?)/gi,
    ];
    dealPatterns.forEach((pattern) => {
      const matches = markdown.match(pattern);
      if (matches) {
        data.happy_hour!.deals!.push(...matches.map((m) => m.trim()));
      }
    });
  }

  // Extract weekly specials
  const specialDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  data.weekly_specials = [];

  specialDays.forEach((day) => {
    const dayPattern = new RegExp(`${day}[s]?[:\\s]+([^\\n]+)`, "gi");
    const matches = markdown.match(dayPattern);
    if (matches) {
      matches.forEach((match) => {
        const specialText = match.replace(new RegExp(`^${day}[s]?[:\\s]+`, "i"), "").trim();
        if (specialText.length > 5 && specialText.length < 200) {
          data.weekly_specials!.push({
            day: day.charAt(0).toUpperCase() + day.slice(1),
            name: specialText.substring(0, 50),
            description: specialText,
          });
        }
      });
    }
  });

  // Extract hours
  const hoursPattern = /(?:hours|open)[:\s]*([^\n]+)/gi;
  const hoursMatch = markdown.match(hoursPattern);
  if (hoursMatch) {
    data.hours = {};
    hoursMatch.forEach((h) => {
      const cleanHours = h.replace(/(?:hours|open)[:\s]*/i, "").trim();
      // Simple extraction - would need more sophisticated parsing for real use
      if (cleanHours.includes("-")) {
        data.hours!["general"] = cleanHours.substring(0, 100);
      }
    });
  }

  // Extract menu highlights (look for menu items with prices)
  const menuItemPattern = /([A-Z][a-zA-Z\s]+)\s*[-–]\s*\$(\d+\.?\d*)/g;
  const menuMatches = [...markdown.matchAll(menuItemPattern)];
  if (menuMatches.length > 0) {
    data.menu_highlights = menuMatches.slice(0, 10).map((m) => `${m[1].trim()} - $${m[2]}`);
  }

  // Extract phone
  const phoneMatch = markdown.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    data.phone = phoneMatch[0];
  }

  // Determine categories and tags
  data.categories = [];
  data.tags = [];

  if (data.fish_fry?.available) data.tags.push("fish-fry");
  if (data.happy_hour?.times) data.tags.push("happy-hour");
  if (lowerMarkdown.includes("outdoor") || lowerMarkdown.includes("patio")) data.tags.push("outdoor-seating");
  if (lowerMarkdown.includes("reservation")) data.tags.push("reservations");
  if (lowerMarkdown.includes("lakefront") || lowerMarkdown.includes("lake view")) data.tags.push("lakefront");

  if (lowerMarkdown.includes("fine dining") || lowerMarkdown.includes("upscale")) data.categories.push("fine-dining");
  if (lowerMarkdown.includes("pizza")) data.categories.push("pizza");
  if (lowerMarkdown.includes("bar") || lowerMarkdown.includes("pub")) data.categories.push("bar");
  if (lowerMarkdown.includes("breakfast") || lowerMarkdown.includes("brunch")) data.categories.push("breakfast");
  if (lowerMarkdown.includes("seafood")) data.categories.push("seafood");

  return data;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source_id, url, name, limit = 5 } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // If no specific source, fetch all firecrawl restaurant sources
    let sources: Array<{ id: string; name: string; url: string; metadata: any }> = [];

    if (source_id) {
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .eq("id", source_id)
        .single();
      if (data) sources = [data];
    } else if (url && name) {
      sources = [{ id: "manual", name, url, metadata: {} }];
    } else {
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .eq("type", "firecrawl")
        .eq("category", "restaurant")
        .eq("status", "active")
        .limit(limit);
      sources = data || [];
    }

    console.log(`Processing ${sources.length} restaurant sources`);

    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (const source of sources) {
      try {
        console.log(`Scraping ${source.name}: ${source.url}`);

        // Call Firecrawl API
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: source.url,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text();
          console.error(`Firecrawl error for ${source.name}:`, errorText);
          results.push({ name: source.name, success: false, error: `Firecrawl API error: ${scrapeResponse.status}` });
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

        if (!markdown) {
          results.push({ name: source.name, success: false, error: "No content extracted" });
          continue;
        }

        // Extract structured data from markdown
        const restaurantData = extractRestaurantData(markdown, source.name);

        // Upsert into restaurants table
        const { error: upsertError } = await supabase.from("restaurants").upsert(
          {
            name: source.name,
            slug: slugify(source.name),
            website: source.url,
            source_url: source.url,
            hours: restaurantData.hours,
            fish_fry: restaurantData.fish_fry,
            happy_hour: restaurantData.happy_hour,
            weekly_specials: restaurantData.weekly_specials,
            menu_highlights: restaurantData.menu_highlights,
            categories: restaurantData.categories,
            tags: restaurantData.tags,
            phone: restaurantData.phone,
            last_scraped_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        );

        if (upsertError) {
          console.error(`DB error for ${source.name}:`, upsertError);
          results.push({ name: source.name, success: false, error: upsertError.message });
          continue;
        }

        // Update source last_fetched_at
        if (source.id !== "manual") {
          await supabase.from("sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id);
        }

        results.push({
          name: source.name,
          success: true,
        });

        console.log(`Successfully processed ${source.name}`, {
          hasFishFry: !!restaurantData.fish_fry?.available,
          hasHappyHour: !!restaurantData.happy_hour?.times,
          specialsCount: restaurantData.weekly_specials?.length || 0,
        });
      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        results.push({ name: source.name, success: false, error: String(err) });
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "scrape_restaurant_details",
      details: {
        sources_processed: sources.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scrape-restaurant-details:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
