import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { corsHeaders } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SYSTEM_PROMPT = `You are the friendly local voice of Lake Geneva, Wisconsin.
You sound like a warm, upbeat neighbor who loves sharing what's happening around town.

Core personality traits:
- Community-first and family-friendly
- Tourism-welcoming and proud of local businesses, events, and lake life
- Never snarky or negative
- Lightly playful, but not cheesy
- Warm, familiar, and neighborly tone

Your task is to transform neutral news content into Lake Geneva-branded content for multiple distribution channels.

Channel-specific guidelines:

WEBSITE (content_website):
- Slightly longer and descriptive
- Informative, helps people decide "Is this worth my time?"
- No emoji requirement
- Good headings and clear info
- Example: "Looking for something cozy to do this weekend in Lake Geneva? [Event] brings live music, local vendors, and family-friendly fun to downtown…"

NEWSLETTER (content_newsletter):
- Personal tone: "Hey Lake Geneva, here's what's happening…"
- Curated feel: "If you're into X, you'll love this"
- 2-4 sentences max per item
- Occasional light emoji (⭐, 🎄, 🎟️), not spammy
- Example: "If you love cozy winter nights by the lake, this one's for you. [Event] is bringing live music, local food, and that small-town magic to downtown Lake Geneva this Saturday. ⭐"

FACEBOOK (content_facebook):
- Conversational, engagement-oriented
- 1-3 short paragraphs
- Ends with soft call-to-action or question: "Who's going?", "Have you been before?", "Tag someone who'd love this."
- Example: "Lake Geneva friends, this looks fun 👀 [Event] is happening this weekend with live music, great food, and plenty of local charm. Have you been before? Drop a comment if you're planning to go!"

INSTAGRAM (content_instagram):
- Short and punchy
- Focus on vibe + feeling
- Emojis are ok (a bit more than FB)
- Meant to pair with a photo or reel
- 1-2 lines + maybe a hashtag
- Example: "Cozy lights, live music, and lake-town vibes. 🌙✨ [Event] is taking over downtown Lake Geneva this weekend. Who's in? #LakeGeneva"

X/TWITTER (content_x):
- Snappy, tighter character count
- Clear hook + link
- Light hashtag use (1-3 max)
- Less emoji than IG
- Example: "Looking for weekend plans in Lake Geneva? [Event] brings live music + local vendors to downtown this Saturday. #LakeGeneva #WeekendPlans"

Always maintain the core Lake Geneva personality across all channels while adapting the format and length appropriately.`

interface VoiceVariants {
  content_lg_base: string
  content_website: string
  content_newsletter: string
  content_facebook: string
  content_instagram: string
  content_x: string
}

async function generateVoiceVariants(
  title: string,
  category: string,
  safetyLevel: string,
  summary: string,
  content: string
): Promise<VoiceVariants> {
  const userPrompt = `Base info:
Title: ${title}
Category: ${category}
Safety level: ${safetyLevel}
Summary: ${summary}
Full content: ${content || summary}

Task:
1) Rewrite in Lake Geneva brand voice (base).
2) Then generate variants for website, newsletter, facebook, instagram, and x.

Return the content for all channels following the guidelines provided.`

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_lake_geneva_voice',
          description: 'Generate Lake Geneva brand voice content for multiple channels',
          parameters: {
            type: 'object',
            properties: {
              content_lg_base: { type: 'string', description: 'Unified Lake Geneva voice version' },
              content_website: { type: 'string', description: 'Long-form website version' },
              content_newsletter: { type: 'string', description: 'Personal newsletter version' },
              content_facebook: { type: 'string', description: 'Conversational Facebook version' },
              content_instagram: { type: 'string', description: 'Short Instagram version' },
              content_x: { type: 'string', description: 'Snappy X/Twitter version' }
            },
            required: [
              'content_lg_base',
              'content_website',
              'content_newsletter',
              'content_facebook',
              'content_instagram',
              'content_x'
            ],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'generate_lake_geneva_voice' } }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Lovable AI error:', response.status, errorText)
    throw new Error(`AI generation failed: ${response.status}`)
  }

  const data = await response.json()
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  
  if (!toolCall || toolCall.function.name !== 'generate_lake_geneva_voice') {
    throw new Error('AI did not return expected tool call')
  }

  return JSON.parse(toolCall.function.arguments)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { mode = 'single', id } = await req.json()

    if (mode === 'single' && !id) {
      return new Response(
        JSON.stringify({ error: 'id is required for single mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch the story
    const { data: story, error: fetchError } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !story) {
      console.error('Story fetch error:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Story not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Skip blocked content
    if (story.safety_level === 'blocked') {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot generate voice for blocked content',
          skipped: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating voice for story: ${story.title}`)

    // Generate voice variants
    const variants = await generateVoiceVariants(
      story.title,
      story.category || 'general',
      story.safety_level || 'safe',
      story.summary || '',
      story.content || ''
    )

    // Update the story with voice variants
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        content_lg_base: variants.content_lg_base,
        content_website: variants.content_website,
        content_newsletter: variants.content_newsletter,
        content_facebook: variants.content_facebook,
        content_instagram: variants.content_instagram,
        content_x: variants.content_x,
        voice_generated_at: new Date().toISOString(),
        voice_version: 'lg_voice_v1'
      })
      .eq('id', id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    console.log(`Successfully generated voice for: ${story.title}`)

    return new Response(
      JSON.stringify({
        success: true,
        storyId: id,
        title: story.title,
        variants
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in transform-voice:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
