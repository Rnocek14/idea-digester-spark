import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all stories without verticals
    const { data: stories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, content, category, summary, metadata')
      .is('metadata->verticals', null)
      .limit(100); // Process in batches

    if (fetchError) throw fetchError;

    console.log(`📋 Backfilling verticals for ${stories?.length || 0} stories`);

    let processed = 0;
    let errors = 0;

    for (const story of stories || []) {
      try {
        // Call OpenAI to classify verticals
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
                content: `You are a content classifier for Lake Geneva local media.

Assign content_tags (granular attributes): one or more tags like brunch, lunch, dinner, coffee, bar, cocktails, wine, brewery, live-music, dj, late-night, kids, family-friendly, meeting, ordinance, road-closure, school-board, open-house, market-update, etc.

Assign verticals (which accounts should show this): array from ["local", "eats", "nightlife", "civic", "family", "real_estate"]
- Dining content: ["local", "eats"]
- Bars/breweries/late-night/live-music: ["local", "nightlife"] or ["local", "eats", "nightlife"] for food+drink+music
- City meetings, school board, road closures, public notices: ["local", "civic"]
- Family events, kids activities: ["local", "family"]
- Open houses, market updates: ["local", "real_estate"]
- Most events also get "local" - it's the main feed`
              },
              {
                role: "user",
                content: `Classify this article:\n\nTitle: ${story.title}\nCategory: ${story.category}\nSummary: ${story.summary}\nContent: ${story.content?.substring(0, 500)}`
              }
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_content",
                description: "Classify content with tags and verticals",
                parameters: {
                  type: "object",
                  properties: {
                    content_tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "Granular content attributes"
                    },
                    verticals: {
                      type: "array",
                      items: { 
                        type: "string",
                        enum: ["local", "eats", "nightlife", "civic", "family", "real_estate"]
                      },
                      description: "Which account feeds should show this"
                    }
                  },
                  required: ["content_tags", "verticals"],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "classify_content" } }
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI classification failed for story ${story.id}: ${aiResponse.status}`);
          errors++;
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const classification = toolCall ? JSON.parse(toolCall.function.arguments) : {
          content_tags: [],
          verticals: ["local"]
        };

        // Update metadata with new fields
        const updatedMetadata = {
          ...story.metadata,
          content_tags: classification.content_tags || [],
          verticals: classification.verticals || ["local"]
        };

        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ metadata: updatedMetadata })
          .eq('id', story.id);

        if (updateError) {
          console.error(`Failed to update story ${story.id}:`, updateError);
          errors++;
        } else {
          processed++;
          console.log(`✅ Backfilled story ${story.id}: ${classification.verticals.join(', ')}`);
        }

      } catch (error) {
        console.error(`Error processing story ${story.id}:`, error);
        errors++;
      }
    }

    // Log to activity_log
    await supabase.from('activity_log').insert({
      entity_type: 'system',
      action: 'backfill_verticals_completed',
      actor_type: 'system',
      message: `Backfilled verticals for ${processed} stories (${errors} errors)`,
      details: {
        processed,
        errors,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        message: `Backfilled ${processed} stories with verticals`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[backfill-verticals] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
