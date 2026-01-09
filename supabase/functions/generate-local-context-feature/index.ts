import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-editorial-secret',
};

// Conservative, trust-first system prompt
const SYSTEM_PROMPT = `You are a local editor for a Lake Geneva area publication. Write like a human observer who lives in the community.

CRITICAL RULES:
- Do NOT encourage people to visit
- Do NOT use marketing language  
- Do NOT praise excessively
- Do NOT invent facts - only use what's provided
- If evidence is thin, write conservatively and say less
- Never use: "you should check out", "the best place", "amazing", "incredible", "must-try", "hidden gem"
- Allowed language: "often mentioned for", "locals tend to highlight", "known around town for"

TONE: Observational, local, grounded, slightly conservative. Explain why this place comes up in local conversation - don't sell it.`;

interface ReputationContext {
  local_reputation?: string;
  distinguishing_feature?: string;
  features?: string[];
  is_lakefront?: boolean;
  fish_fry?: any;
  happy_hour?: any;
  price_range?: string;
  city?: string;
  address?: string;
}

interface TimelyHook {
  id: string;
  headline: string;
  summary?: string;
  hook_type: string;
  published_at: string;
  source_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Early logging for debugging
  console.log('LCF request', {
    method: req.method,
    hasAuth: !!req.headers.get('authorization'),
    hasSecret: !!req.headers.get('x-editorial-secret'),
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Support both secret env var names for robustness
    const editorialSecret = 
      Deno.env.get('EDITORIAL_SECRET') || 
      Deno.env.get('EDITORIAL_GENERATION_SECRET') || 
      '';

    // Auth check - support both secret header and JWT auth
    const authHeader = req.headers.get('authorization');
    const providedSecret = req.headers.get('x-editorial-secret');
    
    let isAuthorized = !!editorialSecret && providedSecret === editorialSecret;
    
    console.log('Auth check', { 
      hasEditorialSecret: !!editorialSecret,
      providedSecretMatch: isAuthorized,
      hasAuthHeader: !!authHeader 
    });
    
    // If not authorized via secret, try JWT auth with admin role check
    if (!isAuthorized && authHeader) {
      // Use anon client with user's bearer token
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      
      if (user && !userError) {
        // Use service role to check admin status
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: roleData } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        isAuthorized = !!roleData;
        console.log('JWT auth result', { userId: user.id, isAdmin: isAuthorized });
      } else {
        console.log('JWT auth failed', { error: userError?.message });
      }
    }
    
    if (!isAuthorized) {
      console.log('Authorization failed - returning 401');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create service role client for all DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { restaurant_id, force = false, dry_run = false } = body;
    
    console.log('Request params', { restaurant_id, force, dry_run });
    
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check eligibility using our database function
    const { data: eligibility, error: eligError } = await supabase
      .rpc('check_feature_eligibility', { p_restaurant_id: restaurant_id });
    
    if (eligError) {
      console.error('Eligibility check failed:', eligError);
      return new Response(JSON.stringify({ error: 'Eligibility check failed', details: eligError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Eligibility result', eligibility);

    if (!eligibility.eligible && !force) {
      return new Response(JSON.stringify({
        error: 'Restaurant not eligible for Local Context Feature',
        eligibility,
        message: `Gate 1 (≥2 reputation signals): ${eligibility.gate1_passed ? 'PASSED' : 'FAILED'} (${eligibility.reputation_signals} signals). Gate 2 (current hook): ${eligibility.gate2_passed ? 'PASSED' : 'FAILED'}.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get full restaurant data
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurant_id)
      .single();
    
    if (restError || !restaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get current hooks - use literal ISO timestamp instead of now()
    const nowIso = new Date().toISOString();
    const { data: hooks } = await supabase
      .from('restaurant_news')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_current', true)
      .not('hook_type', 'is', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('published_at', { ascending: false })
      .limit(10); // Get more so we can score them

    // Score hooks to pick the best one, not just newest
    const scoreHook = (h: any): number => {
      let score = 0;
      if (h.verified) score += 2;
      if (h.summary) score += 1;
      if (h.source_url) score += 1;
      if (['event_series', 'anniversary', 'award', 'expansion'].includes(h.hook_type)) score += 1;
      return score;
    };

    const sortedHooks = (hooks || [])
      .map(h => ({ ...h, _score: scoreHook(h) }))
      .sort((a, b) => b._score - a._score || new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    const currentHooks: TimelyHook[] = sortedHooks.slice(0, 3);
    const primaryHook = currentHooks[0];

    console.log('Hook selection', { 
      total: hooks?.length || 0, 
      primaryHook: primaryHook ? { headline: primaryHook.headline, score: (primaryHook as any)._score } : null 
    });

    if (!primaryHook && !force) {
      return new Response(JSON.stringify({ error: 'No current hook found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build reputation context
    const reputationContext: ReputationContext = {
      local_reputation: restaurant.local_reputation,
      distinguishing_feature: restaurant.distinguishing_feature,
      features: restaurant.features,
      is_lakefront: restaurant.is_lakefront,
      fish_fry: restaurant.fish_fry,
      happy_hour: restaurant.happy_hour,
      price_range: restaurant.price_range,
      city: restaurant.city,
      address: restaurant.address,
    };

    // Check for existing feature this month - use proper UTC start of month
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const startIso = startOfMonth.toISOString();

    const { data: existing } = await supabase
      .from('content_queue')
      .select('id, metadata')
      .eq('source_type', 'local_context_feature')
      .gte('created_at', startIso)
      .limit(100);

    const alreadyExists = existing?.some(item => {
      const meta = item.metadata as any;
      return meta?.restaurant_id === restaurant_id;
    });

    if (alreadyExists && !force) {
      const existingItem = existing?.find(item => (item.metadata as any)?.restaurant_id === restaurant_id);
      return new Response(JSON.stringify({
        error: 'Feature already generated this month',
        existing_id: existingItem?.id
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate content
    let content: string = '';
    let summary: string = '';
    
    if (lovableApiKey) {
      // AI-powered generation
      const userPrompt = buildUserPrompt(restaurant.name, primaryHook, reputationContext, currentHooks);
      
      console.log('Calling AI for content generation...');
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
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
              name: 'generate_local_context_feature',
              description: 'Generate a Local Context Feature article',
              parameters: {
                type: 'object',
                properties: {
                  title: { 
                    type: 'string',
                    description: 'Article title following format: "What\'s New at [Business] — and Why Locals Keep Talking About It"'
                  },
                  whats_new: {
                    type: 'string',
                    description: 'Section 1: Clear, factual explanation of why this article exists now (the timely hook). 2-3 sentences.'
                  },
                  why_it_comes_up: {
                    type: 'string',
                    description: 'Section 2: Synthesis of historical reputation - longevity, what it\'s known for, why mentioned repeatedly. This is explanation, not praise. 3-4 sentences.'
                  },
                  what_people_appreciate: {
                    type: 'string',
                    description: 'Section 3: Specific, sourced details - signature offerings, atmosphere, consistency. No adjectives without backing. 2-3 sentences.'
                  },
                  practical_info: {
                    type: 'string',
                    description: 'Section 4: Location, typical offerings, seasonal notes if relevant. 1-2 sentences.'
                  },
                  summary: {
                    type: 'string',
                    description: 'One-sentence summary for newsletter/social. Conservative tone.'
                  }
                },
                required: ['title', 'whats_new', 'why_it_comes_up', 'what_people_appreciate', 'practical_info', 'summary'],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'generate_local_context_feature' } }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', errorText);
        // Fall back to template
        const fallback = generateFallbackContent(restaurant.name, primaryHook, reputationContext);
        content = fallback.content;
        summary = fallback.summary;
      } else {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          // Wrap JSON parse in try/catch for robustness
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error('Failed to parse tool arguments:', parseError, toolCall.function.arguments);
            const fallback = generateFallbackContent(restaurant.name, primaryHook, reputationContext);
            content = fallback.content;
            summary = fallback.summary;
            args = null;
          }
          
          if (args) {
            content = formatArticle(args, restaurant);
            summary = args.summary;
            console.log('AI generation successful');
          }
        } else {
          console.log('No tool call in AI response, using fallback');
          const fallback = generateFallbackContent(restaurant.name, primaryHook, reputationContext);
          content = fallback.content;
          summary = fallback.summary;
        }
      }
    } else {
      console.log('No LOVABLE_API_KEY, using template fallback');
      const fallback = generateFallbackContent(restaurant.name, primaryHook, reputationContext);
      content = fallback.content;
      summary = fallback.summary;
    }

    // Prepare trust labels
    const trustLabels = [];
    if (eligibility.reputation_signals >= 3) trustLabels.push('strong-reputation');
    if (restaurant.is_lakefront) trustLabels.push('lakefront');
    if (primaryHook?.hook_type === 'event_series') trustLabels.push('event-driven');
    if (primaryHook?.hook_type === 'anniversary') trustLabels.push('milestone');

    // DRY RUN - return without inserting
    if (dry_run) {
      console.log('Dry run - returning without insert');
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        restaurant: restaurant.name,
        eligibility,
        primary_hook: primaryHook,
        trust_labels: trustLabels,
        generated_content: content,
        summary,
        would_insert: {
          title: `What's New at ${restaurant.name}`,
          source_type: 'local_context_feature',
          status: 'pending_review',
          category: 'dining',
          geo_tier: 1
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert into content_queue - using only columns that exist
    const { data: inserted, error: insertError } = await supabase
      .from('content_queue')
      .insert({
        source_type: 'local_context_feature',
        title: `What's New at ${restaurant.name}`,
        content,
        summary,
        status: 'pending_review',
        category: 'dining',
        geo_tier: 1, // core = 1
        geo_label: restaurant.city || 'Lake Geneva Area',
        normalized_url: restaurant.website || restaurant.source_url,
        original_url: primaryHook?.source_url,
        trust_labels: trustLabels,
        metadata: {
          restaurant_id,
          restaurant_name: restaurant.name,
          eligibility,
          primary_hook: primaryHook,
          reputation_context: reputationContext,
          generated_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save content', details: insertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Content inserted', { id: inserted.id });

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'local_context_feature_generated',
      entity_type: 'content_queue',
      entity_id: inserted.id,
      message: `Generated Local Context Feature for ${restaurant.name}`,
      details: {
        restaurant_id,
        eligibility,
        trust_labels: trustLabels
      }
    });

    return new Response(JSON.stringify({
      success: true,
      content_id: inserted.id,
      restaurant: restaurant.name,
      eligibility,
      trust_labels: trustLabels,
      preview: content.substring(0, 500) + '...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildUserPrompt(
  name: string, 
  hook: TimelyHook | undefined, 
  context: ReputationContext,
  allHooks: TimelyHook[]
): string {
  let prompt = `Generate a Local Context Feature article for: ${name}\n\n`;
  
  prompt += `## TIMELY HOOK (Why we're writing this now)\n`;
  if (hook) {
    prompt += `- Headline: ${hook.headline}\n`;
    if (hook.summary) prompt += `- Details: ${hook.summary}\n`;
    prompt += `- Type: ${hook.hook_type}\n`;
    prompt += `- Published: ${hook.published_at}\n`;
  }
  
  if (allHooks.length > 1) {
    prompt += `\nOther recent news:\n`;
    allHooks.slice(1).forEach(h => {
      prompt += `- ${h.headline} (${h.hook_type})\n`;
    });
  }
  
  prompt += `\n## REPUTATION CONTEXT (Historical signals)\n`;
  if (context.local_reputation) {
    prompt += `- Local reputation: ${context.local_reputation}\n`;
  }
  if (context.distinguishing_feature) {
    prompt += `- Distinguishing feature: ${context.distinguishing_feature}\n`;
  }
  if (context.features && context.features.length > 0) {
    prompt += `- Known for: ${context.features.join(', ')}\n`;
  }
  if (context.is_lakefront) {
    prompt += `- Location: Lakefront property\n`;
  }
  if (context.fish_fry) {
    prompt += `- Included in Fish Fry Guide\n`;
  }
  if (context.happy_hour) {
    prompt += `- Included in Happy Hour Guide\n`;
  }
  
  prompt += `\n## PRACTICAL INFO\n`;
  if (context.city) prompt += `- City: ${context.city}\n`;
  if (context.address) prompt += `- Address: ${context.address}\n`;
  if (context.price_range) prompt += `- Price range: ${context.price_range}\n`;
  
  prompt += `\nRemember: Write conservatively. If evidence is thin, say less. No marketing language.`;
  
  return prompt;
}

function formatArticle(args: any, restaurant: any): string {
  let article = `# ${args.title}\n\n`;
  
  article += `## What's New\n\n${args.whats_new}\n\n`;
  article += `## Why It Comes Up Locally\n\n${args.why_it_comes_up}\n\n`;
  article += `## What People Appreciate\n\n${args.what_people_appreciate}\n\n`;
  article += `## Practical Info\n\n${args.practical_info}\n\n`;
  
  // Add location if available
  if (restaurant.address || restaurant.city) {
    article += `📍 ${restaurant.address || restaurant.city}`;
    if (restaurant.website) article += ` • [Website](${restaurant.website})`;
    article += '\n\n';
  }
  
  // Trust-building footer
  article += `---\n\n*If something here is outdated or incorrect, let us know and we'll fix it fast.*`;
  
  return article;
}

function generateFallbackContent(
  name: string, 
  hook: TimelyHook | undefined, 
  context: ReputationContext
): { content: string; summary: string } {
  let content = `# What's New at ${name} — and Why Locals Keep Talking About It\n\n`;
  
  // Section 1: What's New
  content += `## What's New\n\n`;
  if (hook) {
    content += `${hook.headline}. `;
    if (hook.summary) content += hook.summary;
    content += '\n\n';
  } else {
    content += `[Timely hook to be added]\n\n`;
  }
  
  // Section 2: Why It Comes Up
  content += `## Why It Comes Up Locally\n\n`;
  const reputationParts: string[] = [];
  if (context.local_reputation) {
    reputationParts.push(context.local_reputation);
  }
  if (context.distinguishing_feature) {
    reputationParts.push(`Known for: ${context.distinguishing_feature}`);
  }
  if (context.is_lakefront) {
    reputationParts.push('Located on the lakefront');
  }
  content += reputationParts.length > 0 
    ? reputationParts.join('. ') + '.\n\n'
    : `${name} has been part of the local dining scene.\n\n`;
  
  // Section 3: What People Appreciate
  content += `## What People Appreciate\n\n`;
  if (context.features && context.features.length > 0) {
    content += `Locals often mention: ${context.features.join(', ')}.\n\n`;
  } else {
    content += `[Specific details to be added based on available evidence]\n\n`;
  }
  
  // Section 4: Practical Info
  content += `## Practical Info\n\n`;
  if (context.city) content += `📍 ${context.city}`;
  if (context.price_range) content += ` • ${context.price_range}`;
  content += '\n\n';
  
  // Footer
  content += `---\n\n*If something here is outdated or incorrect, let us know and we'll fix it fast.*`;
  
  const summary = hook 
    ? `${name} has news: ${hook.headline.toLowerCase()}.`
    : `A look at what's happening at ${name}.`;
  
  return { content, summary };
}
