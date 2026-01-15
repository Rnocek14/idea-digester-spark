import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URL patterns that indicate non-article pages (category listings, navigation, etc.)
const JUNK_URL_PATTERNS = [
  '/category/', '/tag/', '/page/', '/author/',
  '/categories/', '/tags/', '/archives/',
  'index.cfm', '/about', '/contact', '/privacy',
  '/terms', '/login', '/register', '/cart', '/checkout',
  '/wp-admin', '/wp-login', '/feed/', '/rss/',
  '/search', '/sitemap', '/404', '/error',
];

// Check if URL is a valid HTTP/HTTPS URL (rejects tel:, mailto:, javascript:, urn:, etc.)
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Check if URL is a junk/non-article page
function isJunkUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return JUNK_URL_PATTERNS.some(pattern => path.includes(pattern));
  } catch {
    return JUNK_URL_PATTERNS.some(pattern => url.toLowerCase().includes(pattern));
  }
}

// Content type specific extraction schemas
const EXTRACTION_SCHEMAS = {
  article: {
    system: `You are an expert local news article extractor for Lake Geneva, Wisconsin and surrounding communities (Williams Bay, Fontana, Delavan, Walworth County). Extract the article's key information with special attention to:
- Local relevance (is this about our coverage area?)
- Incident potential (could this become a safety incident?)
- Civic importance (school, government, community impact)`,
    tool: {
      name: "extract_article",
      description: "Extract article details",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string", description: "2-3 sentence summary" },
          author: { type: "string" },
          published_date: { type: "string" },
          category: { type: "string", enum: ["news", "events", "business", "sports", "community", "government", "crime", "weather", "dining", "entertainment", "schools", "civic"] },
          location_mentions: { type: "array", items: { type: "string" }, description: "Cities, streets, venues mentioned" },
          key_entities: { type: "array", items: { type: "string" }, description: "People, organizations, places mentioned" },
          is_breaking: { type: "boolean", description: "Is this urgent/breaking news?" },
          is_incident: { type: "boolean", description: "Is this about an accident, fire, crime, or emergency?" },
          incident_type: { type: "string", enum: ["accident", "fire", "crime", "weather", "utility", "road_closure", "school_closure", "construction", "community_alert", "missing_person", "none"] },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          geo_tier: { type: "number", description: "1=Lake Geneva/Williams Bay/Fontana, 2=Walworth County, 3=Regional" },
        },
        required: ["title", "summary", "category"],
      },
    },
  },
  
  incident: {
    system: `You are an expert incident/emergency data extractor for Lake Geneva, Wisconsin area.
Extract details about accidents, fires, crimes, emergencies, road closures, etc.`,
    tool: {
      name: "extract_incident",
      description: "Extract incident details from emergency/news content",
      parameters: {
        type: "object",
        properties: {
          incident_type: { type: "string", enum: ["accident", "fire", "crime", "medical", "weather", "road_closure", "police", "rescue", "hazmat", "other"] },
          title: { type: "string" },
          location: { type: "string", description: "Street address or intersection" },
          incident_time: { type: "string", description: "When the incident occurred" },
          responding_agencies: { type: "array", items: { type: "string" } },
          injuries: { type: "string" },
          fatalities: { type: "number" },
          suspect_status: { type: "string" },
          road_status: { type: "string" },
          severity: { type: "string", enum: ["minor", "moderate", "serious", "critical"] },
          is_resolved: { type: "boolean" },
          description: { type: "string" },
        },
        required: ["incident_type", "title", "severity"],
      },
    },
  },
  
  event: {
    system: `You are an expert event data extractor for Lake Geneva, Wisconsin area.
Extract details about concerts, festivals, community events, performances, etc.`,
    tool: {
      name: "extract_event",
      description: "Extract event details",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          venue: { type: "string" },
          address: { type: "string" },
          event_date: { type: "string", description: "YYYY-MM-DD format" },
          start_time: { type: "string", description: "HH:MM AM/PM format" },
          end_time: { type: "string" },
          performer: { type: "string" },
          description: { type: "string" },
          ticket_price: { type: "string" },
          is_free: { type: "boolean" },
          is_recurring: { type: "boolean" },
          recurring_days: { type: "array", items: { type: "string" } },
          category: { type: "string", enum: ["music", "festival", "sports", "community", "arts", "food", "kids", "nightlife", "outdoor", "other"] },
        },
        required: ["title", "venue", "event_date"],
      },
    },
  },
  
  event_list: {
    system: `You are an expert event data extractor for Lake Geneva, Wisconsin area.
Extract ALL events visible on this calendar/events page. Return an array of events.
Today's date is ${new Date().toISOString().split('T')[0]}. Only include events with dates today or in the future.`,
    tool: {
      name: "extract_event_list",
      description: "Extract all events from a calendar or events listing page",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                venue: { type: "string" },
                address: { type: "string" },
                event_date: { type: "string", description: "YYYY-MM-DD format" },
                start_time: { type: "string", description: "HH:MM AM/PM format" },
                end_time: { type: "string" },
                performer: { type: "string" },
                description: { type: "string" },
                event_url: { type: "string", description: "Link to event details if available" },
                is_free: { type: "boolean" },
                category: { type: "string", enum: ["music", "festival", "sports", "community", "arts", "food", "kids", "nightlife", "outdoor", "library", "other"] },
              },
              required: ["title", "event_date"],
            },
            description: "Array of all events found on the page",
          },
          source_name: { type: "string", description: "Name of the organization/venue" },
          calendar_month: { type: "string", description: "Month being displayed (if visible)" },
        },
        required: ["events"],
      },
    },
  },
  
  business: {
    system: `You are an expert business data extractor for Lake Geneva, Wisconsin area.
Extract details about local businesses, including restaurants, shops, services.`,
    tool: {
      name: "extract_business",
      description: "Extract business details",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          address: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          hours: { type: "object" },
          description: { type: "string" },
          price_range: { type: "string", enum: ["$", "$$", "$$$", "$$$$"] },
          features: { type: "array", items: { type: "string" } },
          is_new: { type: "boolean", description: "Recently opened" },
          is_closing: { type: "boolean" },
        },
        required: ["name", "category"],
      },
    },
  },
};

// User agents rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

// Extract text from PDF using raw stream parsing (same pattern as scrape-restaurant-diy)
async function extractPdfText(pdfUrl: string): Promise<{ text: string | null; status: string; chars: number }> {
  try {
    console.log(`Attempting PDF extraction: ${pdfUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`PDF fetch failed: ${response.status}`);
      return { text: null, status: 'fetch_error', chars: 0 };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(bytes);
    
    let text = '';
    
    // Extract Tj operators (single text strings)
    for (const match of pdfString.matchAll(/\(([^)]+)\)\s*Tj/g)) {
      text += match[1] + ' ';
    }
    
    // Extract TJ operators (text arrays with positioning)
    for (const match of pdfString.matchAll(/\[((?:[^[\]]+|\[[^\]]*\])*)\]\s*TJ/gi)) {
      for (const strMatch of match[1].matchAll(/\(([^)]*)\)/g)) {
        text += strMatch[1] + ' ';
      }
    }
    
    // Clean up extracted text
    text = text
      .replace(/\\[0-9]{3}/g, ' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r|\\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Validate extraction quality
    if (text.length < 200) {
      console.log(`PDF text too short (${text.length} chars) - likely image-based`);
      return { text: null, status: 'image_based', chars: text.length };
    }
    
    console.log(`PDF extraction successful: ${text.length} chars`);
    return { text, status: 'success', chars: text.length };
  } catch (err: any) {
    console.log(`PDF extraction error: ${err.message}`);
    return { text: null, status: 'error', chars: 0 };
  }
}

// Fetch with anti-bot evasion and Firecrawl fallback
async function fetchContent(
  url: string,
  options: { timeout?: number; useFirecrawl?: boolean; forceFirecrawl?: boolean } = {}
): Promise<{ html: string; markdown?: string; usedFirecrawl: boolean; isPdf?: boolean }> {
  const { timeout = 10000, useFirecrawl = true, forceFirecrawl = false } = options;
  
  // Handle PDF URLs - try Firecrawl FIRST (better at handling compressed/complex PDFs)
  if (url.toLowerCase().endsWith('.pdf')) {
    console.log(`PDF URL detected: ${url}`);
    
    let bestMarkdown = '';
    let usedFc = false;
    
    // PRIMARY: Try Firecrawl first with retry + backoff - handles compressed streams, fonts, etc.
    if (useFirecrawl) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Firecrawl PDF attempt ${attempt}/${maxRetries}: ${url}`);
            const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url, formats: ['markdown', 'html'] }),
            });
            
            console.log(`Firecrawl PDF response: HTTP ${fcRes.status}`);
            
            if (fcRes.ok) {
              const data = await fcRes.json();
              const md = data.data?.markdown || data.markdown || '';
              console.log(`Firecrawl PDF: ${md.length} chars extracted, preview: "${md.slice(0, 150).replace(/\n/g, ' ')}..."`);
              
              if (md.length > 100) {
                bestMarkdown = md;
                usedFc = true;
                break;
              }
              console.log(`Firecrawl PDF content too sparse (${md.length} chars) - may be image-based`);
            }
            
            // Retry on 5xx, 429 (rate limit), 408 (timeout)
            const isRetryable = fcRes.status >= 500 || fcRes.status === 429 || fcRes.status === 408;
            if (isRetryable && attempt < maxRetries) {
              const baseDelay = 800 + Math.random() * 700;
              const backoffMs = baseDelay * Math.pow(2, attempt - 1);
              console.log(`Firecrawl PDF ${fcRes.status} (retryable), retry in ${Math.round(backoffMs)}ms...`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            }
            
            break;
          } catch (err: any) {
            console.log(`Firecrawl PDF attempt ${attempt} error: ${err.message}`);
            if (attempt < maxRetries) {
              const backoffMs = (1000 + Math.random() * 1000) * attempt;
              await new Promise(r => setTimeout(r, backoffMs));
            }
          }
        }
      }
    }
    
    // Return whatever we got (even if sparse - let AI try to extract)
    if (bestMarkdown.length > 50) {
      console.log(`PDF extraction complete: ${bestMarkdown.length} chars (firecrawl: ${usedFc})`);
      return { html: '', markdown: bestMarkdown, usedFirecrawl: usedFc, isPdf: true };
    }
    
    throw new Error(`Failed to extract PDF content after retries (${bestMarkdown.length} chars - PDF may be image-based or OCR needed)`);
  }
  
  // Skip static fetch if forceFirecrawl is set (for SPA calendars that need JS rendering)
  if (!forceFirecrawl) {
    // Try static fetch first
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        let referer = '';
        try { referer = new URL(url).origin; } catch {}
        
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1',
            'Referer': referer,
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const html = await res.text();
          // Check if actual text content is sufficient (not just HTML boilerplate)
          const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (textContent.length >= 500) {
            return { html, usedFirecrawl: false };
          }
          console.log(`Sparse text content (${textContent.length} chars from ${html.length} HTML), trying Firecrawl`);
          break;
        }
        
        if (res.status === 403 || res.status === 429) {
          console.log(`Got ${res.status}, will try Firecrawl`);
          break;
        }
        
        throw new Error(`HTTP ${res.status}`);
      } catch (e: any) {
        if (attempt === 1 && !useFirecrawl) throw e;
      }
    }
  } else {
    console.log(`Force Firecrawl mode for: ${url}`);
  }
  
  // Firecrawl fallback (or forced for SPA calendars) with retry + backoff
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (useFirecrawl && firecrawlKey) {
    const maxRetries = 3;
    const startTime = Date.now();
    const MAX_TOTAL_TIME = 25000; // Hard cap at 25s to avoid Edge Function timeout
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check total time cap before each attempt
      if (Date.now() - startTime > MAX_TOTAL_TIME) {
        console.log(`Total time exceeded ${MAX_TOTAL_TIME}ms, stopping retries`);
        break;
      }
      
      try {
        console.log(`Firecrawl attempt ${attempt}/${maxRetries} for: ${url}`);
        
        const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            waitFor: 3000, // Wait longer for SPA content
          }),
        });
        
        // Log response details for debugging
        console.log(`Firecrawl response: HTTP ${fcRes.status}`);
        
        if (fcRes.ok) {
          const data = await fcRes.json();
          const markdownLen = (data.data?.markdown || data.markdown || '').length;
          const htmlLen = (data.data?.html || data.html || '').length;
          console.log(`Firecrawl success: markdown=${markdownLen} chars, html=${htmlLen} chars`);
          
          return {
            html: data.data?.html || data.html || '',
            markdown: data.data?.markdown || data.markdown,
            usedFirecrawl: true,
          };
        }
        
        // Retry on 5xx, 429 (rate limit), 408 (timeout) - NOT on 4xx client errors
        const isRetryable = fcRes.status >= 500 || fcRes.status === 429 || fcRes.status === 408;
        if (isRetryable && attempt < maxRetries) {
          const baseDelay = 800 + Math.random() * 700;
          const backoffMs = baseDelay * Math.pow(2, attempt - 1); // Exponential: ~1s, ~2s, ~4s
          console.log(`Firecrawl ${fcRes.status} (retryable), retry in ${Math.round(backoffMs)}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        
        // Non-retryable error (400, 401, 403, 404, etc.)
        const errorText = await fcRes.text().catch(() => 'unknown');
        console.log(`Firecrawl failed: HTTP ${fcRes.status} - ${errorText.slice(0, 200)}`);
        lastError = new Error(`Firecrawl HTTP ${fcRes.status}`);
        break;
        
      } catch (err: any) {
        lastError = err;
        console.log(`Firecrawl attempt ${attempt} error: ${err.message}`);
        
        // Retry on network errors
        if (attempt < maxRetries) {
          const backoffMs = (1000 + Math.random() * 1000) * attempt;
          console.log(`Retrying in ${Math.round(backoffMs)}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
      }
    }
    
    console.log(`Firecrawl failed after ${maxRetries} attempts: ${lastError?.message}`);
  }
  
  throw new Error('Failed to fetch content after all attempts');
}

// Extract main content from HTML
function extractMainContent(html: string, maxLength = 8000): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return html.substring(0, maxLength);
  
  // Remove non-content elements
  ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg', 'form', 'button'].forEach(sel => {
    doc.querySelectorAll(sel).forEach((el: any) => el.parentNode?.removeChild(el));
  });
  
  // Try to find main content area
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry-content'];
  for (const selector of mainSelectors) {
    const main = doc.querySelector(selector);
    if (main?.textContent && main.textContent.length > 500) {
      return main.textContent.replace(/\s+/g, ' ').trim().substring(0, maxLength);
    }
  }
  
  return (doc.body?.textContent || "").replace(/\s+/g, ' ').trim().substring(0, maxLength);
}

// Call AI for extraction
async function extractWithAI(
  content: string,
  extractType: keyof typeof EXTRACTION_SCHEMAS,
  url: string
): Promise<any> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  
  const apiKey = openaiKey || lovableKey;
  const apiUrl = openaiKey 
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
  
  if (!apiKey) {
    throw new Error('No AI API key configured (OPENAI_API_KEY or LOVABLE_API_KEY)');
  }
  
  const schema = EXTRACTION_SCHEMAS[extractType];
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiKey ? 'gpt-4o-mini' : 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: schema.system },
        { role: 'user', content: `Extract ${extractType} data from this content. Source URL: ${url}\n\nContent:\n${content}` },
      ],
      tools: [{ type: 'function', function: schema.tool }],
      tool_choice: { type: 'function', function: { name: schema.tool.name } },
      max_tokens: 1500,
    }),
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errText.slice(0, 200)}`);
  }
  
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error('No extraction result from AI');
  }
  
  return JSON.parse(toolCall.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { url, extract_type = 'article', use_firecrawl = true, include_raw = false } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Block non-HTTP URLs before any processing (tel:, mailto:, javascript:, urn:, etc.)
    if (!isValidHttpUrl(url)) {
      console.log(`Blocked non-HTTP URL: ${url}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'URL is not a valid HTTP/HTTPS URL',
          is_invalid_protocol: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block junk URLs before any processing
    if (isJunkUrl(url)) {
      console.log(`Blocked junk URL: ${url}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'URL appears to be a category/tag/navigation page, not an article',
          is_junk: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!EXTRACTION_SCHEMAS[extract_type as keyof typeof EXTRACTION_SCHEMAS]) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid extract_type. Must be one of: ${Object.keys(EXTRACTION_SCHEMAS).join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Scraping ${url} for ${extract_type}`);
    
    // For event_list extraction, prefer Firecrawl since these are typically SPA calendars
    const forceFirecrawl = extract_type === 'event_list';
    
    // Fetch content
    const { html, markdown, usedFirecrawl } = await fetchContent(url, { 
      useFirecrawl: use_firecrawl,
      forceFirecrawl 
    });
    
    // Extract main content (prefer markdown if available)
    const content = markdown || extractMainContent(html);
    console.log(`Extracted ${content.length} chars (firecrawl: ${usedFirecrawl})`);
    
    // Run AI extraction
    const extraction = await extractWithAI(content, extract_type as keyof typeof EXTRACTION_SCHEMAS, url);
    
    console.log(`Extraction complete: ${JSON.stringify(extraction).slice(0, 200)}`);
    
    const response: Record<string, any> = {
      success: true,
      url,
      extract_type,
      used_firecrawl: usedFirecrawl,
      content_length: content.length,
      data: extraction,
    };
    
    // Include raw content if requested (for link discovery in syncers)
    if (include_raw) {
      response.raw_html = html;
      response.raw_content = content;
    }
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
