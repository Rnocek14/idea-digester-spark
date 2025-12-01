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

    // Find all pending stories that are safe
    const { data: pendingStories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title')
      .eq('status', 'pending')
      .eq('safety_level', 'safe');

    if (fetchError) {
      console.error('[bulk-approve] Error fetching stories:', fetchError);
      throw fetchError;
    }

    if (!pendingStories || pendingStories.length === 0) {
      console.log('[bulk-approve] No pending safe stories found');
      return new Response(
        JSON.stringify({ success: true, approved: 0, message: 'No pending safe stories to approve' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[bulk-approve] Found ${pendingStories.length} pending safe stories`);

    // Update all to auto_published
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({ status: 'auto_published' })
      .eq('status', 'pending')
      .eq('safety_level', 'safe');

    if (updateError) {
      console.error('[bulk-approve] Error updating stories:', updateError);
      throw updateError;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'content',
      action: 'bulk_approved',
      actor_type: 'system',
      message: `Bulk approved ${pendingStories.length} safe stories`,
      details: { count: pendingStories.length, story_ids: pendingStories.map(s => s.id) }
    });

    console.log(`[bulk-approve] Successfully approved ${pendingStories.length} stories`);

    return new Response(
      JSON.stringify({
        success: true,
        approved: pendingStories.length,
        stories: pendingStories
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
