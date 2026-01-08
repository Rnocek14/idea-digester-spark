import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expanded extraction interface with evidence tracking
interface DealExtraction {
  deal_type: string; // fish_fry, happy_hour, brunch, weekly_special, kids_deal, late_night
  name: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  description?: string;
  price?: string;
  fish_type?: string;
  all_you_can_eat?: boolean;
  sides?: string;
  drink_deals?: string[];
  food_deals?: string[];
  evidence_snippet?: string; // Exact quote from page
  confidence?: number;
}

interface RestaurantExtraction {
  phone?: string;
  address?: string;
  hours?: Record<string, string>;
  deals?: DealExtraction[];
  features?: string[]; // lakefront, patio, live_music, dog_friendly, sports_bar, private_dining
  cuisine_types?: string[];
  price_range?: string; // $, $$, $$$, $$$$
  signature_dishes?: Array<{
    name: string;
    price?: string;
    description?: string;
  }>;
  extraction_confidence?: {
    fish_fry?: number;
    happy_hour?: number;
    hours?: number;
    overall?: number;
  };
  extraction_notes?: string;
}

const SYSTEM_PROMPT = `You are an expert restaurant data extractor for Lake Geneva, Wisconsin.

CRITICAL: Extract ALL deals you find into the 'deals' array with proper classification.

DEAL TYPES TO EXTRACT:
1. FISH FRY (deal_type: "fish_fry") - THE most important for Wisconsin
   - Look for: "Fish Fry", Friday specials, perch, cod, walleye, bluegill
   - Extract: price, fish_type, all_you_can_eat, sides
   - ALWAYS capture the exact text as evidence_snippet

2. HAPPY HOUR (deal_type: "happy_hour")
   - Extract: days, start_time, end_time, drink_deals, food_deals
   
3. WEEKLY SPECIALS (deal_type: "weekly_special")
   - Taco Tuesday, Wing Wednesday, Prime Rib Saturday, etc.
   - Include the specific day and any prices

4. BRUNCH (deal_type: "brunch")
   - Weekend brunch, buffet, bottomless mimosas

5. KIDS DEALS (deal_type: "kids_deal")
   - Kids eat free, children's pricing

6. LATE NIGHT (deal_type: "late_night")
   - Late night menu, after 10pm specials

FEATURES TO EXTRACT (as string array):
- lakefront, lake_view, rooftop, patio, outdoor_seating
- live_music, dj, trivia, karaoke
- sports_bar, game_day_specials
- dog_friendly, fire_pit, heated_patio
- private_dining, reservations_required
- boat_dock, waterfront_bar
- family_friendly, upscale, casual

EXTRACTION RULES:
- ONLY extract information explicitly stated
- For each deal, include evidence_snippet (the exact quote where you found it)
- Prices must be in "$X.XX" format
- Times should be in "Xpm" format
- Set confidence scores honestly
- The content may come from MULTIPLE PAGES - note which page had each deal`;

const EXTRACTION_TOOLS = [{
  type: "function",
  function: {
    name: "extract_restaurant_details",
    description: "Extract comprehensive restaurant information including all deals and features",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number" },
        address: { type: "string", description: "Full street address" },
        hours: {
          type: "object",
          properties: {
            monday: { type: "string" },
            tuesday: { type: "string" },
            wednesday: { type: "string" },
            thursday: { type: "string" },
            friday: { type: "string" },
            saturday: { type: "string" },
            sunday: { type: "string" }
          }
        },
        deals: {
          type: "array",
          description: "ALL deals found (fish fry, happy hour, weekly specials, brunch, etc.)",
          items: {
            type: "object",
            properties: {
              deal_type: { 
                type: "string", 
                enum: ["fish_fry", "happy_hour", "brunch", "weekly_special", "kids_deal", "late_night"],
                description: "Type of deal"
              },
              name: { type: "string", description: "Name like 'Friday Fish Fry' or 'Taco Tuesday'" },
              days: { type: "array", items: { type: "string" }, description: "Days available" },
              start_time: { type: "string" },
              end_time: { type: "string" },
              description: { type: "string" },
              price: { type: "string", description: "Price like '$14.99'" },
              fish_type: { type: "string", description: "For fish fry: cod, perch, walleye, bluegill" },
              all_you_can_eat: { type: "boolean" },
              sides: { type: "string", description: "For fish fry: what sides are included" },
              drink_deals: { type: "array", items: { type: "string" } },
              food_deals: { type: "array", items: { type: "string" } },
              evidence_snippet: { type: "string", description: "Exact quote from the page where this was found" },
              confidence: { type: "number", description: "0-1 confidence this is accurate" }
            },
            required: ["deal_type", "name"]
          }
        },
        features: {
          type: "array",
          items: { type: "string" },
          description: "Features like: lakefront, patio, live_music, dog_friendly, sports_bar, private_dining, boat_dock, fire_pit"
        },
        cuisine_types: {
          type: "array",
          items: { type: "string" },
          description: "e.g., ['American', 'Seafood', 'Italian']"
        },
        price_range: {
          type: "string",
          enum: ["$", "$$", "$$$", "$$$$"],
          description: "Price range based on menu prices"
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
          }
        },
        extraction_confidence: {
          type: "object",
          properties: {
            fish_fry: { type: "number" },
            happy_hour: { type: "number" },
            hours: { type: "number" },
            overall: { type: "number" }
          }
        },
        extraction_notes: { type: "string" }
      },
      required: ["extraction_confidence"]
    }
  }
}];

// Keywords for page discovery
const MENU_KEYWORDS = ['menu', 'food', 'dinner', 'lunch', 'drink', 'appetizer', 'entree', 'dessert', 'specials', 'pricing'];
const SPECIAL_KEYWORDS = ['special', 'happy', 'hour', 'promotion', 'deal', 'fish', 'fry', 'friday', 'weekly', 'event', 'brunch'];
const HIGH_PRIORITY_PATHS = ['/menu', '/food-menu', '/dinner-menu', '/specials', '/weekly-specials', '/happy-hour', '/friday-fish-fry', '/events', '/food', '/drinks', '/brunch'];

// Fetch with retry and user-agent rotation
async function fetchWithRetry(url: string, retries = 2, timeout = 8000): Promise<{ text: string; contentType: string }> {
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        return { text, contentType };
      }
      
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

// Discover internal links including PDF links
function discoverInternalLinks(html: string, baseUrl: string): { htmlLinks: string[]; pdfLinks: string[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { htmlLinks: [], pdfLinks: [] };
  
  const htmlLinks: string[] = [];
  const pdfLinks: string[] = [];
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
        
        // Only same domain (or allow CDN for PDFs)
        const isSameDomain = fullUrl.hostname === baseDomain;
        const isPdf = fullUrl.pathname.toLowerCase().endsWith('.pdf');
        
        if (!isSameDomain && !isPdf) return;
        
        const path = fullUrl.pathname.toLowerCase();
        
        // Dedupe by path
        if (seenPaths.has(path)) return;
        seenPaths.add(path);
        
        // Check if PDF
        if (isPdf) {
          const linkText = (el.textContent || '').toLowerCase();
          if (linkText.includes('menu') || linkText.includes('special') || 
              path.includes('menu') || path.includes('special') ||
              linkText.includes('dinner') || linkText.includes('lunch')) {
            pdfLinks.push(fullUrl.toString());
          }
          return;
        }
        
        // Skip non-content paths
        if (path.includes('/wp-') || path.includes('/admin') || path.includes('/cart') || 
            path.includes('/checkout') || path.includes('/login') || path.includes('/account') ||
            path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.gif')) {
          return;
        }
        
        // Calculate priority based on keywords
        const linkText = (el.textContent || '').toLowerCase();
        const pathLower = path.toLowerCase();
        
        const isHighPriority = HIGH_PRIORITY_PATHS.some(p => path.startsWith(p)) ||
          MENU_KEYWORDS.some(k => pathLower.includes(k) || linkText.includes(k)) ||
          SPECIAL_KEYWORDS.some(k => pathLower.includes(k) || linkText.includes(k));
        
        if (isHighPriority) {
          htmlLinks.unshift(fullUrl.toString());
        } else if (path !== '/' && path.length > 1) {
          htmlLinks.push(fullUrl.toString());
        }
      } catch {
        // Invalid URL, skip
      }
    });
  } catch {
    // URL parsing failed
  }
  
  return { 
    htmlLinks: htmlLinks.slice(0, 15), 
    pdfLinks: pdfLinks.slice(0, 3) // Cap PDFs at 3
  };
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
  
  const bodyText = doc.body?.textContent || "";
  
  return bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, maxLength);
}

// Check if content has relevant keywords
function hasRelevantContent(content: string): boolean {
  const lower = content.toLowerCase();
  const keywords = ['fish fry', 'fish-fry', 'perch', 'walleye', 'cod fry', 'all you can eat', 
                    'happy hour', 'drink special', 'menu', 'appetizer', 'entree', 'price', '$',
                    'brunch', 'taco tuesday', 'wing', 'prime rib', 'specials'];
  return keywords.some(k => lower.includes(k));
}

// Extract text from PDF (basic approach - works for PDFs with text layer)
async function extractPdfText(pdfUrl: string): Promise<string | null> {
  try {
    console.log(`Attempting PDF extraction: ${pdfUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/pdf',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`PDF fetch failed: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Basic PDF text extraction - looks for text between stream markers
    // This works for PDFs with embedded text, not scanned images
    let text = '';
    let inStream = false;
    let streamContent = '';
    
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(bytes);
    
    // Extract text objects (Tj and TJ operators)
    const textMatches = pdfString.matchAll(/\(([^)]+)\)\s*Tj/g);
    for (const match of textMatches) {
      text += match[1] + ' ';
    }
    
    // Also try to extract from TJ arrays
    const tjMatches = pdfString.matchAll(/\[((?:[^[\]]+|\[[^\]]*\])*)\]\s*TJ/gi);
    for (const match of tjMatches) {
      const content = match[1];
      const stringMatches = content.matchAll(/\(([^)]*)\)/g);
      for (const strMatch of stringMatches) {
        text += strMatch[1] + ' ';
      }
    }
    
    // Clean up the text
    text = text
      .replace(/\\[0-9]{3}/g, ' ') // Octal escapes
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text.length > 100) {
      console.log(`Extracted ${text.length} chars from PDF`);
      return text.substring(0, 8000); // Cap at 8k chars
    }
    
    console.log('PDF text extraction yielded little text (may be image-based)');
    return null;
  } catch (err) {
    console.log(`PDF extraction error: ${err}`);
    return null;
  }
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

// Classify page type from URL
function classifyPageType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('menu')) return 'menu';
  if (lower.includes('special')) return 'specials';
  if (lower.includes('happy') || lower.includes('hour')) return 'happy_hour';
  if (lower.includes('event')) return 'events';
  if (lower.includes('brunch')) return 'brunch';
  if (lower.endsWith('.pdf')) return 'pdf_menu';
  return 'unknown';
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
      const { data } = await supabase
        .from("sources")
        .select("id, name, url, metadata")
        .in("type", ["firecrawl", "diy-scrape"])
        .eq("category", "restaurant")
        .eq("status", "active")
        .limit(limit);
      sources = data || [];
    }

    console.log(`Processing ${sources.length} restaurant sources with PDF + evidence support`);

    const results: Array<{ 
      name: string; 
      success: boolean; 
      error?: string; 
      confidence?: number; 
      pages_scraped?: number;
      pdfs_found?: number;
      deals_found?: number;
    }> = [];

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
          const result = await fetchWithRetry(source.url);
          homepageHtml = result.text;
          console.log(`Fetched homepage: ${homepageHtml.length} bytes`);
        } catch (err) {
          console.error(`Failed to fetch homepage for ${source.name}:`, err);
          await supabase.from("restaurant_scrape_jobs").update({
            status: 'failed',
            error_message: `Homepage fetch failed: ${err}`,
            completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          
          results.push({ name: source.name, success: false, error: String(err) });
          continue;
        }

        // PASS 2: Discover internal links + PDF links
        const { htmlLinks, pdfLinks } = discoverInternalLinks(homepageHtml, source.url);
        console.log(`Discovered ${htmlLinks.length} HTML pages, ${pdfLinks.length} PDFs`);
        
        // Also try common paths directly
        const baseUrl = new URL(source.url);
        const commonPaths = ['/menu', '/specials', '/happy-hour', '/food-menu', '/weekly-specials', '/friday-fish-fry'];
        for (const path of commonPaths) {
          const testUrl = `${baseUrl.origin}${path}`;
          if (!htmlLinks.includes(testUrl)) {
            htmlLinks.unshift(testUrl);
          }
        }

        // PASS 3: Fetch and combine content from multiple pages
        const pageContents: Array<{ url: string; content: string; type: string }> = [];
        
        // Always include homepage
        const homepageContent = extractRelevantContent(homepageHtml);
        pageContents.push({ url: source.url, content: homepageContent, type: 'homepage' });
        
        // Fetch HTML pages
        let pagesScraped = 1;
        for (const pageUrl of htmlLinks.slice(0, max_pages - 1)) {
          try {
            const result = await fetchWithRetry(pageUrl, 1, 5000);
            const pageContent = extractRelevantContent(result.text, 4000);
            
            if (pageContent.length > 200 && hasRelevantContent(pageContent)) {
              const pageType = classifyPageType(pageUrl);
              pageContents.push({ url: pageUrl, content: pageContent, type: pageType });
              pagesScraped++;
              console.log(`  ✓ Scraped ${pageUrl.replace(source.url, '')} (${pageContent.length} chars, type: ${pageType})`);
            }
          } catch (err) {
            console.log(`  ✗ Failed ${pageUrl}: ${err}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // PASS 4: Extract PDF content
        let pdfCount = 0;
        for (const pdfUrl of pdfLinks) {
          try {
            const pdfText = await extractPdfText(pdfUrl);
            if (pdfText && pdfText.length > 100) {
              pageContents.push({ url: pdfUrl, content: pdfText, type: 'pdf_menu' });
              pdfCount++;
              console.log(`  ✓ Extracted PDF ${pdfUrl} (${pdfText.length} chars)`);
            }
          } catch (err) {
            console.log(`  ✗ PDF failed ${pdfUrl}: ${err}`);
          }
        }

        await supabase.from("restaurant_scrape_jobs").update({
          status: 'extracting',
          pages_scraped: pagesScraped + pdfCount,
          discovered_pages: [...htmlLinks, ...pdfLinks],
          content_sources: pageContents.map(p => ({ url: p.url, type: p.type })),
        }).eq('id', job?.id);

        // Combine all content with page source labels
        const combinedContent = pageContents
          .map(p => `=== PAGE: ${p.url} (${p.type}) ===\n${p.content}`)
          .join('\n\n')
          .substring(0, 25000);

        console.log(`Combined content from ${pageContents.length} sources: ${combinedContent.length} chars`);

        // PASS 5: Call OpenAI for structured extraction
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
                content: `Extract restaurant data from ${source.name} in Lake Geneva. Content is from ${pageContents.length} pages including ${pdfCount} PDFs:\n\n${combinedContent}` 
              }
            ],
            tools: EXTRACTION_TOOLS,
            tool_choice: { type: "function", function: { name: "extract_restaurant_details" } },
            max_tokens: 3000,
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
          
          results.push({ name: source.name, success: false, error: `OpenAI error: ${openaiResponse.status}` });
          continue;
        }

        const openaiData = await openaiResponse.json();
        const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall?.function?.arguments) {
          console.error(`No tool call response for ${source.name}`);
          results.push({ name: source.name, success: false, error: "No extraction data" });
          continue;
        }

        const extraction: RestaurantExtraction = JSON.parse(toolCall.function.arguments);
        
        console.log(`Extracted data for ${source.name}:`, {
          deals: extraction.deals?.length || 0,
          features: extraction.features?.length || 0,
          confidence: extraction.extraction_confidence?.overall,
        });

        // PASS 6: Upsert restaurant
        const restaurantData = {
          name: source.name,
          slug: slugify(source.name),
          website: source.url,
          source_url: source.url,
          phone: normalizePhone(extraction.phone),
          address: extraction.address,
          hours: extraction.hours || {},
          cuisine_types: extraction.cuisine_types || [],
          features: extraction.features || [],
          price_range: extraction.price_range,
          signature_dishes: extraction.signature_dishes?.map(d => ({
            ...d,
            price: normalizePrice(d.price),
          })) || [],
          extraction_confidence: extraction.extraction_confidence || {},
          needs_review: (extraction.extraction_confidence?.overall || 0) < 0.6,
          extraction_notes: extraction.extraction_notes,
          last_scraped_at: new Date().toISOString(),
        };

        const { data: restaurant, error: upsertError } = await supabase
          .from("restaurants")
          .upsert(restaurantData, { onConflict: "slug" })
          .select()
          .single();

        if (upsertError) {
          console.error(`DB error for ${source.name}:`, upsertError);
          results.push({ name: source.name, success: false, error: upsertError.message });
          continue;
        }

        // PASS 7: Store discovered pages
        for (const page of pageContents) {
          if (page.url !== source.url) {
            await supabase.from("restaurant_pages").upsert({
              restaurant_id: restaurant.id,
              url: page.url,
              page_type: page.type,
              is_pdf: page.type === 'pdf_menu',
              status: 'scraped',
              last_scraped_at: new Date().toISOString(),
            }, { onConflict: 'restaurant_id,url' });
          }
        }

        // PASS 8: Store deals with evidence
        if (extraction.deals && extraction.deals.length > 0) {
          // Clear old deals from this source
          await supabase
            .from("restaurant_deals")
            .delete()
            .eq("restaurant_id", restaurant.id)
            .eq("source_type", "scraper");

          // Insert new deals
          const dealsToInsert = extraction.deals.map(deal => ({
            restaurant_id: restaurant.id,
            deal_type: deal.deal_type,
            name: deal.name,
            days: deal.days || [],
            start_time: deal.start_time,
            end_time: deal.end_time,
            description: deal.description,
            price: normalizePrice(deal.price),
            fish_type: deal.fish_type,
            all_you_can_eat: deal.all_you_can_eat,
            sides: deal.sides,
            drink_deals: deal.drink_deals,
            food_deals: deal.food_deals,
            verification_status: 'unverified',
            verification_method: pdfCount > 0 ? 'pdf' : 'scraped_text',
            evidence_url: source.url, // TODO: track which specific page
            evidence_snippet: deal.evidence_snippet,
            last_confirmed_at: new Date().toISOString(),
            source_type: 'scraper',
            confidence_score: deal.confidence || extraction.extraction_confidence?.overall,
          }));

          const { error: dealsError } = await supabase
            .from("restaurant_deals")
            .insert(dealsToInsert);

          if (dealsError) {
            console.error(`Deals insert error:`, dealsError);
          } else {
            console.log(`Inserted ${dealsToInsert.length} deals for ${source.name}`);
          }
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
            scraper_version: "v4-pdf-deals",
            pages_scraped: pagesScraped,
            pdfs_extracted: pdfCount,
            deals_found: extraction.deals?.length || 0,
          }
        }).eq("id", source.id);

        results.push({
          name: source.name,
          success: true,
          confidence: extraction.extraction_confidence?.overall,
          pages_scraped: pagesScraped,
          pdfs_found: pdfCount,
          deals_found: extraction.deals?.length || 0,
        });

        console.log(`✓ ${source.name}: ${extraction.deals?.length || 0} deals, ${pdfCount} PDFs`);
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        results.push({ name: source.name, success: false, error: String(err) });
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "scrape_restaurant_v4",
      entity_type: "restaurant",
      actor_type: "system",
      details: {
        sources_processed: sources.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_deals: results.reduce((a, b) => a + (b.deals_found || 0), 0),
        total_pdfs: results.reduce((a, b) => a + (b.pdfs_found || 0), 0),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        total_deals: results.reduce((a, b) => a + (b.deals_found || 0), 0),
        total_pdfs: results.reduce((a, b) => a + (b.pdfs_found || 0), 0),
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
