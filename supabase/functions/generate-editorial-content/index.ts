import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shared secret for system invocations (set in Supabase secrets)
const EDITORIAL_SECRET = Deno.env.get('EDITORIAL_GENERATION_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Auth check: require either admin JWT or shared secret
    const authHeader = req.headers.get('Authorization');
    const secretHeader = req.headers.get('X-Editorial-Secret');
    
    let isAuthorized = false;
    
    // Check shared secret (for cron/system calls)
    if (EDITORIAL_SECRET && secretHeader === EDITORIAL_SECRET) {
      isAuthorized = true;
    }
    
    // Check admin JWT (use getUser for broader compatibility)
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      
      if (!userError && user?.id) {
        // Check if user is admin
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();
        
        if (roleData) {
          isAuthorized = true;
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { content_type = 'fish_fry_guide', force = false } = await req.json().catch(() => ({}));

    // Phase 3: Only fish_fry_guide is implemented
    if (content_type !== 'fish_fry_guide') {
      return new Response(JSON.stringify({ 
        error: 'Only fish_fry_guide is currently supported' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ISO 8601 week calculation (handles year boundaries correctly)
    const getISOWeekKey = (date: Date): string => {
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      // Set to nearest Thursday (ISO week starts Monday, week 1 contains Jan 4)
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };
    
    const now = new Date();
    const weekKey = getISOWeekKey(now);
    
    // Idempotency check: unambiguous query using nested metadata structure
    const { data: existingGuide } = await supabase
      .from('content_queue')
      .select('id, created_at, metadata')
      .eq('source_type', 'data_journalism')
      .contains('metadata', { editorial: { content_type: 'fish_fry_guide', week_key: weekKey } })
      .maybeSingle();
    
    if (existingGuide && !force) {
      // Return 200 with skipped flag for clean cron logs
      return new Response(JSON.stringify({ 
        success: true,
        skipped: true,
        reason: 'already_generated',
        week_key: weekKey,
        existing_queue_id: existingGuide.id,
        created_at: existingGuide.created_at
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch fish fry data with restaurant details including new feature-grade fields
    const { data: fishFryDeals, error: dealsError } = await supabase
      .from('restaurant_deals')
      .select(`
        id,
        restaurant_id,
        price,
        fish_type,
        all_you_can_eat,
        sides,
        days,
        start_time,
        end_time,
        verification_status,
        last_seen_at,
        evidence_snippet,
        restaurants!inner(
          name, 
          city, 
          address,
          price_range,
          is_lakefront,
          features,
          local_reputation,
          distinguishing_feature
        )
      `)
      .eq('deal_type', 'fish_fry')
      .gte('confidence_score', 0.7)
      .order('last_seen_at', { ascending: false });

    if (dealsError) {
      console.error('Error fetching fish fry deals:', dealsError);
      throw dealsError;
    }

    // Parse prices safely - strip $ and parse as number
    const parsePrice = (price: unknown): number | null => {
      if (price === null || price === undefined) return null;
      const str = String(price).replace(/[$,]/g, '').trim();
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    };

    // Quality gate: only include restaurants that meet feature-grade criteria
    // Must have: price OR price_range, AND at least one distinguishing element
    const qualifyingDeals = (fishFryDeals || []).filter(deal => {
      const restaurant = deal.restaurants as any;
      const hasPrice = parsePrice(deal.price) !== null || restaurant?.price_range;
      const hasDistinction = 
        deal.fish_type || 
        deal.all_you_can_eat || 
        restaurant?.is_lakefront ||
        restaurant?.local_reputation ||
        restaurant?.distinguishing_feature ||
        (restaurant?.features && restaurant.features.length > 0) ||
        deal.evidence_snippet;
      
      return hasPrice && hasDistinction;
    });

    const excludedCount = (fishFryDeals?.length || 0) - qualifyingDeals.length;
    const dealCount = qualifyingDeals.length;
    const verifiedCount = qualifyingDeals.filter(d => d.verification_status === 'verified').length;
    
    const prices = qualifyingDeals.map(d => parsePrice(d.price)).filter((p): p is number => p !== null);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
    
    // Create data snapshot
    const snapshotSummary = {
      total_deals: dealCount,
      excluded_for_quality: excludedCount,
      verified_deals: verifiedCount,
      price_range: { min: minPrice, max: maxPrice },
      restaurants: qualifyingDeals.map(d => {
        const restaurant = d.restaurants as any;
        return {
          name: restaurant?.name,
          city: restaurant?.city,
          price: parsePrice(d.price),
          fish_type: d.fish_type,
          ayce: d.all_you_can_eat,
          days: d.days,
          verified: d.verification_status === 'verified',
          is_lakefront: restaurant?.is_lakefront,
          local_reputation: restaurant?.local_reputation,
          distinguishing_feature: restaurant?.distinguishing_feature
        };
      })
    };

    const { data: snapshot, error: snapshotError } = await supabase
      .from('data_snapshots')
      .insert({
        query_description: `Fish fry deals for week of ${new Date().toLocaleDateString()}`,
        result_summary: snapshotSummary,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('Error creating snapshot:', snapshotError);
    }

    // Filter Friday deals (case-insensitive)
    const isFridayDeal = (days: unknown): boolean => {
      if (!days) return false;
      const daysStr = Array.isArray(days) ? days.join(' ') : String(days);
      return daysStr.toLowerCase().includes('fri');
    };
    
    const fridayDeals = qualifyingDeals.filter(d => isFridayDeal(d.days));
    const ayceDeals = qualifyingDeals.filter(d => d.all_you_can_eat);
    const lakefrontDeals = qualifyingDeals.filter(d => (d.restaurants as any)?.is_lakefront);

    // Generate feature-grade content with AI recommendations per restaurant
    let restaurantBlocks: string[] = [];
    
    if (lovableApiKey && qualifyingDeals.length > 0) {
      // Generate human recommendations for each restaurant
      for (const deal of qualifyingDeals) {
        const restaurant = deal.restaurants as any;
        
        // Build context for AI
        const context = {
          name: restaurant?.name || 'Unknown',
          city: restaurant?.city,
          fish_type: deal.fish_type,
          price: parsePrice(deal.price),
          price_range: restaurant?.price_range,
          is_lakefront: restaurant?.is_lakefront,
          all_you_can_eat: deal.all_you_can_eat,
          sides: deal.sides,
          local_reputation: restaurant?.local_reputation,
          distinguishing_feature: restaurant?.distinguishing_feature,
          features: restaurant?.features,
          evidence_snippet: deal.evidence_snippet,
          verified: deal.verification_status === 'verified'
        };

        try {
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
                  content: `You are a local food writer for Lake Geneva. Write 2-3 sentences recommending this restaurant's fish fry to a local audience.

RULES:
- Use a warm, human tone like you're telling a friend
- Reference what locals like about it and what makes it distinct
- DO NOT invent facts - only use information provided
- If evidence is thin, write conservatively and focus on what you know
- Never use phrases like "data shows" or "according to our sources"
- Sound like a genuine recommendation, not a summary`
                },
                {
                  role: 'user',
                  content: `Write a 2-3 sentence recommendation for ${context.name}'s fish fry.

Known facts:
- Fish type: ${context.fish_type || 'not specified'}
- Price: ${context.price ? `$${context.price}` : context.price_range || 'varies'}
- All-you-can-eat: ${context.all_you_can_eat ? 'Yes' : 'No'}
- Lakefront: ${context.is_lakefront ? 'Yes' : 'No'}
- Local reputation: ${context.local_reputation || 'not available'}
- What makes it special: ${context.distinguishing_feature || 'not specified'}
- Features: ${context.features?.join(', ') || 'none listed'}
- Evidence from their site: "${context.evidence_snippet || 'none available'}"

Write only the 2-3 sentence recommendation, nothing else.`
                }
              ],
              max_tokens: 200,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const recommendation = aiData.choices?.[0]?.message?.content?.trim();
            
            if (recommendation) {
              // Build the feature-grade block
              let block = `### ${restaurant?.name}\n\n`;
              block += `${recommendation}\n\n`;
              
              // Add verified facts as compact info line
              const facts: string[] = [];
              if (context.fish_type) facts.push(`🐟 ${context.fish_type}`);
              if (isFridayDeal(deal.days)) facts.push('📅 Friday');
              if (context.price) facts.push(`💰 ~$${context.price}`);
              else if (context.price_range) facts.push(`💰 ${context.price_range}`);
              if (context.all_you_can_eat) facts.push('🍽️ AYCE');
              if (context.is_lakefront) facts.push('🌊 Lakefront');
              if (context.verified) facts.push('✓ Verified');
              
              if (facts.length > 0) {
                block += facts.join(' · ') + '\n';
              }
              
              restaurantBlocks.push(block);
            }
          }
        } catch (aiError) {
          console.error(`AI generation failed for ${restaurant?.name}:`, aiError);
          // Fallback to basic listing
          restaurantBlocks.push(formatBasicListing(deal, restaurant));
        }
      }
    } else {
      // No API key - use basic format
      qualifyingDeals.forEach(deal => {
        const restaurant = deal.restaurants as any;
        restaurantBlocks.push(formatBasicListing(deal, restaurant));
      });
    }

    // Helper function for fallback format
    function formatBasicListing(deal: any, restaurant: any): string {
      const price = parsePrice(deal.price);
      let block = `### ${restaurant?.name}\n\n`;
      block += `A local option for fish fry`;
      if (restaurant?.city) block += ` in ${restaurant.city}`;
      block += '.\n\n';
      
      const facts: string[] = [];
      if (deal.fish_type) facts.push(`🐟 ${deal.fish_type}`);
      if (isFridayDeal(deal.days)) facts.push('📅 Friday');
      if (price) facts.push(`💰 ~$${price}`);
      if (deal.all_you_can_eat) facts.push('🍽️ AYCE');
      if (restaurant?.is_lakefront) facts.push('🌊 Lakefront');
      
      if (facts.length > 0) block += facts.join(' · ') + '\n';
      return block;
    }

    // Generate the full article
    const title = `This Week's Fish Fry Guide: ${dealCount} Curated Picks in the Lake Geneva Area`;
    
    let content = `# ${title}\n\n`;
    
    // Opening paragraph
    content += `*Your curated guide to the best fish fry options this week. Each spot was selected for having something worth knowing about — whether it's lakefront views, generous portions, or that beer-battered cod locals keep coming back for.*\n\n`;
    
    if (excludedCount > 0) {
      content += `*Note: ${excludedCount} additional restaurants were excluded from this guide due to incomplete information.*\n\n`;
    }
    
    content += `---\n\n`;
    
    // Restaurant blocks
    content += restaurantBlocks.join('\n---\n\n');
    
    // Quick reference section
    if (ayceDeals.length > 0 || lakefrontDeals.length > 0) {
      content += `\n---\n\n## Quick Reference\n\n`;
      
      if (ayceDeals.length > 0) {
        content += `**All-You-Can-Eat Options:** ${ayceDeals.map(d => (d.restaurants as any)?.name).join(', ')}\n\n`;
      }
      
      if (lakefrontDeals.length > 0) {
        content += `**Lakefront Dining:** ${lakefrontDeals.map(d => (d.restaurants as any)?.name).join(', ')}\n\n`;
      }
    }

    // Generate summary
    let summary = `${dealCount} curated fish fry picks this week across the Lake Geneva area`;
    if (ayceDeals.length > 0) summary += `, including ${ayceDeals.length} all-you-can-eat option${ayceDeals.length > 1 ? 's' : ''}`;
    if (lakefrontDeals.length > 0) summary += ` and ${lakefrontDeals.length} with lakefront dining`;
    summary += '.';

    // Determine trust labels
    const trustLabels: string[] = ['data_journalism', 'curated'];
    if (dealCount > 0 && verifiedCount === dealCount) {
      trustLabels.push('verified');
    }

    // Insert into content_queue with proper snapshot linkage and week_key
    const { data: queueEntry, error: queueError } = await supabase
      .from('content_queue')
      .insert({
        title,
        content,
        summary,
        category: 'dining',
        status: 'pending',
        source_type: 'data_journalism',
        trust_labels: trustLabels,
        last_updated_at: new Date().toISOString(),
        data_snapshot_id: snapshot?.id,
        metadata: { 
          editorial: { 
            content_type: 'fish_fry_guide', 
            week_key: weekKey, 
            generated_at: now.toISOString(),
            is_regeneration: !!existingGuide,
            quality_gate: {
              included: dealCount,
              excluded: excludedCount,
              verified: verifiedCount
            }
          } 
        }
      })
      .select()
      .single();

    if (queueError) {
      console.error('Error inserting to content_queue:', queueError);
      throw queueError;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'editorial_content_generated',
      entity_type: 'content_queue',
      entity_id: queueEntry?.id,
      message: `Generated feature-grade Fish Fry Guide with ${dealCount} curated picks`,
      details: {
        content_type: 'fish_fry_guide',
        queue_id: queueEntry?.id,
        snapshot_id: snapshot?.id,
        deal_count: dealCount,
        excluded_count: excludedCount,
        verified_count: verifiedCount,
        trust_labels: trustLabels
      }
    });

    return new Response(JSON.stringify({
      success: true,
      queue_id: queueEntry?.id,
      snapshot_id: snapshot?.id,
      title,
      summary,
      deal_count: dealCount,
      excluded_count: excludedCount,
      verified_count: verifiedCount,
      trust_labels: trustLabels
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating editorial content:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});