import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log(`[sync-patch] Mapping Patch Lake Geneva via Firecrawl...`);

    // Use Firecrawl's map feature to discover article URLs
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: source.url,
        limit: 100,
        includeSubdomains: false,
      }),
    });

    if (!firecrawlResponse.ok) {
      const errText = await firecrawlResponse.text();
      console.error("Firecrawl map error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl map failed: ${firecrawlResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const links: string[] = firecrawlData.links || [];

    console.log(`[sync-patch] Firecrawl map found ${links.length} URLs`);
    
    // Log sample links for debugging
    console.log(`[sync-patch] Sample URLs:`, links.slice(0, 10));

    // Filter to article links - Patch articles have slugs that look like news titles
    const articleLinks = links.filter(link => {
      // Must be Lake Geneva
      if (!link.includes("patch.com/wisconsin/lake-geneva-wi/")) return false;
      
      // Skip section pages
      if (link.includes("/calendar")) return false;
      if (link.includes("/events")) return false;
      if (link.includes("/search")) return false;
      if (link.includes("/weather")) return false;
      if (link.includes("/police-fire")) return false;
      if (link.includes("/classifieds")) return false;
      if (link.includes("/post")) return false;
      if (link.includes("/users/")) return false;
      if (link.includes("/patch-pm")) return false;
      if (link.includes("/announcements")) return false;
      if (link.endsWith("/lake-geneva-wi") || link.endsWith("/lake-geneva-wi/")) return false;
      
      // Article URLs have a meaningful slug after /lake-geneva-wi/
      const pathMatch = link.match(/\/lake-geneva-wi\/([a-z0-9-]+)/i);
      if (!pathMatch) return false;
      
      const slug = pathMatch[1];
      // Real articles have descriptive slugs (multiple words with hyphens)
      return slug.includes("-") && slug.length > 10;
    }).slice(0, 10); // Limit to 10 newest articles

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
        // Check for duplicates
        const normalizedUrl = articleUrl.toLowerCase().replace(/\/+$/, '');
        const { count: existingCount } = await supabase
          .from("content_queue")
          .select("*", { count: "exact", head: true })
          .ilike("original_url", `%${normalizedUrl.split("/p/")[1]}%`);

        if (existingCount && existingCount > 0) {
          console.log(`[sync-patch] Skipping duplicate: ${articleUrl}`);
          results.skipped++;
          continue;
        }

        // Scrape the article
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
          }),
        });

        if (!articleResponse.ok) {
          console.warn(`[sync-patch] Failed to scrape article: ${articleUrl}`);
          results.errors.push(`Failed: ${articleUrl}`);
          continue;
        }

        const articleData = await articleResponse.json();
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
        title = title.replace(/\s*\|\s*Patch$/, "").replace(/\s*-\s*Lake Geneva.*$/, "").trim();

        if (!title) {
          console.warn(`[sync-patch] No title found: ${articleUrl}`);
          results.skipped++;
          continue;
        }

        // Generate summary with OpenAI if available
        let summary = metadata.description || "";
        let category = "news";

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
              }
            }
          } catch (aiError) {
            console.warn(`[sync-patch] AI enrichment failed for ${title}`);
          }
        }

        // Determine geo tier
        const text = `${title} ${summary}`.toLowerCase();
        let geoTier = 1; // Patch Lake Geneva is hyperlocal by definition
        let geoLabel = "Lake Geneva";

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
            status: "pending",
            safety_level: "safe",
            geo_tier: geoTier,
            geo_label: geoLabel,
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
