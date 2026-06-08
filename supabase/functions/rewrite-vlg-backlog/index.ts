import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Finds Visit Lake Geneva (and other dining) content_queue items that haven't
// been rewritten yet (no content_website) and calls transform-voice on them.
// Designed for hourly pg_cron invocation. Small batch per run to stay under
// edge-function CPU limits and avoid OpenAI rate spikes.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let batchSize = 5
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (typeof body.batchSize === 'number') batchSize = Math.min(20, Math.max(1, body.batchSize))
    }
  } catch (_) { /* ignore */ }

  // Pick items that:
  //  - are from visitlakegeneva.com (most common dining source needing rewrite)
  //  - have no content_website yet
  //  - aren't blocked
  //  - are still relevant (not expired)
  const { data: items, error } = await supabase
    .from('content_queue')
    .select('id, title')
    .ilike('original_url', '%visitlakegeneva.com%')
    .is('content_website', null)
    .neq('safety_level', 'blocked')
    .neq('status', 'expired')
    .order('created_at', { ascending: false })
    .limit(batchSize)

  if (error) {
    console.error('[rewrite-vlg-backlog] query error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[rewrite-vlg-backlog] processing ${items?.length ?? 0} items`)

  const results: Array<{ id: string; title: string; ok: boolean; error?: string }> = []
  for (const item of items ?? []) {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transform-voice', {
        body: { mode: 'single', id: item.id },
      })
      if (invokeError) throw invokeError
      results.push({ id: item.id, title: item.title, ok: !!data?.success })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[rewrite-vlg-backlog] failed for ${item.id}:`, msg)
      results.push({ id: item.id, title: item.title, ok: false, error: msg })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})