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

    if (!Array.isArray(storyIds) || storyIds.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 story IDs required for flow optimization' }),
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
      .select('id, title, category, summary, content_newsletter, content')
      .in('id', storyIds);

    if (fetchError) {
      console.error('Error fetching stories:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stories || stories.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Not enough stories found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Optimizing newsletter flow for ${stories.length} stories`);

    // Build the combined prompt
    const storiesContext = stories.map((story, index) => `
Story ${index + 1}:
ID: ${story.id}
Title: ${story.title}
Category: ${story.category || 'uncategorized'}
Current Newsletter Copy: ${story.content_newsletter || story.summary || story.content.substring(0, 300)}
`).join('\n---\n');

    const systemPrompt = `You are the newsletter editor for Lake Geneva Local, a conversational, friendly, trustworthy hyperlocal news brand. Your job is to rewrite newsletter blurbs so they are varied, human, and enjoyable to read as a set.

OBJECTIVE:
Given multiple stories that will appear in the same newsletter, rewrite ONLY the newsletter voice for each story in a way that:
- Avoids repeated opening patterns
- Uses varied structures (questions, statements, hooks, dates, direct intros, fun facts)
- Matches Lake Geneva Local tone: warm, conversational, positive, concise
- Maintains high factual accuracy
- Keeps each story distinct

RULES:
1. Never start two stories with the same phrase or structure
2. Avoid patterns like "If you're looking for..." or "For a fun..." more than once
3. Use varied structures: questions, statements, hooks, dates, direct intros
4. Maintain Lake Geneva Local tone: warm, conversational, positive, concise
5. Keep factual accuracy - don't change or add details
6. Same length or shorter than original
7. Output must be valid JSON array

VARIATION TECHNIQUES (use at least 3 different ones across all stories):
- Date-first: "This Saturday, downtown Lake Geneva comes alive with..."
- Question hook: "Looking for something fun this weekend?"
- Direct statement: "Live music returns to the lakefront..."
- Highlight hook: "Here's one worth marking on your calendar..."
- Venue-first: "The Abbey Resort is hosting..."
- Vibe-first: "For that cozy winter feeling..."
- Action-first: "Mark your calendars for..."
- Community-first: "Lake Geneva residents are invited to..."

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
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No content generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing JSON...');

    // Parse the JSON response
    let optimizedStories;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, aiContent];
      const jsonContent = jsonMatch[1] || aiContent;
      optimizedStories = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response:', aiContent);
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
        errors: errors.length > 0 ? errors : undefined
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
