import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[bulk-approve] Finding pending safe content...');

    // Find all pending stories that are safe or soft_sensitive (with geo-tier awareness)
    const { data: pendingStories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, safety_level, geo_tier')
      .eq('status', 'pending')
      .in('safety_level', ['safe', 'soft_sensitive']);

    if (fetchError) {
      console.error('[bulk-approve] Error fetching stories:', fetchError);
      throw fetchError;
    }

    // Filter: safe always approved, soft_sensitive only if hyperlocal (tier 1/2)
    const approveIds = (pendingStories || [])
      .filter(s => s.safety_level === 'safe' || (s.safety_level === 'soft_sensitive' && (s.geo_tier ?? 0) >= 1))
      .map(s => s.id);

    if (approveIds.length === 0) {
      console.log('[bulk-approve] No eligible stories found');
      return new Response(
        JSON.stringify({ success: true, approved: 0, message: 'No eligible stories to approve' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[bulk-approve] Found ${approveIds.length} eligible stories (of ${pendingStories?.length || 0} pending safe/soft_sensitive)`);

    // Update eligible to auto_published
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({ status: 'auto_published' })
      .in('id', approveIds);

    if (updateError) {
      console.error('[bulk-approve] Error updating stories:', updateError);
      throw updateError;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'content',
      action: 'bulk_approved',
      actor_type: 'system',
      message: `Bulk approved ${approveIds.length} eligible stories (safe + soft_sensitive hyperlocal)`,
      details: { count: approveIds.length, story_ids: approveIds }
    });

    console.log(`[bulk-approve] Successfully approved ${approveIds.length} stories`);

    return new Response(
      JSON.stringify({
        success: true,
        approved: approveIds.length,
        total_eligible: pendingStories?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[bulk-approve] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
