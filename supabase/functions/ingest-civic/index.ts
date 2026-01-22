import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

interface IngestItem {
  source_id: string;
  title: string;
  content: string;
  summary?: string;
  category?: string;
  original_url?: string;
  publish_date?: string;
  geo_tier?: number;
  geo_label?: string;
  metadata?: Record<string, unknown>;
}

function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = url.toLowerCase().trim();
    // Remove trailing slashes and query params for dedup
    return u.split('?')[0].replace(/\/+$/, '');
  } catch {
    return url?.toLowerCase() || null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate dedicated ingest secret (NOT service role key)
  const ingestSecret = req.headers.get("X-Ingest-Secret");
  const expectedSecret = Deno.env.get("CIVIC_INGEST_SECRET");
  
  if (!expectedSecret) {
    console.error("CIVIC_INGEST_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  if (!ingestSecret || ingestSecret !== expectedSecret) {
    console.warn("Unauthorized ingest attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse incoming items (accepts array or single object)
    const body = await req.json();
    const items: IngestItem[] = Array.isArray(body) ? body : [body];
    
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, skipped: 0, message: "No items to ingest" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Ingesting ${items.length} civic items`);

    // Initialize Supabase with service role (server-side only)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prepare batch payload with normalized URLs
    const batchPayload = items.map(item => ({
      source_id: item.source_id,
      title: item.title,
      content: item.content,
      summary: item.summary || item.content?.substring(0, 300),
      status: 'pending',
      category: item.category || 'civic',
      original_url: item.original_url,
      normalized_url: normalizeUrl(item.original_url),
      publish_date: item.publish_date,
      geo_tier: item.geo_tier ?? 1,
      geo_label: item.geo_label || 'Lake Geneva',
      metadata: {
        ...item.metadata,
        ingested_via: 'n8n-civic',
        ingested_at: new Date().toISOString(),
      },
    }));

    // Batch insert with conflict handling (relies on unique index)
    // Using upsert with ignoreDuplicates for clean dedup
    const { data, error, count } = await supabase
      .from("content_queue")
      .upsert(batchPayload, { 
        onConflict: 'normalized_url',
        ignoreDuplicates: true 
      })
      .select('id');

    if (error) {
      console.error("Batch insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inserted = data?.length || 0;
    const skipped = items.length - inserted;

    console.log(`Ingestion complete: ${inserted} inserted, ${skipped} duplicates skipped`);

    // Log activity
    await supabase.from("activity_log").insert({
      action: "civic_ingest",
      entity_type: "content_queue",
      details: {
        source: "n8n-civic",
        attempted: items.length,
        inserted,
        skipped,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        skipped,
        message: `Ingested ${inserted} items, ${skipped} duplicates skipped`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Ingest error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
