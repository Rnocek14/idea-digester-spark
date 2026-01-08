import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Canonical features enum - GPT must use these exact values
const CANONICAL_FEATURES = [
  'lakefront', 'lake_view', 'patio', 'outdoor_seating', 'rooftop',
  'live_music', 'trivia', 'karaoke', 'dj',
  'dog_friendly', 'sports_bar', 'private_dining', 'fire_pit', 'heated_patio',
  'boat_dock', 'waterfront_bar', 'reservations_required',
  'family_friendly', 'upscale', 'casual', 'bar', 'full_bar'
] as const;

// Deal extraction interface with per-deal evidence_url
interface DealExtraction {
  deal_type: string;
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
  evidence_url?: string; // MUST be the specific page URL where this was found
  evidence_snippet?: string;
  confidence?: number;
}

interface RestaurantExtraction {
  phone?: string;
  address?: string;
  hours?: Record<string, string>;
  deals?: DealExtraction[];
  features?: string[];
  cuisine_types?: string[];
  price_range?: string;
  signature_dishes?: Array<{ name: string; price?: string; description?: string }>;
  extraction_confidence?: {
    fish_fry?: number;
    happy_hour?: number;
    hours?: number;
    overall?: number;
  };
  extraction_notes?: string;
}

const SYSTEM_PROMPT = `You are an expert restaurant data extractor for Lake Geneva, Wisconsin.

CRITICAL: Extract ALL deals into the 'deals' array with proper classification.

DEAL TYPES (use exact values):
- fish_fry: Friday fish fry, perch, cod, walleye, bluegill
- happy_hour: drink/food deals during specific hours
- brunch: weekend brunch, buffet, bottomless mimosas
- weekly_special: Taco Tuesday, Wing Wednesday, Prime Rib Saturday
- kids_deal: kids eat free, children's pricing
- late_night: late night menu, after 10pm specials

FOR EACH DEAL YOU MUST:
1. Set evidence_url to the EXACT page URL where you found it (from the === PAGE: url === marker)
2. Set evidence_snippet to a direct quote (10-30 words) proving the deal exists
3. Set confidence score based on how clearly stated the deal is

FEATURES (use ONLY these exact values):
lakefront, lake_view, patio, outdoor_seating, rooftop, live_music, trivia, karaoke, dj,
dog_friendly, sports_bar, private_dining, fire_pit, heated_patio, boat_dock, waterfront_bar,
reservations_required, family_friendly, upscale, casual, bar, full_bar

EXTRACTION RULES:
- ONLY extract information explicitly stated
- Prices in "$X.XX" format
- Times in "Xpm" format (e.g., "3pm", "6:30pm")
- Look at each === PAGE: url === section and note which URL had each piece of data`;

const EXTRACTION_TOOLS = [{
  type: "function",
  function: {
    name: "extract_restaurant_details",
    description: "Extract comprehensive restaurant information including all deals and features",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string" },
        address: { type: "string" },
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
          description: "ALL deals found with per-deal evidence URLs",
          items: {
            type: "object",
            properties: {
              deal_type: { 
                type: "string", 
                enum: ["fish_fry", "happy_hour", "brunch", "weekly_special", "kids_deal", "late_night"]
              },
              name: { type: "string", description: "e.g., 'Friday Fish Fry', 'Taco Tuesday'" },
              days: { type: "array", items: { type: "string" } },
              start_time: { type: "string", description: "e.g., '3pm'" },
              end_time: { type: "string", description: "e.g., '6pm'" },
              description: { type: "string" },
              price: { type: "string" },
              fish_type: { type: "string" },
              all_you_can_eat: { type: "boolean" },
              sides: { type: "string" },
              drink_deals: { type: "array", items: { type: "string" } },
              food_deals: { type: "array", items: { type: "string" } },
              evidence_url: { type: "string", description: "The exact page URL from === PAGE: url === where this deal was found" },
              evidence_snippet: { type: "string", description: "Direct quote (10-30 words) proving this deal" },
              confidence: { type: "number" }
            },
            required: ["deal_type", "name", "evidence_url"]
          }
        },
        features: {
          type: "array",
          items: { 
            type: "string",
            enum: ["lakefront", "lake_view", "patio", "outdoor_seating", "rooftop", "live_music", 
                   "trivia", "karaoke", "dj", "dog_friendly", "sports_bar", "private_dining", 
                   "fire_pit", "heated_patio", "boat_dock", "waterfront_bar", "reservations_required",
                   "family_friendly", "upscale", "casual", "bar", "full_bar"]
          }
        },
        cuisine_types: { type: "array", items: { type: "string" } },
        price_range: { type: "string", enum: ["$", "$$", "$$$", "$$$$"] },
        signature_dishes: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, price: { type: "string" }, description: { type: "string" } }
          }
        },
        extraction_confidence: {
          type: "object",
          properties: { fish_fry: { type: "number" }, happy_hour: { type: "number" }, hours: { type: "number" }, overall: { type: "number" } }
        },
        extraction_notes: { type: "string" }
      },
      required: ["extraction_confidence"]
    }
  }
}];

const MENU_KEYWORDS = ['menu', 'food', 'dinner', 'lunch', 'drink', 'appetizer', 'entree', 'dessert', 'specials', 'pricing'];
const SPECIAL_KEYWORDS = ['special', 'happy', 'hour', 'promotion', 'deal', 'fish', 'fry', 'friday', 'weekly', 'event', 'brunch'];
const HIGH_PRIORITY_PATHS = ['/menu', '/food-menu', '/dinner-menu', '/specials', '/weekly-specials', '/happy-hour', '/friday-fish-fry', '/events', '/food', '/drinks', '/brunch'];

// Fetch with retry
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
        return { text: await res.text(), contentType: res.headers.get('content-type') || '' };
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

// Discover internal links including PDFs
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
        
        const isSameDomain = fullUrl.hostname === baseDomain;
        const isPdf = fullUrl.pathname.toLowerCase().endsWith('.pdf');
        
        if (!isSameDomain && !isPdf) return;
        
        const path = fullUrl.pathname.toLowerCase();
        if (seenPaths.has(path)) return;
        seenPaths.add(path);
        
        if (isPdf) {
          const linkText = (el.textContent || '').toLowerCase();
          if (linkText.includes('menu') || linkText.includes('special') || 
              path.includes('menu') || path.includes('special') ||
              linkText.includes('dinner') || linkText.includes('lunch')) {
            pdfLinks.push(fullUrl.toString());
          }
          return;
        }
        
        if (path.includes('/wp-') || path.includes('/admin') || path.includes('/cart') || 
            path.includes('/checkout') || path.includes('/login') || path.includes('/account') ||
            path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.gif')) {
          return;
        }
        
        const linkText = (el.textContent || '').toLowerCase();
        const isHighPriority = HIGH_PRIORITY_PATHS.some(p => path.startsWith(p)) ||
          MENU_KEYWORDS.some(k => path.includes(k) || linkText.includes(k)) ||
          SPECIAL_KEYWORDS.some(k => path.includes(k) || linkText.includes(k));
        
        if (isHighPriority) {
          htmlLinks.unshift(fullUrl.toString());
        } else if (path !== '/' && path.length > 1) {
          htmlLinks.push(fullUrl.toString());
        }
      } catch { /* skip invalid URLs */ }
    });
  } catch { /* skip */ }
  
  return { htmlLinks: htmlLinks.slice(0, 15), pdfLinks: pdfLinks.slice(0, 3) };
}

// Extract relevant content from HTML
function extractRelevantContent(html: string, maxLength = 6000): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return html.substring(0, maxLength);
  
  ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg', 'form'].forEach(sel => {
    doc.querySelectorAll(sel).forEach((el: any) => el._remove?.() || el.parentNode?.removeChild(el));
  });
  
  return (doc.body?.textContent || "")
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, maxLength);
}

function hasRelevantContent(content: string): boolean {
  const lower = content.toLowerCase();
  return ['fish fry', 'perch', 'walleye', 'cod fry', 'all you can eat', 
          'happy hour', 'menu', 'appetizer', '$', 'brunch', 'taco', 'wing', 'prime rib']
    .some(k => lower.includes(k));
}

// PDF extraction with guardrails
async function extractPdfText(pdfUrl: string): Promise<{ text: string | null; status: string; chars: number }> {
  try {
    console.log(`Attempting PDF extraction: ${pdfUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { text: null, status: 'error', chars: 0 };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(bytes);
    
    let text = '';
    
    // Extract Tj text objects
    for (const match of pdfString.matchAll(/\(([^)]+)\)\s*Tj/g)) {
      text += match[1] + ' ';
    }
    
    // Extract TJ arrays
    for (const match of pdfString.matchAll(/\[((?:[^[\]]+|\[[^\]]*\])*)\]\s*TJ/gi)) {
      for (const strMatch of match[1].matchAll(/\(([^)]*)\)/g)) {
        text += strMatch[1] + ' ';
      }
    }
    
    text = text
      .replace(/\\[0-9]{3}/g, ' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r|\\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Guardrails: validate extraction quality
    if (text.length < 300) {
      console.log(`PDF text too short (${text.length} chars) - likely image-based`);
      return { text: null, status: 'image_based', chars: text.length };
    }
    
    const lower = text.toLowerCase();
    const hasRelevantKeywords = ['$', 'fish', 'fry', 'happy hour', 'brunch', 'taco', 'wing', 'menu', 'appetizer']
      .some(k => lower.includes(k));
    
    if (!hasRelevantKeywords) {
      console.log(`PDF text lacks relevant keywords`);
      return { text: null, status: 'no_keywords', chars: text.length };
    }
    
    console.log(`Extracted ${text.length} chars from PDF (valid)`);
    return { text: text.substring(0, 8000), status: 'ok', chars: text.length };
    
  } catch (err) {
    console.log(`PDF extraction error: ${err}`);
    return { text: null, status: 'error', chars: 0 };
  }
}

// Normalize features to canonical set
function normalizeFeatures(features: string[]): string[] {
  const featureMap: Record<string, string> = {
    'outdoor seating': 'outdoor_seating',
    'outdoor dining': 'outdoor_seating',
    'patio seating': 'patio',
    'lake view': 'lake_view',
    'lakeview': 'lake_view',
    'water view': 'lake_view',
    'live entertainment': 'live_music',
    'live band': 'live_music',
    'trivia night': 'trivia',
    'dog-friendly': 'dog_friendly',
    'pet friendly': 'dog_friendly',
    'reservations': 'reservations_required',
    'family dining': 'family_friendly',
    'kids menu': 'family_friendly',
  };
  
  const normalized = features.map(f => {
    const lower = f.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    return featureMap[f.toLowerCase()] || 
           (CANONICAL_FEATURES.includes(lower as any) ? lower : null);
  }).filter(Boolean) as string[];
  
  return [...new Set(normalized)];
}

// Parse time string to minutes since midnight
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  
  const match = timeStr.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3];
  
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

// Generate stable deal hash for upsert
function generateDealHash(restaurantId: string, deal: DealExtraction): string {
  const parts = [
    restaurantId,
    deal.deal_type,
    (deal.name || '').toLowerCase().replace(/\s+/g, '-').substring(0, 30),
    (deal.days || []).sort().join(','),
    deal.start_time || '',
    deal.end_time || ''
  ];
  
  // Simple hash using string encoding
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `deal_${Math.abs(hash).toString(16)}`;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return phone;
}

function normalizePrice(price?: string): string | undefined {
  if (!price) return undefined;
  const match = price.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? `$${parseFloat(match[1]).toFixed(2)}` : price;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
}

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
    const { source_id, limit = 5, max_pages = 5 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch restaurant sources
    let sources: Array<{ id: string; name: string; url: string; metadata: any }> = [];

    if (source_id) {
      const { data } = await supabase.from("sources").select("id, name, url, metadata").eq("id", source_id).single();
      if (data) sources = [data];
    } else {
      const { data } = await supabase.from("sources").select("id, name, url, metadata")
        .in("type", ["firecrawl", "diy-scrape"]).eq("category", "restaurant").eq("status", "active").limit(limit);
      sources = data || [];
    }

    console.log(`Processing ${sources.length} restaurant sources with gpt-4o + PDF + evidence tracking`);

    const results: Array<{ name: string; success: boolean; error?: string; confidence?: number; pages_scraped?: number; pdfs_found?: number; deals_found?: number }> = [];

    for (const source of sources) {
      try {
        console.log(`\n=== Scraping ${source.name}: ${source.url} ===`);
        
        const { data: job } = await supabase.from("restaurant_scrape_jobs").upsert({
          source_id: source.id,
          restaurant_slug: slugify(source.name),
          status: 'discovering',
          started_at: new Date().toISOString(),
        }, { onConflict: 'source_id' }).select().single();

        // Fetch homepage
        let homepageHtml: string;
        try {
          const result = await fetchWithRetry(source.url);
          homepageHtml = result.text;
          console.log(`Fetched homepage: ${homepageHtml.length} bytes`);
        } catch (err) {
          await supabase.from("restaurant_scrape_jobs").update({
            status: 'failed', error_message: `Homepage fetch failed: ${err}`, completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          results.push({ name: source.name, success: false, error: String(err) });
          continue;
        }

        // Discover links
        const { htmlLinks, pdfLinks } = discoverInternalLinks(homepageHtml, source.url);
        console.log(`Discovered ${htmlLinks.length} HTML pages, ${pdfLinks.length} PDFs`);
        
        // Add common paths
        const baseUrl = new URL(source.url);
        for (const path of ['/menu', '/specials', '/happy-hour', '/food-menu', '/weekly-specials', '/friday-fish-fry']) {
          const testUrl = `${baseUrl.origin}${path}`;
          if (!htmlLinks.includes(testUrl)) htmlLinks.unshift(testUrl);
        }

        // Fetch pages
        const pageContents: Array<{ url: string; content: string; type: string }> = [];
        const homepageContent = extractRelevantContent(homepageHtml);
        pageContents.push({ url: source.url, content: homepageContent, type: 'homepage' });
        
        let pagesScraped = 1;
        for (const pageUrl of htmlLinks.slice(0, max_pages - 1)) {
          try {
            const result = await fetchWithRetry(pageUrl, 1, 5000);
            const pageContent = extractRelevantContent(result.text, 4000);
            
            if (pageContent.length > 200 && hasRelevantContent(pageContent)) {
              pageContents.push({ url: pageUrl, content: pageContent, type: classifyPageType(pageUrl) });
              pagesScraped++;
              console.log(`  ✓ ${pageUrl.replace(source.url, '')} (${pageContent.length} chars)`);
            }
          } catch (err) {
            console.log(`  ✗ ${pageUrl}: ${err}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // Extract PDFs with guardrails
        let pdfCount = 0;
        for (const pdfUrl of pdfLinks) {
          const pdfResult = await extractPdfText(pdfUrl);
          
          // Store PDF page status
          if (job?.id) {
            // Store PDF status - ignore errors since restaurant_id may not match yet
            try {
              await supabase.from("restaurant_pages").upsert({
                restaurant_id: job.id,
                url: pdfUrl,
                page_type: 'pdf_menu',
                is_pdf: true,
                pdf_extraction_status: pdfResult.status,
                pdf_extraction_chars: pdfResult.chars,
                status: pdfResult.text ? 'scraped' : 'failed',
                last_scraped_at: new Date().toISOString(),
              }, { onConflict: 'restaurant_id,url' });
            } catch { /* ignore */ }
          }
          
          if (pdfResult.text) {
            pageContents.push({ url: pdfUrl, content: pdfResult.text, type: 'pdf_menu' });
            pdfCount++;
            console.log(`  ✓ PDF ${pdfUrl} (${pdfResult.chars} chars, status: ${pdfResult.status})`);
          }
        }

        await supabase.from("restaurant_scrape_jobs").update({
          status: 'extracting',
          pages_scraped: pagesScraped + pdfCount,
          discovered_pages: [...htmlLinks, ...pdfLinks],
          content_sources: pageContents.map(p => ({ url: p.url, type: p.type })),
        }).eq('id', job?.id);

        // Combine content with clear page markers
        const combinedContent = pageContents
          .map(p => `=== PAGE: ${p.url} (${p.type}) ===\n${p.content}`)
          .join('\n\n')
          .substring(0, 25000);

        console.log(`Combined ${pageContents.length} sources: ${combinedContent.length} chars`);

        // Call GPT-4o
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Extract data from ${source.name}. Content from ${pageContents.length} pages:\n\n${combinedContent}` }
            ],
            tools: EXTRACTION_TOOLS,
            tool_choice: { type: "function", function: { name: "extract_restaurant_details" } },
            max_tokens: 3000,
          }),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`OpenAI error:`, errorText);
          await supabase.from("restaurant_scrape_jobs").update({
            status: 'failed', error_message: `OpenAI error: ${openaiResponse.status}`, completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          results.push({ name: source.name, success: false, error: `OpenAI error: ${openaiResponse.status}` });
          continue;
        }

        const openaiData = await openaiResponse.json();
        const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall?.function?.arguments) {
          results.push({ name: source.name, success: false, error: "No extraction data" });
          continue;
        }

        const extraction: RestaurantExtraction = JSON.parse(toolCall.function.arguments);
        console.log(`Extracted: ${extraction.deals?.length || 0} deals, ${extraction.features?.length || 0} features`);

        // Upsert restaurant
        const restaurantData = {
          name: source.name,
          slug: slugify(source.name),
          website: source.url,
          source_url: source.url,
          phone: normalizePhone(extraction.phone),
          address: extraction.address,
          hours: extraction.hours || {},
          cuisine_types: extraction.cuisine_types || [],
          features: normalizeFeatures(extraction.features || []),
          price_range: extraction.price_range,
          signature_dishes: extraction.signature_dishes?.map(d => ({ ...d, price: normalizePrice(d.price) })) || [],
          extraction_confidence: extraction.extraction_confidence || {},
          needs_review: (extraction.extraction_confidence?.overall || 0) < 0.6,
          extraction_notes: extraction.extraction_notes,
          last_scraped_at: new Date().toISOString(),
        };

        const { data: restaurant, error: upsertError } = await supabase
          .from("restaurants").upsert(restaurantData, { onConflict: "slug" }).select().single();

        if (upsertError || !restaurant) {
          console.error(`DB error:`, upsertError);
          results.push({ name: source.name, success: false, error: upsertError?.message });
          continue;
        }

        // Store discovered pages
        for (const page of pageContents) {
          if (page.url !== source.url) {
            try {
              await supabase.from("restaurant_pages").upsert({
                restaurant_id: restaurant.id,
                url: page.url,
                page_type: page.type,
                is_pdf: page.type === 'pdf_menu',
                status: 'scraped',
                last_scraped_at: new Date().toISOString(),
              }, { onConflict: 'restaurant_id,url' });
            } catch { /* ignore duplicates */ }
          }
        }

        // UPSERT deals with deal_hash (no delete/insert!)
        const now = new Date().toISOString();
        const seenHashes: string[] = [];
        
        if (extraction.deals && extraction.deals.length > 0) {
          for (const deal of extraction.deals) {
            const dealHash = generateDealHash(restaurant.id, deal);
            seenHashes.push(dealHash);
            
            const startMinutes = parseTimeToMinutes(deal.start_time || '');
            const endMinutes = parseTimeToMinutes(deal.end_time || '');
            
            const dealData = {
              deal_hash: dealHash,
              restaurant_id: restaurant.id,
              deal_type: deal.deal_type,
              name: deal.name,
              days: deal.days || [],
              start_time: deal.start_time,
              end_time: deal.end_time,
              start_minutes: startMinutes,
              end_minutes: endMinutes,
              description: deal.description,
              price: normalizePrice(deal.price),
              fish_type: deal.fish_type,
              all_you_can_eat: deal.all_you_can_eat,
              sides: deal.sides,
              drink_deals: deal.drink_deals,
              food_deals: deal.food_deals,
              verification_status: 'unverified',
              verification_method: pdfCount > 0 ? 'pdf' : 'scraped_text',
              evidence_url: deal.evidence_url || source.url, // Use GPT-provided URL or fallback
              evidence_snippet: deal.evidence_snippet,
              last_confirmed_at: now,
              last_seen_at: now,
              source_type: 'scraper',
              confidence_score: deal.confidence || extraction.extraction_confidence?.overall,
            };

            await supabase.from("restaurant_deals").upsert(dealData, { onConflict: 'deal_hash' });
          }
          
          // Mark deals not seen in this scrape as outdated (instead of deleting)
          await supabase.from("restaurant_deals")
            .update({ verification_status: 'outdated', valid_to: now })
            .eq('restaurant_id', restaurant.id)
            .eq('source_type', 'scraper')
            .not('deal_hash', 'in', `(${seenHashes.join(',')})`);
            
          console.log(`Upserted ${seenHashes.length} deals for ${source.name}`);
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
          last_fetched_at: now,
          type: "diy-scrape",
          status: "active",
          metadata: { 
            ...(source.metadata || {}), 
            scraper_version: "v5-evidence-hash",
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

        console.log(`✓ ${source.name}: ${extraction.deals?.length || 0} deals`);
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        results.push({ name: source.name, success: false, error: String(err) });
      }
    }

    await supabase.from("activity_log").insert({
      action: "scrape_restaurant_v5",
      entity_type: "restaurant",
      actor_type: "system",
      details: {
        sources_processed: sources.length,
        successful: results.filter(r => r.success).length,
        total_deals: results.reduce((a, b) => a + (b.deals_found || 0), 0),
        total_pdfs: results.reduce((a, b) => a + (b.pdfs_found || 0), 0),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      total_deals: results.reduce((a, b) => a + (b.deals_found || 0), 0),
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
