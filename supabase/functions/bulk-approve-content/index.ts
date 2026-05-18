import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdmin(req);
  if (authFail) return authFail;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse query params for dry run
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';

    console.log(`[bulk-approve] Finding pending safe/soft_sensitive content... (dryRun=${dryRun})`);

    // Only fetch PENDING stories (idempotent — never re-touches handled rows)
    // Exclude blocked content entirely — should never be bulk-approved
    const { data: pendingStories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, safety_level, geo_tier, category, reviewed_by')
      .eq('status', 'pending')
      .in('safety_level', ['safe', 'soft_sensitive']);

    if (fetchError) {
      console.error('[bulk-approve] Error fetching stories:', fetchError);
      throw fetchError;
    }

    // Compute hold reason for each story using same decision logic
    function computeHoldReason(s: any): string | null {
      if (s.reviewed_by) return 'manually_reviewed';
      if (s.safety_level === 'safe') return null; // eligible
      if (s.safety_level === 'soft_sensitive' && (s.geo_tier ?? 0) >= 1) return null; // eligible
      if (s.safety_level === 'soft_sensitive' && (s.geo_tier ?? 0) < 1) return 'soft_sensitive_regional';
      return 'not_eligible';
    }

    // Filter: safe always approved, soft_sensitive only if hyperlocal (tier 1/2)
    // Never touch manually reviewed items (reviewed_by is set)
    const eligible = (pendingStories || []).filter(s => computeHoldReason(s) === null);

    const approveIdSet = new Set(eligible.map(s => s.id));
    const approveIds = [...approveIdSet];
    const held = (pendingStories || []).filter(s => !approveIdSet.has(s.id));

    if (dryRun) {
      console.log(`[bulk-approve] DRY RUN: ${approveIds.length} would be approved, ${held.length} held`);
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          wouldApprove: approveIds.length,
          wouldHold: held.length,
          eligible: eligible.map(s => ({ id: s.id, title: s.title, safety_level: s.safety_level, geo_tier: s.geo_tier, decision_path: 'bulk_auto_publish' })),
          held: held.map(s => ({ 
            id: s.id, 
            title: s.title, 
            safety_level: s.safety_level, 
            geo_tier: s.geo_tier,
            reason: computeHoldReason(s) || 'not_eligible'
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (approveIds.length === 0) {
      console.log('[bulk-approve] No eligible stories found');
      return new Response(
        JSON.stringify({ success: true, approved: 0, held: held.length, message: 'No eligible stories to approve' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[bulk-approve] Approving ${approveIds.length} stories, holding ${held.length}`);

    // Update eligible to auto_published with audit trail
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({ status: 'auto_published', decision_path: 'bulk_auto_publish', hold_reason: null })
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
      details: { count: approveIds.length, held: held.length, story_ids: approveIds }
    });

    console.log(`[bulk-approve] Successfully approved ${approveIds.length} stories`);

    return new Response(
      JSON.stringify({
        success: true,
        approved: approveIds.length,
        held: held.length,
        total_checked: pendingStories?.length || 0,
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
