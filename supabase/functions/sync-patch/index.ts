import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known good article URLs from Patch Lake Geneva - scrape these directly
const KNOWN_SECTIONS = [
  "https://patch.com/wisconsin/lake-geneva-wi/police-fire",
  "https://patch.com/wisconsin/lake-geneva-wi/around-town",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!firecrawlKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`[sync-patch] Starting Patch scrape with waitFor...`);

    // Collect article links from multiple section pages
    const allLinks: string[] = [];

    for (const sectionUrl of KNOWN_SECTIONS) {
      console.log(`[sync-patch] Scraping section: ${sectionUrl}`);
      
      try {
        const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: sectionUrl,
            formats: ["links"],
            waitFor: 3000, // Wait 3 seconds for JS to render
          }),
        });

        const responseData = await firecrawlResponse.json();
        
        // Check for Firecrawl credit exhaustion
        if (!firecrawlResponse.ok) {
          const errorMsg = responseData.error || responseData.message || "";
          if (errorMsg.toLowerCase().includes("credit") || errorMsg.toLowerCase().includes("limit") || 
              errorMsg.toLowerCase().includes("quota") || firecrawlResponse.status === 402) {
            console.error(`[sync-patch] ❌ Firecrawl credits exhausted: ${errorMsg}`);
            // Disable source and mark as needing credits
            await supabase.from("sources").update({
              status: "inactive",
              metadata: {
                ...source.metadata,
                disabled_reason: "firecrawl_credits_exhausted",
                disabled_at: new Date().toISOString(),
                requires_firecrawl_credits: true
              }
            }).eq("id", source.id);
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Firecrawl credits exhausted", 
                action: "source_disabled",
                requires_firecrawl_credits: true 
              }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.warn(`[sync-patch] Firecrawl error: ${errorMsg}`);
          continue;
        }

        const links = responseData.data?.links || [];
        console.log(`[sync-patch] Found ${links.length} links from ${sectionUrl}`);
        allLinks.push(...links);
      } catch (err) {
        console.warn(`[sync-patch] Failed to scrape ${sectionUrl}:`, err);
      }
    }

    console.log(`[sync-patch] Total links collected: ${allLinks.length}`);
    
    // Dedupe and filter to article links
    const uniqueLinks = [...new Set(allLinks)];
    console.log(`[sync-patch] Sample links:`, uniqueLinks.slice(0, 10));

    const articleLinks = uniqueLinks.filter(link => {
      // Must be Lake Geneva article
      if (!link.includes("patch.com/wisconsin/lake-geneva-wi/")) return false;
      
      // Skip section/category pages
      if (link.endsWith("/lake-geneva-wi") || link.endsWith("/lake-geneva-wi/")) return false;
      if (link.includes("/calendar")) return false;
      if (link.includes("/events")) return false;
      if (link.includes("/police-fire") && !link.includes("/police-fire/")) return false;
      if (link.includes("/around-town") && !link.includes("/around-town/")) return false;
      if (link.includes("/search")) return false;
      if (link.includes("/weather")) return false;
      if (link.includes("/classifieds")) return false;
      if (link.includes("/post")) return false;
      if (link.includes("/users/")) return false;
      if (link.includes("/patch-pm")) return false;
      if (link.includes("/announcements")) return false;
      if (link.includes("/obituaries") && !link.includes("/obituaries/")) return false;
      
      // Article URLs typically have a descriptive slug
      const pathParts = link.split("/lake-geneva-wi/");
      if (pathParts.length < 2) return false;
      
      const slug = pathParts[1].split("/")[0];
      // Real articles have multi-word slugs with hyphens
      return slug.includes("-") && slug.length > 15;
    }).slice(0, 8); // Limit to 8 articles per run

    console.log(`[sync-patch] Found ${articleLinks.length} article links to process`);
    if (articleLinks.length > 0) {
      console.log(`[sync-patch] Article URLs:`, articleLinks);
    }

    const results = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
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

        // Scrape the article with waitFor
        const articleResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: articleUrl,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 2000,
          }),
        });

        const articleResponseData = await articleResponse.json();
        
        // Check for Firecrawl credit exhaustion on article scrape
        if (!articleResponse.ok) {
          const errorMsg = articleResponseData.error || articleResponseData.message || "";
          if (errorMsg.toLowerCase().includes("credit") || errorMsg.toLowerCase().includes("limit") || 
              errorMsg.toLowerCase().includes("quota") || articleResponse.status === 402) {
            console.error(`[sync-patch] ❌ Firecrawl credits exhausted during article scrape`);
            await supabase.from("sources").update({
              status: "inactive",
              metadata: {
                ...source.metadata,
                disabled_reason: "firecrawl_credits_exhausted",
                disabled_at: new Date().toISOString(),
                requires_firecrawl_credits: true
              }
            }).eq("id", source.id);
            break; // Stop processing, return partial results
          }
          console.warn(`[sync-patch] Failed to scrape article: ${articleUrl} - ${errorMsg}`);
          results.errors.push(`Failed: ${articleUrl}`);
          continue;
        }

        const articleData = articleResponseData;
        const articleMarkdown = articleData.data?.markdown || "";
        const metadata = articleData.data?.metadata || {};

        if (!articleMarkdown || articleMarkdown.length < 100) {
          console.warn(`[sync-patch] Article too short: ${articleUrl}`);
          results.skipped++;
          continue;
        }

        // Extract title from metadata or markdown
        let title = metadata.title || "";
        if (!title && articleMarkdown) {
          const titleMatch = articleMarkdown.match(/^#\s+(.+)$/m);
          title = titleMatch ? titleMatch[1] : "";
        }
        // Clean Patch title suffix
        title = title.replace(/\s*\|\s*Patch$/, "").replace(/\s*-\s*Lake Geneva.*$/i, "").trim();

        if (!title) {
          console.warn(`[sync-patch] No title found: ${articleUrl}`);
          results.skipped++;
          continue;
        }

        // Generate summary with OpenAI if available
        let summary = metadata.description || "";
        let category = "news";
        let safetyLevel = "safe";

        if (openaiKey && articleMarkdown.length > 200) {
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
- category: one of "news", "civic", "schools", "events", "dining", "real_estate", "community"
- safety_level: "safe", "sensitive", or "blocked"

Return only valid JSON.`
                  },
                  {
                    role: "user",
                    content: `Title: ${title}\n\nContent:\n${articleMarkdown.substring(0, 2000)}`
                  }
                ],
                temperature: 0.3,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                summary = parsed.summary || summary;
                category = parsed.category || category;
                safetyLevel = parsed.safety_level || safetyLevel;
              }
            }
          } catch (aiError) {
            console.warn(`[sync-patch] AI enrichment failed for ${title}`);
          }
        }

        // Extract image from og:image
        const imageUrl = metadata.ogImage || metadata.image || null;

        // Insert into content_queue
        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            source_id: source.id,
            title: title.substring(0, 500),
            content: articleMarkdown.substring(0, 10000),
            summary: summary.substring(0, 500),
            original_url: articleUrl,
            category,
            status: safetyLevel === "safe" ? "pending" : "pending",
            safety_level: safetyLevel,
            geo_tier: 1, // Patch Lake Geneva is hyperlocal
            geo_label: "Lake Geneva",
            image_url: imageUrl,
            publish_date: new Date().toISOString(),
            metadata: {
              source_name: "Patch Lake Geneva",
              scraped_via: "firecrawl",
              trusted_locality: true,
            },
          });

        if (insertError) {
          console.error(`[sync-patch] Insert error for ${title}:`, insertError);
          results.errors.push(`Insert failed: ${title}`);
        } else {
          console.log(`[sync-patch] ✅ Inserted: ${title.substring(0, 50)}...`);
          results.inserted++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

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
      message: `Synced Patch Lake Geneva: ${results.inserted} inserted, ${results.skipped} skipped`,
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