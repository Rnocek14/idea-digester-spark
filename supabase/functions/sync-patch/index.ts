import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known good article URLs from Patch Lake Geneva - scrape these directly
const KNOWN_SECTIONS = [
  "https://patch.com/wisconsin/lake-geneva-wi/police-fire",
  "https://patch.com/wisconsin/lake-geneva-wi/around-town",
];

// User agents for DIY scraping - more comprehensive list
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

// DIY fetch with anti-bot evasion and retry
async function diyFetch(url: string, attempt = 0, maxAttempts = 3): Promise<string | null> {
  for (let i = attempt; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Add delay between retries
      if (i > attempt) {
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENTS[i % USER_AGENTS.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const html = await res.text();
        console.log(`[sync-patch] DIY fetch got ${html.length} chars from ${url}`);
        // Check if we got actual content (not a block page)
        if (html.length > 5000 && (html.includes('article') || html.includes('story') || html.includes('Card'))) {
          return html;
        }
        console.log(`[sync-patch] DIY fetch got blocked or empty response, retrying...`);
      } else {
        console.log(`[sync-patch] DIY fetch status ${res.status} for ${url}`);
      }
    } catch (e) {
      console.log(`[sync-patch] DIY fetch attempt ${i + 1} failed for ${url}: ${e}`);
    }
  }
  return null;
}

// Extract article links from HTML
function extractArticleLinks(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];
  
  const links: string[] = [];
  doc.querySelectorAll('a[href]').forEach((a: any) => {
    const href = a.getAttribute('href');
    if (href) links.push(href);
  });
  
  return links.filter(link => {
    if (!link.includes("patch.com/wisconsin/lake-geneva-wi/")) return false;
    if (link.endsWith("/lake-geneva-wi") || link.endsWith("/lake-geneva-wi/")) return false;
    if (link.includes("/calendar") || link.includes("/events")) return false;
    if (link.includes("/search") || link.includes("/weather")) return false;
    if (link.includes("/classifieds") || link.includes("/post")) return false;
    if (link.includes("/users/") || link.includes("/patch-pm")) return false;
    
    const pathParts = link.split("/lake-geneva-wi/");
    if (pathParts.length < 2) return false;
    const slug = pathParts[1].split("/")[0];
    return slug.includes("-") && slug.length > 15;
  });
}

// Extract main content from article HTML
function extractArticleContent(html: string): { title: string; content: string; image?: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { title: '', content: '' };
  
  // Get title
  let title = doc.querySelector('h1')?.textContent?.trim() || 
              doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  title = title.replace(/\s*\|\s*Patch$/, '').replace(/\s*-\s*Lake Geneva.*$/i, '').trim();
  
  // Get main content
  const contentSelectors = ['article', '.article-content', '.post-content', 'main', '[role="main"]'];
  let content = '';
  for (const sel of contentSelectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent && el.textContent.length > 300) {
      content = el.textContent.replace(/\s+/g, ' ').trim();
      break;
    }
  }
  if (!content) {
    content = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }
  
  // Get image
  const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;
  
  return { title, content: content.substring(0, 8000), image };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Patch source
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("name", "Patch Lake Geneva")
      .single();

    if (sourceError || !source) {
      console.error("Patch source not found:", sourceError);
      return new Response(
        JSON.stringify({ success: false, error: "Patch source not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-patch] Starting DIY scrape...`);

    // Collect article links from section pages - Firecrawl first since DIY is often blocked
    const allLinks: string[] = [];
    let usedFirecrawl = false;

    for (const sectionUrl of KNOWN_SECTIONS) {
      console.log(`[sync-patch] Scraping section: ${sectionUrl}`);
      
      let html: string | null = null;
      
      // Try Firecrawl first (more reliable for Patch)
      if (firecrawlKey) {
        console.log(`[sync-patch] Using Firecrawl for ${sectionUrl}`);
        try {
          const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: sectionUrl,
              formats: ["html"],
              waitFor: 3000,
            }),
          });
          
          if (fcRes.ok) {
            const data = await fcRes.json();
            html = data.data?.html || '';
            usedFirecrawl = true;
            console.log(`[sync-patch] Firecrawl returned ${html?.length || 0} chars`);
          } else {
            console.warn(`[sync-patch] Firecrawl failed with status ${fcRes.status}`);
          }
        } catch (err) {
          console.warn(`[sync-patch] Firecrawl error: ${err}`);
        }
      }
      
      // Fallback to DIY if Firecrawl fails or not available
      if (!html) {
        console.log(`[sync-patch] Fallback to DIY for ${sectionUrl}`);
        html = await diyFetch(sectionUrl);
      }
      
      if (html) {
        const links = extractArticleLinks(html);
        console.log(`[sync-patch] Found ${links.length} links from ${sectionUrl}`);
        allLinks.push(...links);
      } else {
        console.warn(`[sync-patch] No HTML retrieved for ${sectionUrl}`);
      }
    }

    console.log(`[sync-patch] Total links collected: ${allLinks.length}`);
    
    // Dedupe and limit
    const uniqueLinks = [...new Set(allLinks)];
    const articleLinks = uniqueLinks.slice(0, 8);

    console.log(`[sync-patch] Processing ${articleLinks.length} article links`);

    const results = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      used_firecrawl: usedFirecrawl,
    };

    // Process each article
    for (const articleUrl of articleLinks) {
      results.processed++;
      
      try {
        // Check for duplicates by URL slug
        const urlSlug = articleUrl.split("/lake-geneva-wi/")[1]?.split("?")[0] || "";
        const { count: existingCount } = await supabase
          .from("content_queue")
          .select("*", { count: "exact", head: true })
          .ilike("original_url", `%${urlSlug}%`);

        if (existingCount && existingCount > 0) {
          console.log(`[sync-patch] Skipping duplicate: ${urlSlug}`);
          results.skipped++;
          continue;
        }

        // DIY scrape the article
        let articleHtml = await diyFetch(articleUrl);
        let articleUsedFirecrawl = false;
        
        // Fallback to Firecrawl if DIY fails
        if (!articleHtml && firecrawlKey) {
          try {
            const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${firecrawlKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: articleUrl,
                formats: ["html"],
                onlyMainContent: true,
                waitFor: 2000,
              }),
            });
            
            if (fcRes.ok) {
              const data = await fcRes.json();
              articleHtml = data.data?.html || '';
              articleUsedFirecrawl = true;
              usedFirecrawl = true;
            }
          } catch (err) {
            console.warn(`[sync-patch] Firecrawl article fallback failed: ${err}`);
          }
        }
        
        if (!articleHtml) {
          console.warn(`[sync-patch] Could not fetch article: ${articleUrl}`);
          results.errors.push(`Failed to fetch: ${articleUrl}`);
          continue;
        }

        const { title, content, image } = extractArticleContent(articleHtml);

        if (!title || content.length < 100) {
          console.warn(`[sync-patch] Article too short or no title: ${articleUrl}`);
          results.skipped++;
          continue;
        }

        // Generate summary with OpenAI if available
        let summary = "";
        let category = "news";
        let safetyLevel = "safe";
        let isIncident = false;
        let incidentType = "none";

        if (openaiKey && content.length > 200) {
          try {
            const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `Analyze this Lake Geneva local news article. Return JSON with:
- summary: 1-2 sentence summary (max 200 chars)
- category: one of "news", "civic", "schools", "events", "dining", "crime", "community"
- safety_level: "safe", "soft_sensitive", "sensitive", or "blocked"
- is_incident: true if this is about an accident, fire, crime, emergency
- incident_type: if is_incident, one of "accident", "fire", "crime", "police", "weather", "road_closure", "none"

Return only valid JSON.`
                  },
                  {
                    role: "user",
                    content: `Title: ${title}\n\nContent:\n${content.substring(0, 2000)}`
                  }
                ],
                temperature: 0.3,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const aiContent = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                summary = parsed.summary || summary;
                category = parsed.category || category;
                safetyLevel = parsed.safety_level || safetyLevel;
                isIncident = parsed.is_incident || false;
                incidentType = parsed.incident_type || "none";
              }
            }
          } catch (aiError) {
            console.warn(`[sync-patch] AI enrichment failed for ${title}`);
          }
        }

        // Calculate priority score
        let priorityScore = 3;
        if (isIncident) priorityScore = 7;
        if (category === 'crime') priorityScore = 8;
        if (incidentType !== 'none' && incidentType !== 'weather') priorityScore = 7;

        // Insert into content_queue
        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            source_id: source.id,
            title: title.substring(0, 500),
            content: content.substring(0, 10000),
            summary: summary.substring(0, 500),
            original_url: articleUrl,
            category,
            status: "pending",
            safety_level: safetyLevel,
            priority_score: priorityScore,
            is_breaking: isIncident,
            geo_tier: 1,
            geo_label: "Lake Geneva",
            image_url: image,
            publish_date: new Date().toISOString(),
            metadata: {
              source_name: "Patch Lake Geneva",
              scraped_via: articleUsedFirecrawl ? "firecrawl_fallback" : "diy",
              trusted_locality: true,
              is_incident: isIncident,
              incident_type: incidentType,
            },
          });

        if (insertError) {
          console.error(`[sync-patch] Insert error for ${title}:`, insertError);
          results.errors.push(`Insert failed: ${title}`);
        } else {
          console.log(`[sync-patch] ✅ Inserted: ${title.substring(0, 50)}...`);
          results.inserted++;
        }

        // Small delay between articles
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error: any) {
        console.error(`[sync-patch] Error processing ${articleUrl}:`, error);
        results.errors.push(`Error: ${articleUrl}`);
      }
    }

    // Update source last_fetched_at
    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "source",
      action: "sync_patch",
      message: `Synced Patch Lake Geneva (DIY): ${results.inserted} inserted, ${results.skipped} skipped`,
      details: results,
    });

    console.log(`[sync-patch] Complete: ${results.inserted} inserted, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[sync-patch] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});