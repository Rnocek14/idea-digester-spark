import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  summary?: string;
  published?: string;
  updated?: string;
  "@_href"?: string;
  [key: string]: any;
}

interface SyncResult {
  success: boolean;
  sourcesProcessed: number;
  articlesInserted: number;
  skipped: number;
  errors: string[];
}

type AutoPublishRule = {
  id: string;
  source_id: string | null;
  category: string | null;
  action: "auto_publish" | "needs_review" | "flag";
  enabled: boolean;
};

// Parse flexible date formats (handles "December 17, 2025, 3:00 PM - 8:30 PM", "All Day", etc.)
function parseFlexibleDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // If already ISO format, return as-is
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    // Strip time range (take only start time before the dash)
    let cleanDate = dateStr.split(' - ')[0].trim();
    
    // Handle "All Day" - replace with noon
    if (cleanDate.toLowerCase().includes('all day')) {
      cleanDate = cleanDate.replace(/,?\s*All Day/i, ', 12:00 PM');
    }
    
    // Try to parse the cleaned date string
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    
    // Try parsing with just the date portion (no time)
    const dateOnlyMatch = dateStr.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
    if (dateOnlyMatch) {
      const dateOnly = new Date(dateOnlyMatch[1]);
      if (!isNaN(dateOnly.getTime())) {
        return dateOnly.toISOString();
      }
    }
  } catch (e) {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  
  // Fallback to current time
  return new Date().toISOString();
}

function decideStatusForStory(
  rules: AutoPublishRule[] | null,
  sourceId: string,
  category: string | null,
  safetyLevel: string
): string {
  // SAFETY GATE: Check safety level FIRST before applying auto-publish rules
  // This ensures unsafe content never auto-publishes regardless of rules
  
  if (safetyLevel === "blocked") {
    // Never publish blocked content
    return "blocked";
  }
  
  if (safetyLevel === "sensitive") {
    // Sensitive content always requires manual review, regardless of auto-publish rules
    return "pending";
  }
  
  // Safety level is "safe" — proceed with auto-publish rule evaluation
  if (!rules || rules.length === 0) return "pending";
  
  const cat = category || null;
  
  // Most specific: exact source + category match
  const specific = rules.find(r => 
    r.enabled && 
    r.source_id === sourceId && 
    (r.category === cat || r.category === null)
  );
  
  // Global: any source + matching category
  const global = rules.find(r => 
    r.enabled && 
    r.source_id === null && 
    (r.category === cat || r.category === null)
  );
  
  const rule = specific || global;
  if (!rule) return "pending";
  
  switch (rule.action) {
    case "auto_publish": return "auto_published";
    case "flag": return "flagged";
    case "needs_review":
    default: return "pending";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load auto-publish rules
    const { data: rules, error: rulesError } = await supabase
      .from("auto_publish_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) {
      console.error("Failed to load auto_publish_rules:", rulesError);
    } else {
      console.log(`Loaded ${rules?.length || 0} active auto-publish rules`);
    }

    // Fetch active RSS and scrape sources
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .in("type", ["rss", "scrape"]);

    if (sourcesError) throw sourcesError;

    const result: SyncResult = {
      success: true,
      sourcesProcessed: 0,
      articlesInserted: 0,
      skipped: 0,
      errors: [],
    };

    // Process each source
    for (const source of sources || []) {
      result.sourcesProcessed++;

      try {
        console.log(`Processing ${source.type} source: ${source.name}`);

        let items: RSSItem[] = [];

        if (source.type === "rss") {
          // Fetch RSS feed
          const rssResponse = await fetch(source.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
            },
          });

          if (!rssResponse.ok) {
            throw new Error(`HTTP ${rssResponse.status}: ${rssResponse.statusText}`);
          }

          const xmlText = await rssResponse.text();

          // Parse RSS using fast-xml-parser
          const { XMLParser } = await import("https://esm.sh/fast-xml-parser@4.3.2");
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
          });

          const parsed = parser.parse(xmlText);
          const channel = parsed.rss?.channel || parsed.feed;

          if (!channel) {
            throw new Error("Invalid RSS format");
          }

          // Extract items (handle both RSS 2.0 and Atom)
          items = channel.item || channel.entry || [];
          if (!Array.isArray(items)) items = [items];

          console.log(`Found ${items.length} RSS items in ${source.name}`);
        } else if (source.type === "scrape") {
          // Fetch HTML page
          const htmlResponse = await fetch(source.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
            },
          });

          if (!htmlResponse.ok) {
            throw new Error(`HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`);
          }

          const htmlText = await htmlResponse.text();

          // Parse HTML using deno-dom
          const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
          const doc = new DOMParser().parseFromString(htmlText, "text/html");

          if (!doc) {
            throw new Error("Failed to parse HTML");
          }

          // Get selector from metadata with fallback logic
          let selector = source.metadata?.scrape_selector || ".event-item";
          
          // HARDCODED FIX: For Visit Lake Geneva Events, use correct selector
          if (source.name === "Visit Lake Geneva – Events" && selector === ".event-item") {
            console.log(`⚠️ Detected incorrect selector "${selector}" for ${source.name}, using fallback "article.slide"`);
            selector = "article.slide";
            
            // Auto-fix the database
            const updatedMetadata = { ...source.metadata, scrape_selector: "article.slide" };
            await supabase
              .from("sources")
              .update({ metadata: updatedMetadata })
              .eq("id", source.id);
            console.log(`✅ Updated ${source.name} selector in database to "article.slide"`);
          }

          console.log(`🔍 Using selector "${selector}" for ${source.name}`);
          const elements = doc.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector "${selector}" in ${source.name}`);

          // Get configurable selectors from metadata with fallbacks
          const titleSelector = source.metadata?.title_selector || "h2, h3, .title, .event-title";
          const linkSelector = source.metadata?.link_selector || "a";
          const dateSelector = source.metadata?.date_selector || "time, .date, .event-date";
          const descSelector = source.metadata?.desc_selector || "p, .description, .event-description";

          console.log(`🎯 Using extraction selectors - title: "${titleSelector}", link: "${linkSelector}"`);

          // Convert DOM elements to RSS-like items
          items = Array.from(elements).map((el, idx) => {
            const element = el as any; // Type assertion for deno-dom Element
            
            // For title selector, check if it's also a link (e.g., ".fsTitle a")
            const titleEl = element.querySelector(titleSelector);
            const linkEl = titleSelector === linkSelector 
              ? titleEl  // If title and link use same selector, reuse titleEl
              : element.querySelector(linkSelector);
            
            const dateEl = element.querySelector(dateSelector);
            const descEl = element.querySelector(descSelector);

            const title = titleEl?.textContent?.trim() || "";
            const link = linkEl?.getAttribute("href") || "";
            
            // Debug logging for first few items
            if (idx < 3) {
              console.log(`  Item ${idx + 1}: title="${title.substring(0, 50)}...", link="${link}"`);
            }

            return {
              title,
              link,
              pubDate: dateEl?.getAttribute("datetime") || dateEl?.textContent?.trim() || new Date().toISOString(),
              description: descEl?.textContent?.trim() || "",
            };
          }).filter(item => {
            const hasTitle = Boolean(item.title);
            const hasLink = Boolean(item.link);
            if (!hasTitle || !hasLink) {
              console.log(`  ⚠️ Filtered item - hasTitle: ${hasTitle}, hasLink: ${hasLink}`);
            }
            return hasTitle && hasLink;
          });

          console.log(`Extracted ${items.length} valid items from scraped content`);
        }

        // Process each item
        for (const item of items) {
          const originalUrl = item.link || item["@_href"] || "";
          const title = item.title || "";
          const rawContent = item.description || item.content || item.summary || "";
          const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();

          if (!originalUrl || !title) {
            result.skipped++;
            continue;
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from("content_queue")
            .select("original_url")
            .eq("original_url", originalUrl)
            .maybeSingle();

          if (existing) {
            result.skipped++;
            continue;
          }

          // Try to extract OG image from the article page
          let imageUrl: string | null = null;
          let imageSource: string | null = null;

          try {
            // Convert relative URLs to absolute URLs for fetching
            let fullUrl = originalUrl;
            if (originalUrl.startsWith('/')) {
              // Extract base URL from source URL
              const sourceUrlObj = new URL(source.url);
              fullUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${originalUrl}`;
              console.log(`🔗 Converted relative URL: ${originalUrl} → ${fullUrl}`);
            }

            console.log(`🖼️ Attempting to extract image from: ${fullUrl}`);
            const pageResponse = await fetch(fullUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
              },
            });

            if (pageResponse.ok) {
              const pageHtml = await pageResponse.text();
              const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
              const pageDoc = new DOMParser().parseFromString(pageHtml, "text/html");

              if (pageDoc) {
                // Try og:image first (most common and reliable)
                const ogImage = pageDoc.querySelector('meta[property="og:image"]');
                if (ogImage) {
                  const content = ogImage.getAttribute("content");
                  if (content && content.length > 10 && !content.includes("1x1")) {
                    imageUrl = content;
                    imageSource = "source_og";
                    console.log(`✅ Found OG image: ${imageUrl.substring(0, 60)}...`);
                  }
                }

                // Fallback to twitter:image if og:image not found
                if (!imageUrl) {
                  const twitterImage = pageDoc.querySelector('meta[name="twitter:image"]');
                  if (twitterImage) {
                    const content = twitterImage.getAttribute("content");
                    if (content && content.length > 10 && !content.includes("1x1")) {
                      imageUrl = content;
                      imageSource = "source_og";
                      console.log(`✅ Found Twitter image: ${imageUrl.substring(0, 60)}...`);
                    }
                  }
                }
              }
            }
          } catch (imageError: any) {
            console.warn(`⚠️ Failed to extract image from ${originalUrl}: ${imageError.message}`);
            // Continue without image - not a fatal error
          }

          // Call OpenAI for summarization, categorization, and safety evaluation
          const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are a content normalizer and safety reviewer for a family-friendly Lake Geneva local media brand.

For each article, you must:
1. Write a clear, neutral, 2-3 sentence summary in a friendly local-news tone.
2. Assign a category: one of events, news, community, dining, or real-estate.
3. Assign content_tags (granular attributes): one or more tags like brunch, lunch, dinner, coffee, bar, cocktails, wine, brewery, live-music, dj, late-night, kids, family-friendly, meeting, ordinance, road-closure, school-board, open-house, market-update, etc.
4. Assign verticals (which accounts should show this): array from ["local", "eats", "nightlife", "civic", "family", "real_estate"]
   - Dining content: ["local", "eats"]
   - Bars/breweries/late-night/live-music: ["local", "nightlife"] or ["local", "eats", "nightlife"] for food+drink+music
   - City meetings, school board, road closures, public notices: ["local", "civic"]
   - Family events, kids activities: ["local", "family"]
   - Open houses, market updates: ["local", "real_estate"]
   - Most events also get "local" - it's the main feed
5. Evaluate safety and assign:
   - safety_level: safe, sensitive, or blocked
   - safety_tags: zero or more labels like crime, public-safety, politics, tragedy, dining, family, graphic-violence, sexual-content, hate, scam
   - safety_reason: a short sentence explaining why

Guidelines:
- SAFE: family-friendly events, dining, attractions, community info, basic weather/traffic, non-controversial business content
- SENSITIVE: crime, arrests, police logs, non-graphic accidents or fires, political campaigns or protests, obituaries and tragedies, contentious public issues
- BLOCKED: graphic violence, sexual content, hate/extremist content, obvious scams, or anything inappropriate for a general-audience local community brand

When in doubt between safe and sensitive, choose sensitive. Only use blocked for clearly inappropriate content.`
                },
                {
                  role: "user",
                  content: `Normalize this article:\n\nTitle: ${title}\nContent: ${rawContent.substring(0, 1000)}`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "normalize_article",
                  description: "Normalize article with summary, category, and safety evaluation",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "2-3 sentence summary in friendly local-news tone" },
                      category: { 
                        type: "string", 
                        enum: ["news", "events", "dining", "real-estate", "community"],
                        description: "Article category"
                      },
                      content_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Granular content attributes like brunch, live-music, kids, meeting, road-closure"
                      },
                      verticals: {
                        type: "array",
                        items: { 
                          type: "string",
                          enum: ["local", "eats", "nightlife", "civic", "family", "real_estate"]
                        },
                        description: "Which account feeds should show this content"
                      },
                      safety_level: {
                        type: "string",
                        enum: ["safe", "sensitive", "blocked"],
                        description: "Safety evaluation level"
                      },
                      safety_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of safety labels"
                      },
                      safety_reason: {
                        type: "string",
                        description: "Short explanation of why this safety level was chosen"
                      }
                    },
                    required: ["summary", "category", "content_tags", "verticals", "safety_level", "safety_tags", "safety_reason"],
                    additionalProperties: false
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "normalize_article" } }
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI request failed: ${aiResponse.status}`);
            result.errors.push(`AI failed for: ${title.substring(0, 50)}`);
            continue;
          }

          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          const aiResult = toolCall ? JSON.parse(toolCall.function.arguments) : { 
            summary: rawContent.substring(0, 200), 
            category: "news",
            safety_level: "safe",
            safety_tags: [],
            safety_reason: "Fallback processing"
          };

          // Compute category and status based on safety + rules
          const aiCategory = aiResult.category || source.category || "news";
          const safetyLevel = aiResult.safety_level || "safe";
          const status = decideStatusForStory(rules as AutoPublishRule[], source.id, aiCategory, safetyLevel);

          console.log(`📋 Story "${title.substring(0, 40)}..." → category: ${aiCategory}, safety: ${safetyLevel}, status: ${status}`);

          // Insert into content_queue
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title: title,
              content: rawContent,
              summary: aiResult.summary || "",
              category: aiCategory,
              original_url: originalUrl,
              image_url: imageUrl,
              image_source: imageSource,
              publish_date: parseFlexibleDate(pubDate),
              status,
              safety_level: aiResult.safety_level || "safe",
              safety_tags: aiResult.safety_tags || [],
              safety_reason: aiResult.safety_reason || "",
              metadata: {
                source_name: source.name,
                original_published_at: pubDate,  // Keep raw date for reference
                raw_event_date: pubDate,  // Preserve original format
                location_tags: source.metadata?.location_tags || ["Lake Geneva"],
                ai_model: "gpt-4o-mini",
                content_tags: aiResult.content_tags || [],
                verticals: aiResult.verticals || ["local"],
              },
            });

          if (insertError) {
            console.error("Insert error:", insertError);
            result.errors.push(`Insert failed: ${title.substring(0, 50)}`);
          } else {
            result.articlesInserted++;
          }
        }

        // Update last_fetched_at
        await supabase
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);

      } catch (error: any) {
        console.error(`Error processing ${source.name}:`, error);
        result.errors.push(`${source.name}: ${error.message}`);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "source",
      action: "rss_sync",
      message: `RSS sync completed: ${result.articlesInserted} articles added, ${result.skipped} skipped`,
      details: result,
    });

    console.log("Sync result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        sourcesProcessed: 0,
        articlesInserted: 0,
        skipped: 0,
        errors: [error.message]
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
