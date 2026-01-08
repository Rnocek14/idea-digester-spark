import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known Lake Geneva restaurants for better extraction
const KNOWN_RESTAURANTS = [
  "Pier 290", "Sopra Bistro", "Popeye's", "Simple Cafe", "Egg Harbor Cafe",
  "Next Door Pub", "Geneva ChopHouse", "Barrique Bistro", "Grand Geneva",
  "Baker House", "The Abbey Resort", "Mars Resort", "Lake Geneva Country Meats",
  "Sprecher's", "Oakfire", "Riva", "Tuscan Tavern", "Chuck's Lakeshore Inn",
  "Flat Iron Tap", "Medusa Grill", "Hogs & Kisses", "Grandview Restaurant",
  "Hunt Club Steakhouse", "Geneva National"
];

// Dining-specific categories
type DiningCategory = "restaurant-review" | "restaurant-opening" | "restaurant-deal" | "restaurant-feature" | "dining-event";

function categorizeDiningContent(title: string, content: string): DiningCategory {
  const text = `${title} ${content}`.toLowerCase();
  
  if (text.includes("opening") || text.includes("coming soon") || text.includes("new restaurant") || text.includes("now open")) {
    return "restaurant-opening";
  }
  if (text.includes("review") || text.includes("best") || text.includes("top 10") || text.includes("rating") || text.includes("star")) {
    return "restaurant-review";
  }
  if (text.includes("deal") || text.includes("special") || text.includes("happy hour") || text.includes("discount") || text.includes("coupon")) {
    return "restaurant-deal";
  }
  if (text.includes("fish fry") || text.includes("wine dinner") || text.includes("tasting") || text.includes("event")) {
    return "dining-event";
  }
  return "restaurant-feature";
}

function extractRestaurantName(title: string): string | null {
  for (const restaurant of KNOWN_RESTAURANTS) {
    if (title.toLowerCase().includes(restaurant.toLowerCase())) {
      return restaurant;
    }
  }
  const atMatch = title.match(/at\s+([^,–\-\|]+)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🍽️ Starting dining content sync...");

    // Fetch dining-specific sources
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .or("category.eq.dining,category.eq.restaurant,category.eq.food");

    if (sourcesError) {
      throw new Error(`Failed to fetch dining sources: ${sourcesError.message}`);
    }

    console.log(`📋 Found ${sources?.length || 0} dining sources`);

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No dining sources configured. Add sources with category 'dining', 'restaurant', or 'food'.",
          sources_processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalProcessed = 0;
    let totalNew = 0;

    for (const source of sources) {
      try {
        console.log(`\n📡 Processing: ${source.name}`);
        
        const response = await fetch(source.url, {
          headers: {
            "User-Agent": "LakeGenevaNews/1.0 (Dining Content Aggregator)"
          }
        });

        if (!response.ok) {
          console.warn(`⚠️ Failed to fetch ${source.name}: ${response.status}`);
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        let items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = [];

        if (contentType.includes("xml") || source.type === "rss") {
          // Parse RSS
          const xmlText = await response.text();
          const { XMLParser } = await import("https://esm.sh/fast-xml-parser@4.3.2");
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsed = parser.parse(xmlText);
          const channel = parsed.rss?.channel || parsed.feed;
          items = channel?.item || channel?.entry || [];
          if (!Array.isArray(items)) items = [items];
        } else if (source.type === "scrape") {
          // Scrape HTML
          const htmlText = await response.text();
          const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
          const doc = new DOMParser().parseFromString(htmlText, "text/html");
          
          if (!doc) continue;

          const selector = source.metadata?.scrape_selector || "article, .restaurant, .listing";
          const elements = doc.querySelectorAll(selector);
          
          items = Array.from(elements).map((el: any) => {
            const titleEl = el.querySelector(source.metadata?.title_selector || "h2, h3, .title");
            const linkEl = el.querySelector(source.metadata?.link_selector || "a");
            const descEl = el.querySelector(source.metadata?.desc_selector || "p, .description");
            
            return {
              title: titleEl?.textContent?.trim() || "",
              link: linkEl?.getAttribute("href") || "",
              description: descEl?.textContent?.trim() || "",
            };
          }).filter(item => item.title && item.link);
        }

        console.log(`  Found ${items.length} items`);

        // Process each item
        for (const item of items.slice(0, 20)) { // Limit per source
          const title = item.title || "";
          const originalUrl = item.link?.startsWith("http") 
            ? item.link 
            : new URL(item.link, source.url).href;
          
          if (!title || !originalUrl) continue;

          // Check if already exists
          const { data: existing } = await supabase
            .from("content_queue")
            .select("id")
            .eq("original_url", originalUrl)
            .limit(1);

          if (existing?.length) continue;

          // Categorize the content
          const diningCategory = categorizeDiningContent(title, item.description || "");
          const restaurant = extractRestaurantName(title);

          // Insert new content
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              title,
              content: item.description || title,
              summary: item.description?.substring(0, 300) || null,
              original_url: originalUrl,
              source_id: source.id,
              category: "dining",
              status: "pending",
              metadata: {
                verticals: ["eats", "dining"],
                dining_category: diningCategory,
                restaurant_name: restaurant,
                source_name: source.name,
              }
            });

          if (insertError) {
            console.warn(`  ⚠️ Insert error: ${insertError.message}`);
          } else {
            totalNew++;
          }
          totalProcessed++;
        }

        // Update source last_fetched_at
        await supabase
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);

      } catch (err) {
        console.error(`❌ Error processing ${source.name}:`, err);
      }
    }

    console.log(`\n✅ Dining sync complete: ${totalNew} new items from ${sources.length} sources`);

    return new Response(
      JSON.stringify({
        success: true,
        sources_processed: sources.length,
        items_processed: totalProcessed,
        items_new: totalNew,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Dining sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
