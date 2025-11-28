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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[backfill-safety] Starting safety backfill...');

    // Fetch articles without safety data
    const { data: articles, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, content, summary')
      .is('safety_level', null);

    if (fetchError) {
      console.error('[backfill-safety] Error fetching articles:', fetchError);
      throw fetchError;
    }

    console.log(`[backfill-safety] Found ${articles?.length || 0} articles to analyze`);

    let analyzed = 0;
    let failed = 0;

    // Process each article
    for (const article of articles || []) {
      try {
        console.log(`[backfill-safety] Analyzing: ${article.title}`);

        // Call Lovable AI Gateway for safety evaluation
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a content normalizer and safety reviewer for a family-friendly Lake Geneva local media brand.
For each article, you must:
1. Write a clear, neutral, 2–3 sentence summary in a friendly local-news tone.
2. Assign a category: one of events, news, community, dining, or real-estate.
3. Evaluate safety and assign:
   - safety_level: safe, sensitive, or blocked.
   - safety_tags: zero or more labels like crime, public-safety, politics, tragedy, dining, family, graphic-violence, sexual-content, hate, scam.
   - safety_reason: a short sentence explaining why.

Guidelines:
- safe: family-friendly events, dining, attractions, community info, basic weather/traffic, non-controversial business content.
- sensitive: crime, arrests, police logs, non-graphic accidents or fires, political campaigns or protests, obituaries and tragedies, contentious public issues.
- blocked: graphic violence, sexual content, hate/extremist content, obvious scams, or anything inappropriate for a general-audience local community brand.

When in doubt between safe and sensitive, choose sensitive. Only use blocked for clearly inappropriate content.`
              },
              {
                role: 'user',
                content: `Analyze this article:\n\nTitle: ${article.title}\n\nContent: ${article.content}\n\nSummary: ${article.summary || 'None'}`
              }
            ],
            tools: [{
              type: "function",
              function: {
                name: "evaluate_safety",
                description: "Evaluate content safety for Lake Geneva local media",
                parameters: {
                  type: "object",
                  properties: {
                    safety_level: {
                      type: "string",
                      enum: ["safe", "sensitive", "blocked"],
                      description: "Overall safety classification"
                    },
                    safety_tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "Relevant safety labels"
                    },
                    safety_reason: {
                      type: "string",
                      description: "Short explanation of safety classification"
                    }
                  },
                  required: ["safety_level", "safety_tags", "safety_reason"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "evaluate_safety" } }
          }),
        });

        if (!aiResponse.ok) {
          console.error(`[backfill-safety] AI API error for ${article.id}:`, aiResponse.status);
          failed++;
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const safetyData = toolCall ? JSON.parse(toolCall.function.arguments) : null;

        if (!safetyData) {
          console.error(`[backfill-safety] No safety data returned for ${article.id}`);
          failed++;
          continue;
        }

        // Update the article with safety data
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({
            safety_level: safetyData.safety_level,
            safety_tags: safetyData.safety_tags,
            safety_reason: safetyData.safety_reason,
          })
          .eq('id', article.id);

        if (updateError) {
          console.error(`[backfill-safety] Error updating ${article.id}:`, updateError);
          failed++;
        } else {
          console.log(`[backfill-safety] ✓ Updated ${article.id}: ${safetyData.safety_level}`);
          analyzed++;
        }

      } catch (error) {
        console.error(`[backfill-safety] Error processing article ${article.id}:`, error);
        failed++;
      }
    }

    console.log(`[backfill-safety] Complete: ${analyzed} analyzed, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed,
        failed,
        total: articles?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[backfill-safety] Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
