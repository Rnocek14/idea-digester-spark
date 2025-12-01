import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyIds } = await req.json();

    // Handle 0 stories gracefully
    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      console.log('No stories provided, returning empty result');
      return new Response(
        JSON.stringify({ 
          success: true,
          optimizedStories: [],
          updatedCount: 0,
          totalStories: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (storyIds.length > 20) {
      return new Response(
        JSON.stringify({ error: 'Too many stories selected; max is 20 per optimization run' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all stories
    const { data: stories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, category, summary, content_newsletter, content, original_url')
      .in('id', storyIds);

    if (fetchError) {
      console.error('Error fetching stories:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stories || stories.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          optimizedStories: [],
          updatedCount: 0,
          totalStories: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle single story: just return original content_newsletter
    if (stories.length === 1) {
      const story = stories[0];
      const fallbackContent = story.content_newsletter || 
                              story.summary || 
                              (story.content ? story.content.substring(0, 300) : 'No content available');
      
      console.log(`Single story optimization: returning original content for "${story.title}"`);
      
      return new Response(
        JSON.stringify({
          success: true,
          optimizedStories: [
            { id: story.id, newsletter_voice: fallbackContent }
          ],
          updatedCount: 0,
          totalStories: 1,
          message: 'Single story - no optimization needed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Optimizing newsletter flow for ${stories.length} stories`);

    // Build the combined prompt
    const storiesContext = stories.map((story, index) => {
      const fallbackContent = story.content_newsletter || 
                              story.summary || 
                              (story.content ? story.content.substring(0, 300) : 'No content available');
      
      return `
Story ${index + 1}:
ID: ${story.id}
Title: ${story.title}
Category: ${story.category || 'uncategorized'}
Source URL: ${story.original_url || 'No URL available'}
Current Newsletter Copy: ${fallbackContent}
`;
    }).join('\n---\n');

    const systemPrompt = `You are the newsletter editor for Lake Geneva Local. Your job is to rewrite newsletter blurbs with factual clarity and varied structure.

TONE REQUIREMENT:
Write in a factual, direct, concise tone. Avoid hype, excitement, emotional language, and marketing fluff. Sound like a trusted local news editor sharing facts, not a promoter selling an experience.

HARD BANS — DO NOT USE THESE WORDS OR PHRASES:
- perfect / perfect for
- unleash your inner / unleash
- for all ages / all ages
- festive / holiday magic / magical
- delightful / charming adventure / wonderful chance
- special (as in "special event")
- fun for the whole family
- All aboard! (or similar hype exclamations)
- Feeling creative? / Looking for...? / Ready to...? (vibe-first question openers)
- truly unique
- exciting / amazing / incredible

SENTENCE STRUCTURE RULES:
1. If the story has a specific date, time, or venue, lead with it in the first sentence
2. Never lead with a question or vibe phrase
3. Keep each blurb to 1-2 sentences max
4. No exclamation marks except when already present in the event title itself

ALLOWED CONTEXTUAL ADDITIONS (only if present in source content):
- Venue name and location
- Format descriptors: drop-in, ticketed, reservation required, free, recurring, advance tickets recommended
- Audience indicators: family-friendly, all ages, adults, all skill levels
- Schedule details: weekly, one-time, specific date range, runs through [date]
- Setting: indoors, outdoors
- When useful, add a second short sentence with purely practical context (venue, price, reservation/RSVP requirement, format details) - only if that information appears in the original source. Do not invent or assume information.

VARIATION TECHNIQUES (prioritize date/time/location when available):
- Date-first: "This Saturday, the Geneva Theater hosts..."
- Venue-first: "The Abbey Resort hosts brunch with Santa every Sunday through December 21st."
- Direct statement: "Open Paint sessions run Sundays at Creative Forces Art Studio."
- Event detail: "The East Troy Railroad runs holiday-season train rides on select December dates."

RULES:
1. Never start two stories with the same phrase or structure
2. Vary sentence length and structure across blurbs so they don't all read identically
3. Maintain factual accuracy - don't change or add details not in the source
4. Same length or shorter than original
5. Output must be valid JSON array
6. Prefer concrete specifics (dates, venues, times, names) over vibe/hype words

OUTPUT FORMAT:
Return a valid JSON array with this exact structure:
[
  { "id": "story-uuid-1", "newsletter_voice": "rewritten copy here" },
  { "id": "story-uuid-2", "newsletter_voice": "rewritten copy here" }
]`;

    const userPrompt = `Rewrite the newsletter voice for these ${stories.length} stories, ensuring each has a unique opening and structure:\n\n${storiesContext}`;

    // Call Lovable AI
    console.log('Calling Lovable AI for newsletter flow optimization...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 1.0,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No content generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure content is a string (handle Gemini-style array responses)
    if (typeof rawContent !== 'string') {
      console.log('AI returned non-string content, converting...');
      rawContent = JSON.stringify(rawContent);
    }

    console.log('AI response received, parsing JSON...');

    // Parse the JSON response
    let optimizedStories;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       rawContent.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, rawContent];
      const jsonContent = jsonMatch[1] || rawContent;
      optimizedStories = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response:', rawContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(optimizedStories)) {
      console.error('AI response is not an array:', optimizedStories);
      return new Response(
        JSON.stringify({ error: 'Invalid response format from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update each story
    let updatedCount = 0;
    const errors = [];

    for (const optimized of optimizedStories) {
      if (!optimized.id || !optimized.newsletter_voice) {
        console.error('Invalid story format:', optimized);
        errors.push(`Invalid format for story ${optimized.id || 'unknown'}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('content_queue')
        .update({ content_newsletter: optimized.newsletter_voice })
        .eq('id', optimized.id);

      if (updateError) {
        console.error(`Error updating story ${optimized.id}:`, updateError);
        errors.push(`Failed to update story ${optimized.id}`);
      } else {
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount}/${stories.length} stories`);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount,
        totalStories: stories.length,
        errors: errors.length > 0 ? errors : undefined,
        optimizedStories // Return the optimized content for preview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in optimize-newsletter-flow:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
