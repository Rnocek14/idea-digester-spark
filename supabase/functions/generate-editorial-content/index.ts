import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
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
    
    // Create data snapshot
    const snapshotSummary = {
      total_deals: dealCount,
      verified_deals: verifiedCount,
      restaurants: fishFryDeals?.map(d => {
        const restaurant = d.restaurants as unknown as { name: string; city: string; cuisine_type: string } | null;
        return {
          name: restaurant?.name,
          city: restaurant?.city,
          price: d.price,
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

    // Build the article content from data (no hallucination)
    const fridayDeals = fishFryDeals?.filter(d => d.days?.includes('friday') || d.days?.includes('Friday')) || [];
    const ayceDeals = fishFryDeals?.filter(d => d.all_you_can_eat) || [];
    
    // Format restaurant listings
    const formatDeal = (deal: any) => {
      const restaurant = deal.restaurants as unknown as { name: string; city: string; cuisine_type: string } | null;
      const parts = [];
      parts.push(`**${restaurant?.name}**`);
      if (restaurant?.city) parts.push(` (${restaurant.city})`);
      parts.push(': ');
      if (deal.price) parts.push(`$${deal.price}`);
      if (deal.fish_type) parts.push(` - ${deal.fish_type}`);
      if (deal.all_you_can_eat) parts.push(' (AYCE)');
      if (deal.verification_status === 'verified') parts.push(' ✓');
      return parts.join('');
    };

    // Generate structured article (no AI needed for basic format)
    const title = `This Week's Fish Fry Guide: ${dealCount} Options in Lake Geneva`;
    
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
                content: `Write a 2-sentence summary for this week's fish fry guide. Data: ${dealCount} total options, ${verifiedCount} verified, ${ayceDeals.length} AYCE options, ${fridayDeals.length} Friday specials. Price range: ${fishFryDeals?.map(d => d.price).filter(Boolean).sort((a,b) => a-b).join(', ') || 'varies'}.`
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

    // Determine trust labels
    const trustLabels = [];
    if (verifiedCount > dealCount * 0.5) {
      trustLabels.push('verified');
    }
    trustLabels.push('data_journalism'); // Always for this content type

    // Insert into content_queue
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
        // Link to snapshot via metadata or a future column
        raw_content: JSON.stringify({ 
          snapshot_id: snapshot?.id,
          generated_at: new Date().toISOString(),
          deal_count: dealCount,
          verified_count: verifiedCount
        })
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
