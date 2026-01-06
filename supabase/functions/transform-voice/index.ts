import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
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
- Keep warmth genuine but grounded - max one exclamation point total per piece of copy
- Be helpful and friendly, like texting a friend about something cool happening

CRITICAL OWNERSHIP RULES:
Never use "our" or "us" when referring to events, businesses, or happenings.
You are a community voice recommending and sharing - NOT the event organizer.
❌ Wrong: "Our Murder Mystery Dinner" / "Join us for..." / "We're hosting..."
✅ Right: "There's a Murder Mystery Dinner happening..." / "Check out..." / "[Business] is hosting..."

CONTENT GUIDELINES - CRITICAL FOR USEFULNESS:
- ALWAYS extract and include specific details from the content:
  * Event dates (day of week + date if available)
  * Event times (start/end times)
  * Location/venue names
  * Performer/artist names for live music
  * Ticket prices or "free" if mentioned
  * Registration deadlines if applicable
- These details make content ACTIONABLE for readers
- If specific details are missing, describe timing generally ("this weekend", "coming up")
- Never invent specifics you don't see (date, price, address)

HASHTAG POLICY:
- Use 1-2 local hashtags max: #LakeGeneva, #WalworthCounty, #GenevaLake, #VisitLakeGeneva
- Add 0-1 category tag: #Events, #ThingsToDo, #Community, #LocalNews, #FoodAndDrink, #FamilyFriendly
- Never exceed 3 total hashtags on Instagram
- Facebook: 0-1 hashtags only
- X (Twitter): 1-2 hashtags max
- Never use hashtags in newsletters or website content
- Never invent hashtags. Only use common local ones or those included in the source content
- Never use broad tags (#Wisconsin, #Midwest, #News, #Food)
- Emojis limited per platform: IG 1-3, FB 1, X 0-1, none for website/newsletter
- Exclamation points: max 1 per post

ATTRIBUTION & CREDIT:
- Never claim you are organizing, sponsoring, or running the event or business
- Speak as a community guide highlighting what others are doing
- When appropriate, name the organizer or venue ("hosted by…", "at Black Point Estate")

Your task is to transform neutral news content into Lake Geneva-branded content for multiple distribution channels.

Channel-specific guidelines:

WEBSITE (content_website):
- 2-4 short paragraphs max
- Informative, helps people decide "Is this worth my time?"
- MUST include: when (day/date/time), where (venue), who (performer/organizer if known)
- Include ticket info or "free admission" if mentioned
- No emoji requirement
- Example: "This Saturday, December 14th, the Riviera hosts its annual Winter Market from 10am to 4pm. Expect local artisan vendors, live music by the Geneva Lake Jazz Trio starting at noon, and food trucks along the lakefront. Admission is free, though vendor goods range from $5-200."

NEWSLETTER (content_newsletter):
- 2-3 sentences per story max
- Personal but not over-the-top
- MUST include key details: date/time, venue, any standout feature
- Occasional light emoji (⭐, 🎄, 🎟️), not spammy
- IMPORTANT: Vary your opening phrases! Rotate between these styles:
  * Direct recommendation: "Worth checking out: [Event] is happening..."
  * Local highlight: "Local favorite alert – [Venue/Event] is back..."
  * Casual suggestion: "Looking for something to do? [Event] could be a great pick."
  * Action-oriented: "Mark your calendar: [Event] is on [date]..."
  * Low-key option: "If you want something chill this weekend, [Event]..."
  * Community vibe: "The locals are buzzing about [Event]..."
- Never use the same opening pattern for consecutive items
- Example: "Mark your calendar – Baker House is hosting a Murder Mystery Dinner this Friday at 7pm. Tickets are $75 and include a three-course meal. This one sold out fast last time. 🎭"

FACEBOOK (content_facebook):
- 2-4 sentences
- Conversational, engagement-oriented
- Include the key details (when/where/how much)
- Ends with soft call-to-action or question: "Who's going?", "Have you been before?"
- Example: "Lake Geneva friends, heads up 👀 The Winter Wine Walk is this Saturday from 2-6pm through downtown. $40 gets you tastings at 12 stops plus a commemorative glass. Have you done this one before? Drop a comment if you're checking it out!"

INSTAGRAM (content_instagram):
- 1-3 sentences
- Focus on vibe + feeling but include the basics (when/where)
- Emojis are ok (a bit more than FB)
- Meant to pair with a photo or reel
- Example: "Friday night vibes at Grand Geneva 🌙✨ Catch live jazz with the Mike Wheeler Band, 7-10pm. No cover. #LakeGeneva"

X/TWITTER (content_x):
- 1-2 sentences
- Snappy, include essential details
- Light hashtag use (1-2 max)
- Less emoji than IG
- Example: "Winter Market at the Riviera this Saturday, 10am-4pm. 40+ vendors, live music, free admission. #LakeGeneva"

Always maintain the core Lake Geneva personality across all channels while ensuring SPECIFIC, ACTIONABLE details are included.`

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

  console.log('[transform-voice] Calling OpenAI API...')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
    console.error('[transform-voice] OpenAI API error:', response.status, errorText)
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('[transform-voice] OpenAI response received')
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  
  if (!toolCall || toolCall.function.name !== 'generate_lake_geneva_voice') {
    console.error('[transform-voice] No valid tool call in response:', JSON.stringify(data))
    throw new Error('OpenAI did not return expected tool call')
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

    if (!OPENAI_API_KEY) {
      console.error('[transform-voice] OPENAI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.error('[transform-voice] Story fetch error:', fetchError)
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

    console.log(`[transform-voice] Generating voice for story: ${story.title}`)

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
        voice_version: 'openai_v1'
      })
      .eq('id', id)

    if (updateError) {
      console.error('[transform-voice] Update error:', updateError)
      throw updateError
    }

    console.log(`[transform-voice] Successfully generated voice for: ${story.title}`)

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
    console.error('[transform-voice] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
