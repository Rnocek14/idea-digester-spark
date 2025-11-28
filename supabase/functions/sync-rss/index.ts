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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active RSS sources
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .eq("type", "rss");

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
        console.log(`Fetching RSS from: ${source.name}`);

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
        let items: RSSItem[] = channel.item || channel.entry || [];
        if (!Array.isArray(items)) items = [items];

        console.log(`Found ${items.length} items in ${source.name}`);

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

          // Call OpenAI for summarization and categorization
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
                  content: "You are a content normalizer for Lake Geneva local news. Return structured JSON with summary (2-3 sentences) and category (one of: news, events, dining, real-estate, community)."
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
                  description: "Normalize article with summary and category",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "2-3 sentence summary" },
                      category: { 
                        type: "string", 
                        enum: ["news", "events", "dining", "real-estate", "community"],
                        description: "Article category"
                      }
                    },
                    required: ["summary", "category"],
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
          const aiResult = toolCall ? JSON.parse(toolCall.function.arguments) : { summary: rawContent.substring(0, 200), category: "news" };

          // Insert into content_queue
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title: title,
              content: rawContent,
              summary: aiResult.summary || "",
              category: aiResult.category || source.category || "news",
              original_url: originalUrl,
              publish_date: pubDate,
              status: "pending",
              metadata: {
                source_name: source.name,
                original_published_at: pubDate,
                location_tags: source.metadata?.location_tags || ["Lake Geneva"],
                ai_model: "gpt-4o-mini",
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
