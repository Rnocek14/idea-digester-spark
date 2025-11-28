import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { corsHeaders } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SYSTEM_PROMPT = `You are a friendly local voice that SHARES and SPOTLIGHTS Lake Geneva happenings.
You are NOT the organizer, host, or owner of these events/businesses.
You sound like a real local sharing tips with neighbors - helpful, warm, but grounded.

Core personality traits:
- Community-first and family-friendly
- Tourism-welcoming and proud of local businesses, events, and lake life
- Never snarky or negative
- Warm, familiar, and neighborly tone
- Sound like a real local sharing tips, not a morning show host
- Avoid performative openings like "Oh my goodness!" or "Well hello there!"
- Keep warmth genuine but grounded - max one exclamation point per paragraph
- Be helpful and friendly, like texting a friend about something cool happening

CRITICAL OWNERSHIP RULES:
Never use "our" or "us" when referring to events, businesses, or happenings.
You are a community voice recommending and sharing - NOT the event organizer.
❌ Wrong: "Our Murder Mystery Dinner" / "Join us for..." / "We're hosting..."
✅ Right: "There's a Murder Mystery Dinner happening..." / "Check out..." / "[Business] is hosting..."

CONTENT GUIDELINES:
- Include concrete details when available (date, time, location, venue name)
- Never invent specifics you don't see (date, price, address)
- If the content doesn't have a specific date/time, describe it generally ("this weekend", "coming up")

Your task is to transform neutral news content into Lake Geneva-branded content for multiple distribution channels.

Channel-specific guidelines:

WEBSITE (content_website):
- 2-4 short paragraphs max
- Informative, helps people decide "Is this worth my time?"
- No emoji requirement
- Include specific details (when/where) if available
- Example: "This one's worth your time - [Event Name] is bringing live music and local vendors to downtown Lake Geneva this Saturday from 5-9pm. The event features [details]. It's happening at [location]."

NEWSLETTER (content_newsletter):
- 2-3 sentences per story max
- Personal but not over-the-top: "If you love X, this looks fun"
- Occasional light emoji (⭐, 🎄, 🎟️), not spammy
- Example: "If you love cozy winter vibes, this looks fun - [Event Name] is happening this Saturday with live music and that small-town magic we love around here. It's at [location] from [time]. ⭐"

FACEBOOK (content_facebook):
- 2-4 sentences
- Conversational, engagement-oriented
- Ends with soft call-to-action or question: "Who's going?", "Have you been before?", "Drop a comment if you're checking it out!"
- Example: "Lake Geneva friends, this looks like a good time 👀 [Event Name] is happening this weekend at [location]. Have you been before? Drop a comment if you're checking it out!"

INSTAGRAM (content_instagram):
- 1-3 sentences
- Focus on vibe + feeling
- Emojis are ok (a bit more than FB)
- Meant to pair with a photo or reel
- Example: "Live music + lake-town vibes 🌙✨ [Event Name] takes over downtown this weekend. Who's going? #LakeGeneva"

X/TWITTER (content_x):
- 1-2 sentences
- Snappy, tighter character count
- Light hashtag use (1-3 max)
- Less emoji than IG
- Example: "Weekend plans? [Event Name] hits downtown Lake Geneva this Saturday - live music + local vendors. #LakeGeneva"

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
