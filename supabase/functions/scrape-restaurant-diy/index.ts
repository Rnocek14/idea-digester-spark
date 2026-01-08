import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RestaurantExtraction {
  phone?: string;
  address?: string;
  hours?: Record<string, string>;
  fish_fry?: {
    available: boolean;
    day?: string;
    price?: string;
    description?: string;
    sides?: string;
    all_you_can_eat?: boolean;
  };
  happy_hour?: {
    available: boolean;
    days?: string[];
    start_time?: string;
    end_time?: string;
    drink_deals?: string[];
    food_deals?: string[];
  };
  weekly_specials?: Array<{
    day: string;
    name: string;
    description?: string;
    price?: string;
  }>;
  signature_dishes?: Array<{
    name: string;
    price?: string;
    description?: string;
  }>;
  cuisine_types?: string[];
  amenities?: string[];
  extraction_confidence?: {
    fish_fry?: number;
    happy_hour?: number;
    hours?: number;
    overall?: number;
  };
  extraction_notes?: string;
}

const SYSTEM_PROMPT = `You are an expert restaurant data extractor for Lake Geneva, Wisconsin.

CRITICAL PRIORITIES (in order):
1. FISH FRY: This is Wisconsin - fish fry is THE most important data. Look for:
   - "Fish Fry" mentions, typically Friday
   - Prices (extract exact dollar amounts)
   - "All-you-can-eat" or "AYCE"
   - What type of fish (cod, perch, walleye, bluegill)
   - What sides are included

2. HAPPY HOUR: Extract exact times and deals:
   - Start and end times (e.g., "3pm", "6pm")
   - Which days
   - Specific drink prices ("$3 beers" not just "drink specials")
   - Food deals ("half-off apps")

3. WEEKLY SPECIALS: Look for recurring promotions:
   - "Taco Tuesday", "Wing Wednesday", "Prime Rib Saturday"
   - Include the day, name, and price if available

4. HOURS: Extract operating hours by day of week

5. SIGNATURE DISHES: Top menu items, especially Lake Geneva classics:
   - Lake perch, walleye, steaks
   - Dishes with prices (up to 5)

EXTRACTION RULES:
- ONLY extract information explicitly stated on the page
- DO NOT guess or infer - leave fields empty if not found
- Prices must be in "$X.XX" format
- Times should be in "Xpm" or "X:XXam" format
- Set confidence scores honestly (0.9+ only if clearly stated)
- Note any ambiguities in extraction_notes`;

const EXTRACTION_TOOLS = [{
  type: "function",
  function: {
    name: "extract_restaurant_details",
    description: "Extract comprehensive restaurant information from website content",
    parameters: {
      type: "object",
      properties: {
        phone: { 
          type: "string", 
          description: "Phone number in format (XXX) XXX-XXXX" 
        },
        address: { 
          type: "string", 
          description: "Full street address" 
        },
        hours: {
          type: "object",
          properties: {
            monday: { type: "string", description: "e.g., '11am-9pm' or 'Closed'" },
            tuesday: { type: "string" },
            wednesday: { type: "string" },
            thursday: { type: "string" },
            friday: { type: "string" },
            saturday: { type: "string" },
            sunday: { type: "string" }
          },
          description: "Operating hours by day of week"
        },
        fish_fry: {
          type: "object",
          properties: {
            available: { type: "boolean", description: "Does restaurant serve fish fry?" },
            day: { type: "string", description: "Day served, typically 'Friday'" },
            price: { type: "string", description: "Price like '$16.95' or '$14.99-$18.99'" },
            description: { type: "string", description: "e.g., 'Beer-battered cod, all-you-can-eat'" },
            sides: { type: "string", description: "What comes with it: 'coleslaw, fries, rye bread'" },
            all_you_can_eat: { type: "boolean", description: "Is it AYCE?" }
          },
          description: "Fish fry details - critical for Lake Geneva"
        },
        happy_hour: {
          type: "object",
          properties: {
            available: { type: "boolean" },
            days: { 
              type: "array", 
              items: { type: "string" },
              description: "Days like ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']"
            },
            start_time: { type: "string", description: "e.g., '3pm' or '4:00pm'" },
            end_time: { type: "string", description: "e.g., '6pm' or '6:00pm'" },
            drink_deals: {
              type: "array",
              items: { type: "string" },
              description: "e.g., ['$3 domestic beers', '$5 house wines', '$6 well drinks']"
            },
            food_deals: {
              type: "array", 
              items: { type: "string" },
              description: "e.g., ['Half-price appetizers', '$2 off all apps']"
            }
          }
        },
        weekly_specials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "string", description: "Day of week" },
              name: { type: "string", description: "e.g., 'Taco Tuesday'" },
              description: { type: "string", description: "What the special is" },
              price: { type: "string", description: "Price if mentioned" }
            },
            required: ["day", "name"]
          },
          description: "Recurring daily specials"
        },
        signature_dishes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              price: { type: "string" },
              description: { type: "string" }
            }
          },
          description: "Top 5 signature or featured dishes"
        },
        cuisine_types: {
          type: "array",
          items: { type: "string" },
          description: "e.g., ['American', 'Seafood', 'Italian', 'BBQ']"
        },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "e.g., ['Outdoor seating', 'Lakefront', 'Private dining', 'Bar', 'Live music']"
        },
        extraction_confidence: {
          type: "object",
          properties: {
            fish_fry: { type: "number", description: "0-1 confidence score" },
            happy_hour: { type: "number" },
            hours: { type: "number" },
            overall: { type: "number" }
          }
        },
        extraction_notes: {
          type: "string",
          description: "Any issues or uncertainties in extraction"
        }
      },
      required: ["extraction_confidence"]
    }
  }
}];

// Fetch with retry and user-agent rotation
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; LakeGenevaLocal/1.0; +https://lakegeneva.local)',
  ];
  
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
      
      if (res.ok) return await res.text();
      
      if (res.status === 403 || res.status === 429) {
        console.log(`Rate limited on attempt ${i + 1}, waiting...`);
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error(`Fetch attempt ${i + 1} failed:`, e);
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Fetch failed after retries');
}

// Extract relevant content from HTML
function extractRelevantContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return html.substring(0, 12000);
  
  // Remove noise elements using _remove (deno-dom API)
  const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg'];
  removeSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach((el: any) => el._remove?.() || el.parentNode?.removeChild(el));
  });
  
  // Get body text content
  const bodyText = doc.body?.textContent || "";
  
  // Clean up whitespace and limit size
  const cleaned = bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, 10000);
  
  return cleaned;
}

// Normalize phone number format
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return phone;
}

// Normalize price format
function normalizePrice(price?: string): string | undefined {
  if (!price) return undefined;
  const match = price.match(/\$?(\d+(?:\.\d{2})?)/);
  if (match) {
    const num = parseFloat(match[1]);
    return `$${num.toFixed(2)}`;
  }
  return price;
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
    const { source_id, limit = 20 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch restaurant sources
    let sources: Array<{ id: string; name: string; url: string; metadata: any }> = [];

    if (source_id) {
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .eq("id", source_id)
        .single();
      if (data) sources = [data];
    } else {
      // Get all firecrawl or diy-scrape restaurant sources
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .in("type", ["firecrawl", "diy-scrape"])
        .eq("category", "restaurant")
        .eq("status", "active")
        .limit(limit);
      sources = data || [];
    }

    console.log(`Processing ${sources.length} restaurant sources with OpenAI GPT-4o`);

    const results: Array<{ name: string; success: boolean; error?: string; confidence?: number }> = [];

    for (const source of sources) {
      try {
        console.log(`\n=== Scraping ${source.name}: ${source.url} ===`);

        // Pass 1: Fetch HTML
        const html = await fetchWithRetry(source.url);
        console.log(`Fetched ${html.length} bytes`);

        // Pass 2: Extract relevant content
        const content = extractRelevantContent(html);
        console.log(`Extracted ${content.length} chars of content`);

        // Pass 3: Call OpenAI GPT-4o for structured extraction
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { 
                role: "user", 
                content: `Extract restaurant data from this Lake Geneva restaurant website (${source.name}):\n\n${content}` 
              }
            ],
            tools: EXTRACTION_TOOLS,
            tool_choice: { type: "function", function: { name: "extract_restaurant_details" } },
            max_tokens: 2000,
            temperature: 0.1, // Low temp for factual extraction
          }),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`OpenAI error for ${source.name}:`, errorText);
          results.push({ name: source.name, success: false, error: `OpenAI API error: ${openaiResponse.status}` });
          continue;
        }

        const openaiData = await openaiResponse.json();
        const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall?.function?.arguments) {
          console.error(`No tool call response for ${source.name}`);
          results.push({ name: source.name, success: false, error: "No extraction data returned" });
          continue;
        }

        const extraction: RestaurantExtraction = JSON.parse(toolCall.function.arguments);
        console.log(`Extracted data for ${source.name}:`, {
          hasFishFry: extraction.fish_fry?.available,
          hasHappyHour: extraction.happy_hour?.available,
          confidence: extraction.extraction_confidence?.overall,
        });

        // Pass 4: Normalize and validate data
        const normalizedData = {
          name: source.name,
          slug: slugify(source.name),
          website: source.url,
          source_url: source.url,
          phone: normalizePhone(extraction.phone),
          address: extraction.address,
          hours: extraction.hours || {},
          fish_fry: extraction.fish_fry ? {
            ...extraction.fish_fry,
            price: normalizePrice(extraction.fish_fry.price),
          } : {},
          happy_hour: extraction.happy_hour || {},
          weekly_specials: extraction.weekly_specials || [],
          signature_dishes: extraction.signature_dishes?.map(d => ({
            ...d,
            price: normalizePrice(d.price),
          })) || [],
          cuisine_types: extraction.cuisine_types || [],
          amenities: extraction.amenities || [],
          categories: extractCategories(extraction),
          tags: extractTags(extraction),
          extraction_confidence: extraction.extraction_confidence || {},
          needs_review: (extraction.extraction_confidence?.overall || 0) < 0.6,
          extraction_notes: extraction.extraction_notes,
          last_scraped_at: new Date().toISOString(),
        };

        // Upsert into restaurants table
        const { error: upsertError } = await supabase.from("restaurants").upsert(
          normalizedData,
          { onConflict: "slug" }
        );

        if (upsertError) {
          console.error(`DB error for ${source.name}:`, upsertError);
          results.push({ name: source.name, success: false, error: upsertError.message });
          continue;
        }

        // Update source last_fetched_at and type
        await supabase
          .from("sources")
          .update({ 
            last_fetched_at: new Date().toISOString(),
            type: "diy-scrape",
            metadata: { ...(source.metadata || {}), scraper_version: "v2-openai-gpt4o" }
          })
          .eq("id", source.id);

        results.push({
          name: source.name,
          success: true,
          confidence: extraction.extraction_confidence?.overall,
        });

        console.log(`✓ Successfully processed ${source.name}`);

        // Small delay between requests to be polite
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        results.push({ name: source.name, success: false, error: String(err) });
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "scrape_restaurant_diy",
      details: {
        sources_processed: sources.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        avg_confidence: results.filter(r => r.confidence).reduce((a, b) => a + (b.confidence || 0), 0) / results.filter(r => r.confidence).length || 0,
        model: "gpt-4o",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scrape-restaurant-diy:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Extract categories from extraction data
function extractCategories(extraction: RestaurantExtraction): string[] {
  const categories: string[] = [];
  
  if (extraction.cuisine_types) {
    categories.push(...extraction.cuisine_types.map(c => c.toLowerCase().replace(/\s+/g, '-')));
  }
  
  return [...new Set(categories)];
}

// Helper: Extract tags from extraction data
function extractTags(extraction: RestaurantExtraction): string[] {
  const tags: string[] = [];
  
  if (extraction.fish_fry?.available) tags.push('fish-fry');
  if (extraction.fish_fry?.all_you_can_eat) tags.push('ayce-fish-fry');
  if (extraction.happy_hour?.available) tags.push('happy-hour');
  
  if (extraction.amenities) {
    extraction.amenities.forEach(a => {
      const normalized = a.toLowerCase();
      if (normalized.includes('outdoor') || normalized.includes('patio')) tags.push('outdoor-seating');
      if (normalized.includes('lake')) tags.push('lakefront');
      if (normalized.includes('live music')) tags.push('live-music');
      if (normalized.includes('private')) tags.push('private-dining');
      if (normalized.includes('bar')) tags.push('full-bar');
    });
  }
  
  return [...new Set(tags)];
}
