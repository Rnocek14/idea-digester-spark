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

    console.log('[backfill-voice-variants] Starting backfill...');

    // Find stories with images but no voice variants
    const { data: stories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, image_url, content_instagram, content_facebook, content_x')
      .not('image_url', 'is', null)
      .or('content_instagram.is.null,content_facebook.is.null,content_x.is.null')
      .limit(50);

    if (fetchError) {
      console.error('[backfill-voice-variants] Error fetching stories:', fetchError);
      throw fetchError;
    }

    if (!stories || stories.length === 0) {
      console.log('[backfill-voice-variants] No stories need voice generation');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No stories need voice generation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-voice-variants] Found ${stories.length} stories needing voice generation`);

    let successCount = 0;
    let errorCount = 0;

    // Process each story
    for (const story of stories) {
      try {
        console.log(`[backfill-voice-variants] Generating voice for story: ${story.title}`);
        
        // Call transform-voice edge function
        const { error: voiceError } = await supabase.functions.invoke('transform-voice', {
          body: { id: story.id, mode: 'auto' },
        });

        if (voiceError) {
          console.error(`[backfill-voice-variants] Error generating voice for ${story.id}:`, voiceError);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`[backfill-voice-variants] Exception for ${story.id}:`, err);
        errorCount++;
      }
    }

    console.log(`[backfill-voice-variants] Complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        errors: errorCount,
        total: stories.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[backfill-voice-variants] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
