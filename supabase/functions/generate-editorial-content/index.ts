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
    
    // Check admin JWT
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      
      if (!claimsError && claimsData?.claims?.sub) {
        // Check if user is admin
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', claimsData.claims.sub)
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
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { content_type = 'fish_fry_guide' } = await req.json().catch(() => ({}));

    // Phase 3: Only fish_fry_guide is implemented
    if (content_type !== 'fish_fry_guide') {
      return new Response(JSON.stringify({ 
        error: 'Only fish_fry_guide is currently supported' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch verified fish fry data
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
        restaurants!inner(name, city, cuisine_type)
      `)
      .eq('deal_type', 'fish_fry')
      .gte('confidence_score', 0.7)
      .order('last_seen_at', { ascending: false });

    if (dealsError) {
      console.error('Error fetching fish fry deals:', dealsError);
      throw dealsError;
    }

    const dealCount = fishFryDeals?.length || 0;
    const verifiedCount = fishFryDeals?.filter(d => d.verification_status === 'verified').length || 0;
    
    // Parse prices safely - strip $ and parse as number
    const parsePrice = (price: unknown): number | null => {
      if (price === null || price === undefined) return null;
      const str = String(price).replace(/[$,]/g, '').trim();
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    };
    
    const prices = fishFryDeals?.map(d => parsePrice(d.price)).filter((p): p is number => p !== null) || [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
    
    // Create data snapshot
    const snapshotSummary = {
      total_deals: dealCount,
      verified_deals: verifiedCount,
      price_range: { min: minPrice, max: maxPrice },
      restaurants: fishFryDeals?.map(d => {
        const restaurant = d.restaurants as unknown as { name: string; city: string; cuisine_type: string } | null;
        return {
          name: restaurant?.name,
          city: restaurant?.city,
          price: parsePrice(d.price),
          fish_type: d.fish_type,
          ayce: d.all_you_can_eat,
          days: d.days,
          verified: d.verification_status === 'verified'
        };
      }) || []
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

    // Filter Friday deals (case-insensitive, handles 'fri', 'friday', 'Friday', etc.)
    const isFridayDeal = (days: unknown): boolean => {
      if (!days) return false;
      const daysStr = Array.isArray(days) ? days.join(' ') : String(days);
      return daysStr.toLowerCase().includes('fri');
    };
    
    const fridayDeals = fishFryDeals?.filter(d => isFridayDeal(d.days)) || [];
    const ayceDeals = fishFryDeals?.filter(d => d.all_you_can_eat) || [];
    
    // Format restaurant listings
    const formatDeal = (deal: any) => {
      const restaurant = deal.restaurants as unknown as { name: string; city: string; cuisine_type: string } | null;
      const parts = [];
      parts.push(`**${restaurant?.name}**`);
      if (restaurant?.city) parts.push(` (${restaurant.city})`);
      parts.push(': ');
      
      // Format price safely
      const price = parsePrice(deal.price);
      if (price !== null) parts.push(`$${price.toFixed(2)}`);
      
      if (deal.fish_type) parts.push(` - ${deal.fish_type}`);
      if (deal.all_you_can_eat) parts.push(' (AYCE)');
      if (deal.verification_status === 'verified') parts.push(' ✓');
      return parts.join('');
    };

    // Generate structured article (no AI needed for basic format)
    const title = `This Week's Fish Fry Guide: ${dealCount} Options in the Lake Geneva Area`;
    
    let content = `# ${title}\n\n`;
    content += `*Based on ${verifiedCount} verified listings from Lake Geneva Eats data.*\n\n`;
    
    if (fridayDeals.length > 0) {
      content += `## Friday Fish Fry Specials\n\n`;
      fridayDeals.forEach(deal => {
        content += `- ${formatDeal(deal)}\n`;
      });
      content += '\n';
    }

    if (ayceDeals.length > 0) {
      content += `## All-You-Can-Eat Options\n\n`;
      ayceDeals.forEach(deal => {
        content += `- ${formatDeal(deal)}\n`;
      });
      content += '\n';
    }

    // Generate AI summary only if we have the API key
    let summary = `${dealCount} fish fry options this week across the Lake Geneva area, including ${ayceDeals.length} all-you-can-eat specials.`;
    
    if (lovableApiKey && dealCount > 0) {
      try {
        // Build clean price range string
        let priceRangeStr = 'varies';
        if (minPrice !== null && maxPrice !== null) {
          priceRangeStr = minPrice === maxPrice 
            ? `$${minPrice.toFixed(2)}` 
            : `$${minPrice.toFixed(2)} to $${maxPrice.toFixed(2)}`;
        }
        
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
                content: `You are a local food writer for Lake Geneva. Write a 2-sentence summary for a fish fry guide article. Be warm and inviting. Only mention facts from the data provided. Do not invent any restaurants, prices, or details.`
              },
              {
                role: 'user',
                content: `Write a 2-sentence summary for this week's fish fry guide. Data: ${dealCount} total options, ${verifiedCount} verified, ${ayceDeals.length} AYCE options, ${fridayDeals.length} Friday specials. Price range: ${priceRangeStr}.`
              }
            ],
            max_tokens: 150,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          summary = aiData.choices?.[0]?.message?.content || summary;
        }
      } catch (aiError) {
        console.error('AI summary generation failed, using default:', aiError);
      }
    }

    // Determine trust labels - only "verified" if ALL items are verified
    const trustLabels: string[] = ['data_journalism'];
    if (dealCount > 0 && verifiedCount === dealCount) {
      trustLabels.push('verified');
    }

    // Insert into content_queue with proper snapshot linkage
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
        data_snapshot_id: snapshot?.id, // Proper FK linkage
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
      details: {
        content_type: 'fish_fry_guide',
        queue_id: queueEntry?.id,
        snapshot_id: snapshot?.id,
        deal_count: dealCount,
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
