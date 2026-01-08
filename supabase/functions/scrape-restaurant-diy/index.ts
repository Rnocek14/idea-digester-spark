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
    fish_type?: string;
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
- Note any ambiguities in extraction_notes
- The content may come from MULTIPLE PAGES - look for data from all sources`;

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
            all_you_can_eat: { type: "boolean", description: "Is it AYCE?" },
            fish_type: { type: "string", description: "Type of fish: cod, perch, walleye, bluegill" }
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

// Keywords to identify relevant pages
const MENU_KEYWORDS = ['menu', 'food', 'dinner', 'lunch', 'drink', 'appetizer', 'entree', 'dessert', 'specials', 'pricing'];
const SPECIAL_KEYWORDS = ['special', 'happy', 'hour', 'promotion', 'deal', 'fish', 'fry', 'friday', 'weekly', 'event'];
const HIGH_PRIORITY_PATHS = ['/menu', '/food-menu', '/dinner-menu', '/specials', '/weekly-specials', '/happy-hour', '/friday-fish-fry', '/events', '/food', '/drinks'];

// Fetch with retry and user-agent rotation
async function fetchWithRetry(url: string, retries = 2, timeout = 8000): Promise<string> {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const res = await fetch(url, {
        headers: { 
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) return await res.text();
      
      if (res.status === 403 || res.status === 429) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Timeout');
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('Fetch failed after retries');
}

// Discover internal links from homepage
function discoverInternalLinks(html: string, baseUrl: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];
  
  const links: string[] = [];
  const seenPaths = new Set<string>();
  
  try {
    const base = new URL(baseUrl);
    const baseDomain = base.hostname;
    
    doc.querySelectorAll('a[href]').forEach((el: any) => {
      try {
        const href = el.getAttribute('href');
        if (!href) return;
        
        // Resolve relative URLs
        let fullUrl: URL;
        if (href.startsWith('http')) {
          fullUrl = new URL(href);
        } else if (href.startsWith('/')) {
          fullUrl = new URL(href, baseUrl);
        } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          fullUrl = new URL(href, baseUrl);
        } else {
          return;
        }
        
        // Only same domain
        if (fullUrl.hostname !== baseDomain) return;
        
        // Skip common non-content paths
        const path = fullUrl.pathname.toLowerCase();
        if (path.includes('/wp-') || path.includes('/admin') || path.includes('/cart') || 
            path.includes('/checkout') || path.includes('/login') || path.includes('/account') ||
            path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.gif')) {
          return;
        }
        
        // Dedupe by path
        if (seenPaths.has(path)) return;
        seenPaths.add(path);
        
        // Calculate priority based on keywords
        const linkText = (el.textContent || '').toLowerCase();
        const pathLower = path.toLowerCase();
        
        const isHighPriority = HIGH_PRIORITY_PATHS.some(p => path.startsWith(p)) ||
          MENU_KEYWORDS.some(k => pathLower.includes(k) || linkText.includes(k)) ||
          SPECIAL_KEYWORDS.some(k => pathLower.includes(k) || linkText.includes(k));
        
        if (isHighPriority) {
          links.unshift(fullUrl.toString()); // High priority first
        } else if (path !== '/' && path.length > 1) {
          links.push(fullUrl.toString());
        }
      } catch {
        // Invalid URL, skip
      }
    });
  } catch {
    // URL parsing failed
  }
  
  return links.slice(0, 15); // Cap at 15 candidate pages
}

// Extract relevant content from HTML
function extractRelevantContent(html: string, maxLength = 6000): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return html.substring(0, maxLength);
  
  // Remove noise elements
  const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg', 'form'];
  removeSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach((el: any) => el._remove?.() || el.parentNode?.removeChild(el));
  });
  
  // Get body text content
  const bodyText = doc.body?.textContent || "";
  
  // Clean up whitespace and limit size
  return bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, maxLength);
}

// Check if content looks like it has fish fry or menu data
function hasRelevantContent(content: string): boolean {
  const lower = content.toLowerCase();
  const keywords = ['fish fry', 'fish-fry', 'perch', 'walleye', 'cod fry', 'all you can eat', 
                    'happy hour', 'drink special', 'menu', 'appetizer', 'entree', 'price', '$'];
  return keywords.some(k => lower.includes(k));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source_id, job_id, limit = 5, max_pages = 5 } = await req.json().catch(() => ({}));

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

    // If job_id provided, process that specific job
    if (job_id) {
      const result = await processJob(supabase, openaiKey, job_id, max_pages);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
      // Get all restaurant sources
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .in("type", ["firecrawl", "diy-scrape"])
        .eq("category", "restaurant")
        .eq("status", "active")
        .limit(limit);
      sources = data || [];
    }

    console.log(`Processing ${sources.length} restaurant sources with multi-page discovery + GPT-5`);

    const results: Array<{ name: string; success: boolean; error?: string; confidence?: number; pages_scraped?: number }> = [];

    for (const source of sources) {
      try {
        console.log(`\n=== Scraping ${source.name}: ${source.url} ===`);
        
        // Create or update a job for tracking
        const { data: job } = await supabase.from("restaurant_scrape_jobs").upsert({
          source_id: source.id,
          restaurant_slug: slugify(source.name),
          status: 'discovering',
          started_at: new Date().toISOString(),
        }, { onConflict: 'source_id' }).select().single();

        // PASS 1: Fetch homepage
        let homepageHtml: string;
        try {
          homepageHtml = await fetchWithRetry(source.url);
          console.log(`Fetched homepage: ${homepageHtml.length} bytes`);
        } catch (err) {
          console.error(`Failed to fetch homepage for ${source.name}:`, err);
          await supabase.from("restaurant_scrape_jobs").update({
            status: 'failed',
            error_message: `Homepage fetch failed: ${err}`,
            completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          
          await supabase.from("sources").update({
            status: 'error',
            metadata: { ...(source.metadata || {}), last_error: String(err) }
          }).eq("id", source.id);
          
          results.push({ name: source.name, success: false, error: String(err) });
          continue;
        }

        // PASS 2: Discover internal links
        const discoveredLinks = discoverInternalLinks(homepageHtml, source.url);
        console.log(`Discovered ${discoveredLinks.length} candidate pages`);
        
        // Also try common paths directly
        const baseUrl = new URL(source.url);
        const commonPaths = ['/menu', '/specials', '/happy-hour', '/food-menu', '/weekly-specials'];
        for (const path of commonPaths) {
          const testUrl = `${baseUrl.origin}${path}`;
          if (!discoveredLinks.includes(testUrl)) {
            discoveredLinks.unshift(testUrl); // Add to front as high priority
          }
        }

        await supabase.from("restaurant_scrape_jobs").update({
          status: 'scraping',
          discovered_pages: discoveredLinks,
          total_pages: Math.min(discoveredLinks.length + 1, max_pages),
        }).eq('id', job?.id);

        // PASS 3: Fetch and combine content from multiple pages
        const pageContents: Array<{ url: string; content: string }> = [];
        
        // Always include homepage
        const homepageContent = extractRelevantContent(homepageHtml);
        pageContents.push({ url: source.url, content: homepageContent });
        
        // Fetch additional pages (up to max_pages - 1)
        let pagesScraped = 1;
        for (const pageUrl of discoveredLinks.slice(0, max_pages - 1)) {
          try {
            const pageHtml = await fetchWithRetry(pageUrl, 1, 5000); // Shorter timeout for sub-pages
            const pageContent = extractRelevantContent(pageHtml, 4000);
            
            if (pageContent.length > 200 && hasRelevantContent(pageContent)) {
              pageContents.push({ url: pageUrl, content: pageContent });
              pagesScraped++;
              console.log(`  ✓ Scraped ${pageUrl.replace(source.url, '')} (${pageContent.length} chars)`);
            }
          } catch (err) {
            console.log(`  ✗ Failed ${pageUrl}: ${err}`);
          }
          
          // Small delay between requests
          await new Promise(r => setTimeout(r, 200));
        }

        // Combine all content with page source labels
        const combinedContent = pageContents
          .map(p => `=== PAGE: ${p.url} ===\n${p.content}`)
          .join('\n\n')
          .substring(0, 20000); // Cap total content

        console.log(`Combined content from ${pagesScraped} pages: ${combinedContent.length} chars`);

        await supabase.from("restaurant_scrape_jobs").update({
          status: 'extracting',
          pages_scraped: pagesScraped,
          combined_content: combinedContent.substring(0, 50000), // Store for debugging
          content_sources: pageContents.map(p => p.url),
        }).eq('id', job?.id);

        // PASS 4: Call OpenAI GPT-5 for structured extraction
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { 
                role: "user", 
                content: `Extract restaurant data from this Lake Geneva restaurant (${source.name}). Content is from ${pagesScraped} different pages on their website:\n\n${combinedContent}` 
              }
            ],
            tools: EXTRACTION_TOOLS,
            tool_choice: { type: "function", function: { name: "extract_restaurant_details" } },
            max_tokens: 2500,
            temperature: 0.1,
          }),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`OpenAI error for ${source.name}:`, errorText);
          
          await supabase.from("restaurant_scrape_jobs").update({
            status: 'failed',
            error_message: `OpenAI API error: ${openaiResponse.status}`,
            completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          
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
          fishFryPrice: extraction.fish_fry?.price,
          hasHappyHour: extraction.happy_hour?.available,
          weeklySpecials: extraction.weekly_specials?.length || 0,
          confidence: extraction.extraction_confidence?.overall,
        });

        // PASS 5: Normalize and validate data
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

        // Update job as complete
        await supabase.from("restaurant_scrape_jobs").update({
          status: 'complete',
          extraction_result: extraction,
          extraction_confidence: extraction.extraction_confidence?.overall,
          completed_at: new Date().toISOString(),
        }).eq('id', job?.id);

        // Update source
        await supabase.from("sources").update({ 
          last_fetched_at: new Date().toISOString(),
          type: "diy-scrape",
          status: "active",
          metadata: { 
            ...(source.metadata || {}), 
            scraper_version: "v3-multipage-gpt5",
            pages_scraped: pagesScraped,
            pages_discovered: discoveredLinks.length,
          }
        }).eq("id", source.id);

        results.push({
          name: source.name,
          success: true,
          confidence: extraction.extraction_confidence?.overall,
          pages_scraped: pagesScraped,
        });

        console.log(`✓ Successfully processed ${source.name} (${pagesScraped} pages)`);

        // Delay between restaurants
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        results.push({ name: source.name, success: false, error: String(err) });
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "scrape_restaurant_multipage",
      entity_type: "restaurant",
      actor_type: "system",
      details: {
        sources_processed: sources.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_pages_scraped: results.reduce((a, b) => a + (b.pages_scraped || 0), 0),
        avg_confidence: results.filter(r => r.confidence).reduce((a, b) => a + (b.confidence || 0), 0) / results.filter(r => r.confidence).length || 0,
        model: "gpt-5",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_pages_scraped: results.reduce((a, b) => a + (b.pages_scraped || 0), 0),
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

// Process a single job from the queue
async function processJob(supabase: any, openaiKey: string, jobId: string, maxPages: number) {
  const { data: job, error } = await supabase
    .from("restaurant_scrape_jobs")
    .select("*, sources(*)")
    .eq("id", jobId)
    .single();
  
  if (error || !job) {
    return { success: false, error: "Job not found" };
  }
  
  // This would contain the same logic as above but for a single job
  // For now, return the job status
  return { success: true, job };
}
