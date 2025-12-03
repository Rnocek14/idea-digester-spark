import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[full-queue-prep] Starting automated full queue prep...');

    // Step 1: Generate Images in batches
    console.log('[full-queue-prep] Step 1/3: Generating images...');
    let totalImages = 0;
    let hasMore = true;
    const batchSize = 3; // Reduced from 10 to prevent 150s timeout
    
    while (hasMore) {
      const { data: imageData, error: imageError } = await supabase.functions.invoke('bulk-generate-images', {
        body: { limit: batchSize }
      });
      
      if (imageError) {
        console.error('[full-queue-prep] Image generation error:', imageError);
        break;
      }
      
      totalImages += imageData.generated;
      console.log(`[full-queue-prep] Generated ${imageData.generated} images (total: ${totalImages})`);
      hasMore = imageData.generated === batchSize;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Step 2: Generate Voice
    console.log('[full-queue-prep] Step 2/3: Generating voice variants...');
    const { data: voiceData, error: voiceError } = await supabase.functions.invoke('backfill-voice-variants');
    
    if (voiceError) {
      console.error('[full-queue-prep] Voice generation error:', voiceError);
    }
    
    console.log(`[full-queue-prep] Generated voice for ${voiceData?.processed || 0} stories`);

    // Step 3: Prepare Posts
    console.log('[full-queue-prep] Step 3/3: Preparing posts...');
    const { data: postData, error: postError } = await supabase.functions.invoke('prepare-posts');
    
    if (postError) {
      console.error('[full-queue-prep] Post preparation error:', postError);
    }
    
    console.log(`[full-queue-prep] Prepared ${postData?.prepared || 0} posts`);

    // Log activity
    await supabase
      .from('activity_log')
      .insert({
        entity_type: 'system',
        action: 'full_queue_prep_completed',
        actor_type: 'system',
        message: `Automated full queue prep completed: ${totalImages} images, ${voiceData?.processed || 0} voice variants, ${postData?.prepared || 0} posts queued`,
        details: {
          images: totalImages,
          voice: voiceData?.processed || 0,
          posts: postData?.prepared || 0,
          timestamp: new Date().toISOString(),
          mode: 'auto',
        },
      });

    console.log('[full-queue-prep] Full queue prep completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        images: totalImages,
        voice: voiceData?.processed || 0,
        posts: postData?.prepared || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[full-queue-prep] Fatal error:', error);

    // Log failure to activity_log
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseForLog = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabaseForLog
        .from('activity_log')
        .insert({
          entity_type: 'system',
          action: 'full_queue_prep_failed',
          actor_type: 'system',
          message: `Automated full queue prep failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            mode: 'auto',
          },
        });
    } catch (logError) {
      console.error('[full-queue-prep] Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
