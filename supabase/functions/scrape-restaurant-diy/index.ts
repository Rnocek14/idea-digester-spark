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
  evidence_url?: string;
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
1. Set evidence_url to the EXACT page URL where you found it (copy from === PAGE: url === marker)
2. NEVER use the homepage URL if the deal info appears on ANY other page (specials, menu, happy-hour, etc.)
3. Set evidence_snippet to a direct quote (10-30 words) proving the deal exists - MUST be verbatim text from that page
4. Set confidence score based on how clearly stated the deal is

FEATURES (use ONLY these exact values):
lakefront, lake_view, patio, outdoor_seating, rooftop, live_music, trivia, karaoke, dj,
dog_friendly, sports_bar, private_dining, fire_pit, heated_patio, boat_dock, waterfront_bar,
reservations_required, family_friendly, upscale, casual, bar, full_bar

EXTRACTION RULES:
- ONLY extract information explicitly stated
- Prices in "$X.XX" format
- Times MUST include am/pm (e.g., "3pm", "6:30pm") - never just "3" or "6"
- Look at each === PAGE: url === section and note which URL had each piece of data
- Prefer non-homepage URLs for evidence_url whenever the deal appears on a dedicated page`;

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
              start_time: { type: "string", description: "Must include am/pm, e.g., '3pm'" },
              end_time: { type: "string", description: "Must include am/pm, e.g., '6pm'" },
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

// SHA-256 hash for stable deal IDs
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateDealHash(restaurantId: string, deal: DealExtraction): Promise<string> {
  const normName = (deal.name || "").toLowerCase().trim().replace(/\s+/g, " ");
  const normDays = (deal.days || []).map(d => d.toLowerCase()).sort().join(",");
  const key = [restaurantId, deal.deal_type, normName, normDays, deal.start_time || "", deal.end_time || ""].join("|");
  return `deal_${(await sha256Hex(key)).slice(0, 24)}`;
}

// Normalize URL for evidence validation (FIX #4: aggressive normalization + www)
function normalizeUrlForValidation(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    // Force HTTPS
    u.protocol = "https:";
    // Normalize www
    u.hostname = u.hostname.replace(/^www\./, '');
    u.hash = "";
    // Remove common tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref', 'v'].forEach(p => u.searchParams.delete(p));
    // Strip trailing slash from pathname
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return u.origin + path;
  } catch {
    return urlStr;
  }
}

// Normalize text for snippet matching (handles curly quotes, punctuation, whitespace)
function normalizeTextForMatching(s: string): string {
  return s.toLowerCase()
    .replace(/[\u201C\u201D]/g, '"')  // curly double quotes → straight
    .replace(/[\u2018\u2019]/g, "'")  // curly single quotes → straight
    .replace(/[^a-z0-9$%:.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Page type priority for evidence URL ranking
const PAGE_TYPE_PRIORITY: Record<string, number> = {
  happy_hour: 1,
  specials: 2,
  brunch: 3,
  menu: 4,
  events: 10,
  pdf_menu: 5,
  unknown: 99,
  homepage: 100,
};

// Enhanced fetch with retry, anti-bot evasion, and Firecrawl fallback
async function fetchWithRetry(
  url: string, 
  retries = 2, 
  timeout = 10000,
  useFirecrawlFallback = true
): Promise<{ text: string; contentType: string; usedFirecrawl: boolean }> {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  ];
  
  let lastError: Error | null = null;
  let needsJsRendering = false;
  
  // Try static fetch first
  for (let i = 0; i <= retries; i++) {
    try {
      // Add randomized delay between retries to appear more human-like
      if (i > 0) {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Get hostname for referer
      let referer = '';
      try {
        const u = new URL(url);
        referer = u.origin;
      } catch {}
      
      const res = await fetch(url, {
        headers: { 
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          'Referer': referer,
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const text = await res.text();
        const contentType = res.headers.get('content-type') || '';
        
        // Detect JS-heavy sites that return minimal content
        if (text.length < 1000) {
          const lowerText = text.toLowerCase();
          // Check for SPA framework indicators
          if (lowerText.includes('__next_data__') || 
              lowerText.includes('ng-app') || 
              lowerText.includes('data-reactroot') ||
              lowerText.includes('id="app"') && lowerText.includes('script')) {
            console.log(`Detected JS-heavy site: ${url} (${text.length} chars)`);
            needsJsRendering = true;
            break;
          }
        }
        
        return { text, contentType, usedFirecrawl: false };
      }
      
      // Track errors that might benefit from Firecrawl
      if (res.status === 403 || res.status === 429) {
        console.log(`Got ${res.status} for ${url}, will try Firecrawl fallback`);
        lastError = new Error(`HTTP ${res.status}`);
        needsJsRendering = true;
        break;
      }
      
      throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      lastError = e;
      if (e.name === 'AbortError') {
        lastError = new Error('Timeout');
      }
      if (i === retries && !useFirecrawlFallback) throw lastError;
    }
  }
  
  // Try Firecrawl fallback for blocked/JS-heavy sites
  if (useFirecrawlFallback && (needsJsRendering || lastError)) {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (firecrawlKey) {
      try {
        console.log(`Using Firecrawl fallback for: ${url}`);
        const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['html'],
            onlyMainContent: false,
            waitFor: 2000,
          }),
        });
        
        if (fcResponse.ok) {
          const fcData = await fcResponse.json();
          const html = fcData.data?.html || fcData.html || '';
          if (html.length > 500) {
            console.log(`Firecrawl success: ${html.length} chars`);
            return { text: html, contentType: 'text/html', usedFirecrawl: true };
          }
        } else {
          const errText = await fcResponse.text();
          console.log(`Firecrawl error ${fcResponse.status}: ${errText.slice(0, 200)}`);
        }
      } catch (fcErr) {
        console.log(`Firecrawl fallback failed: ${fcErr}`);
      }
    }
  }
  
  // If we get here, everything failed
  throw lastError || new Error('Fetch failed after retries');
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
          'happy hour', 'menu', 'appetizer', '$', 'brunch', 'taco', 'wing', 'prime rib',
          'special', 'friday', 'saturday', 'sunday', 'drink', 'food']
    .some(k => lower.includes(k));
}

// HIGH_PRIORITY page types that should always be included regardless of hasRelevantContent
const HIGH_PRIORITY_PAGE_TYPES = ['menu', 'specials', 'happy_hour', 'brunch', 'events'];

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
    
    for (const match of pdfString.matchAll(/\(([^)]+)\)\s*Tj/g)) {
      text += match[1] + ' ';
    }
    
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

// Parse time string to minutes since midnight (require am/pm unless hour >= 13)
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  
  const match = timeStr.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3];
  
  // If no am/pm specified, only accept if hour >= 13 (24h format)
  if (!period) {
    if (hours >= 13 && hours <= 23) {
      return hours * 60 + minutes;
    }
    // Can't determine - return null
    return null;
  }
  
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
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

    console.log(`Processing ${sources.length} restaurant sources with gpt-4o + v7 fixes`);

    const results: Array<{ name: string; success: boolean; error?: string; confidence?: number; pages_scraped?: number; pdfs_found?: number; deals_found?: number }> = [];

    for (const source of sources) {
      // FIX #1: Define 'now' at the top of loop scope
      const now = new Date().toISOString();
      
      try {
        console.log(`\n=== Scraping ${source.name}: ${source.url} ===`);
        
        const { data: job } = await supabase.from("restaurant_scrape_jobs").upsert({
          source_id: source.id,
          restaurant_slug: slugify(source.name),
          status: 'discovering',
          started_at: now,
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

        // Fetch pages - track URLs for evidence validation (non-PDFs only in first pass)
        const pageContents: Array<{ url: string; content: string; type: string }> = [];
        const homepageContent = extractRelevantContent(homepageHtml);
        pageContents.push({ url: source.url, content: homepageContent, type: 'homepage' });
        
        let pagesScraped = 1;
        for (const pageUrl of htmlLinks.slice(0, max_pages - 1)) {
          try {
            const result = await fetchWithRetry(pageUrl, 1, 5000);
            const pageContent = extractRelevantContent(result.text, 4000);
            const pageType = classifyPageType(pageUrl);
            
            // FIX: Always include high-priority page types OR pages with relevant content
            const isHighPriorityType = HIGH_PRIORITY_PAGE_TYPES.includes(pageType);
            const hasRelevant = hasRelevantContent(pageContent);
            
            if (pageContent.length > 200 && (isHighPriorityType || hasRelevant)) {
              pageContents.push({ url: pageUrl, content: pageContent, type: pageType });
              pagesScraped++;
              console.log(`  ✓ ${pageUrl.replace(source.url, '')} (${pageContent.length} chars, type: ${pageType})`);
            }
          } catch (err) {
            console.log(`  ✗ ${pageUrl}: ${err}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // Extract PDFs with guardrails (FIX #5: store PDFs only via pdfResults, not duplicated)
        let pdfCount = 0;
        const pdfResults: Array<{ url: string; status: string; chars: number; text: string | null }> = [];
        
        for (const pdfUrl of pdfLinks) {
          const pdfResult = await extractPdfText(pdfUrl);
          pdfResults.push({ url: pdfUrl, status: pdfResult.status, chars: pdfResult.chars, text: pdfResult.text });
          
          if (pdfResult.text) {
            // Add to pageContents for GPT extraction
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

        // Build allowed URLs set for evidence validation (FIX #4: normalize URLs)
        const allowedUrlsNormalized = new Set(pageContents.map(p => normalizeUrlForValidation(p.url)));
        const urlNormToOriginal = new Map(pageContents.map(p => [normalizeUrlForValidation(p.url), p.url]));
        
        // Build content map for snippet validation (NEW: validate evidence_snippet exists)
        const urlContentMap = new Map(pageContents.map(p => [normalizeUrlForValidation(p.url), p.content.toLowerCase()]));
        
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
          last_scraped_at: now,
        };

        const { data: restaurant, error: upsertError } = await supabase
          .from("restaurants").upsert(restaurantData, { onConflict: "slug" }).select().single();

        if (upsertError || !restaurant) {
          console.error(`DB error:`, upsertError);
          results.push({ name: source.name, success: false, error: upsertError?.message });
          continue;
        }

        // Store discovered pages AFTER we have restaurant.id (FIX #5: only non-PDFs here)
        for (const page of pageContents) {
          if (page.url !== source.url && page.type !== 'pdf_menu') {
            try {
              await supabase.from("restaurant_pages").upsert({
                restaurant_id: restaurant.id,
                url: page.url,
                page_type: page.type,
                is_pdf: false,
                status: 'scraped',
                last_scraped_at: now,
              }, { onConflict: 'restaurant_id,url' });
            } catch { /* ignore */ }
          }
        }
        
        // Store PDF extraction statuses (FIX #5: PDFs stored only here, not duplicated)
        for (const pdf of pdfResults) {
          try {
            await supabase.from("restaurant_pages").upsert({
              restaurant_id: restaurant.id,
              url: pdf.url,
              page_type: 'pdf_menu',
              is_pdf: true,
              pdf_extraction_status: pdf.status,
              pdf_extraction_chars: pdf.chars,
              status: pdf.status === 'ok' ? 'scraped' : 'failed',
              last_scraped_at: now,
            }, { onConflict: 'restaurant_id,url' });
          } catch { /* ignore */ }
        }

        // FIX #2: Fetch ALL existing deals once (not per-deal)
        const { data: existingDeals } = await supabase
          .from("restaurant_deals")
          .select("id, deal_hash, verification_status")
          .eq("restaurant_id", restaurant.id);
        
        const verifiedMap = new Map(
          (existingDeals || []).map(d => [d.deal_hash, d.verification_status])
        );

        // Helper to validate and sanitize evidence_url (FIX #4: normalize before checking)
        const sanitizeEvidenceUrl = (url: string | undefined): string => {
          if (!url) return source.url;
          try {
            const normalized = normalizeUrlForValidation(url);
            if (allowedUrlsNormalized.has(normalized)) {
              // Return the original URL from our scraped set (preserves casing, etc.)
              return urlNormToOriginal.get(normalized) || url;
            }
            return source.url;
          } catch {
            return source.url;
          }
        };
        
        // IMPROVED: Validate that evidence_snippet exists in the page content (normalized matching)
        const validateSnippet = (snippet: string | undefined, evidenceUrl: string): { valid: boolean; matchScore: number } => {
          if (!snippet || snippet.length < 10) return { valid: false, matchScore: 0 };
          const normalizedUrl = normalizeUrlForValidation(evidenceUrl);
          const pageContent = urlContentMap.get(normalizedUrl);
          if (!pageContent) return { valid: false, matchScore: 0 };
          
          const snippetNorm = normalizeTextForMatching(snippet);
          const contentNorm = normalizeTextForMatching(pageContent);
          
          // Try multiple probes: 30 chars, 20 chars, or first 10 words
          const probes = [
            snippetNorm.slice(0, 30),
            snippetNorm.slice(0, 20),
            snippetNorm.split(' ').slice(0, 10).join(' ')
          ].filter(p => p.length >= 12);
          
          const found = probes.some(p => contentNorm.includes(p));
          return { valid: found, matchScore: found ? 1 : 0 };
        };
        
        // IMPROVED: Find better evidence URL for key deal types when homepage is used (page-type ranked)
        const findBetterEvidenceUrl = (deal: DealExtraction, currentUrl: string): string => {
          const homepageNorm = normalizeUrlForValidation(source.url);
          const currentNorm = normalizeUrlForValidation(currentUrl);
          
          // Only override for fish_fry, happy_hour, brunch when evidence is homepage
          if (currentNorm !== homepageNorm) return currentUrl;
          if (!['fish_fry', 'happy_hour', 'brunch'].includes(deal.deal_type)) return currentUrl;
          
          const dealHint = (deal.name || '').toLowerCase();
          const keywords = dealHint.split(/\s+/).filter(w => w.length >= 4).slice(0, 6);
          if (keywords.length === 0) return currentUrl;
          
          // Find non-homepage pages containing deal keywords, ranked by page type priority
          const nonHomeCandidates = pageContents.filter(p => 
            normalizeUrlForValidation(p.url) !== homepageNorm
          );
          
          const candidates = nonHomeCandidates
            .filter(p => {
              const contentLower = p.content.toLowerCase();
              return keywords.some(k => contentLower.includes(k));
            })
            .sort((a, b) => (PAGE_TYPE_PRIORITY[a.type] ?? 99) - (PAGE_TYPE_PRIORITY[b.type] ?? 99));
          
          if (candidates.length > 0) {
            console.log(`  ↗ Evidence URL upgraded: ${deal.name} → ${candidates[0].url} (type: ${candidates[0].type})`);
            return candidates[0].url;
          }
          return currentUrl;
        };

        // FIX #6: Batch deal upserts instead of per-deal
        const seenHashes: string[] = [];
        const dealUpserts: Record<string, any>[] = [];
        let badEvidenceCount = 0;
        
        if (extraction.deals && extraction.deals.length > 0) {
          for (const deal of extraction.deals) {
            const dealHash = await generateDealHash(restaurant.id, deal);
            seenHashes.push(dealHash);
            
            const startMinutes = parseTimeToMinutes(deal.start_time || '');
            const endMinutes = parseTimeToMinutes(deal.end_time || '');
            
            // First get initial evidence URL
            let validatedEvidenceUrl = sanitizeEvidenceUrl(deal.evidence_url);
            
            // NEW: Try to find a better evidence URL for key deal types, then re-sanitize
            validatedEvidenceUrl = sanitizeEvidenceUrl(findBetterEvidenceUrl(deal, validatedEvidenceUrl));
            
            // IMPROVED: Validate snippet exists in the evidence page
            const snippetValidation = validateSnippet(deal.evidence_snippet, validatedEvidenceUrl);
            
            // Calculate confidence with proper downgrade for invalid snippets
            let confidenceScore = deal.confidence || extraction.extraction_confidence?.overall || 0.5;
            if (!snippetValidation.valid && deal.evidence_snippet) {
              confidenceScore = Math.min(confidenceScore, 0.35); // Hard downgrade
              badEvidenceCount++;
              console.log(`  ⚠ Deal "${deal.name}" snippet not found → confidence=${confidenceScore.toFixed(2)}`);
            }
            
            // Determine verification_method based on evidence_url
            const verificationMethod = validatedEvidenceUrl.toLowerCase().endsWith('.pdf') 
              ? 'pdf' 
              : 'scraped_text';
            
            // Check if deal is human-verified (FIX #2: use cached map)
            const existingStatus = verifiedMap.get(dealHash);
            const isHumanVerified = existingStatus === 'verified' || existingStatus === 'community_verified';
            
            const dealData: Record<string, any> = {
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
              evidence_url: validatedEvidenceUrl,
              evidence_snippet: deal.evidence_snippet,
              last_confirmed_at: now,
              last_seen_at: now,
              source_type: 'scraper',
              confidence_score: confidenceScore,
            };
            
            // Only update verification fields if not human-verified
            if (!isHumanVerified) {
              dealData.verification_status = 'unverified';
              dealData.verification_method = verificationMethod;
            }

            dealUpserts.push(dealData);
          }
          
          // FIX #6: Single batch upsert with error logging
          if (dealUpserts.length > 0) {
            const { error: dealUpsertError } = await supabase
              .from("restaurant_deals")
              .upsert(dealUpserts, { onConflict: 'deal_hash' });
            
            if (dealUpsertError) {
              console.error(`Deal upsert failed for ${source.name}:`, dealUpsertError.message);
            } else {
              console.log(`Batch upserted ${dealUpserts.length} deals for ${source.name}`);
            }
          }
          
          // FIX #3: Mark unseen deals as outdated ONLY if not human-verified
          if (seenHashes.length > 0 && existingDeals) {
            const unseenDeals = existingDeals.filter(d => 
              !seenHashes.includes(d.deal_hash) &&
              d.verification_status !== 'verified' &&
              d.verification_status !== 'community_verified'
            );
            
            if (unseenDeals.length > 0) {
              await supabase
                .from("restaurant_deals")
                .update({ verification_status: 'outdated', valid_to: now })
                .in('id', unseenDeals.map(d => d.id));
              console.log(`Marked ${unseenDeals.length} non-verified deals as outdated`);
            }
          }
        }
        
        // Update restaurant needs_review based on evidence quality (safe: only set true, never override existing true)
        const overallConfidence = extraction.extraction_confidence?.overall || 0.5;
        const anyBadEvidence = badEvidenceCount > 0;
        if (anyBadEvidence || overallConfidence < 0.6) {
          await supabase.from("restaurants").update({
            needs_review: true,
          }).eq("id", restaurant.id).neq("needs_review", true);
          console.log(`  ⚠ Restaurant marked needs_review: ${anyBadEvidence ? badEvidenceCount + ' bad snippets' : 'low confidence'}`);
        }

        // Update job as complete
        await supabase.from("restaurant_scrape_jobs").update({
          status: 'complete',
          extraction_result: extraction,
          extraction_confidence: extraction.extraction_confidence?.overall,
          completed_at: new Date().toISOString(),
        }).eq('id', job?.id);

        // Update source (FIX #1: 'now' is now in scope)
        await supabase.from("sources").update({ 
          last_fetched_at: now,
          type: "scrape",
          status: "active",
          metadata: { 
            ...(source.metadata || {}), 
            scraper_version: "v9-evidence-validated",
            pages_scraped: pagesScraped,
            pdfs_extracted: pdfCount,
            deals_found: extraction.deals?.length || 0,
            bad_evidence_count: badEvidenceCount,
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
      action: "scrape_restaurant_v7",
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
