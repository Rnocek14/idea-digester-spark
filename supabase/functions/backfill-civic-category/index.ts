import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Civic keywords to detect city council, committee, municipal content
const CIVIC_KEYWORDS = [
  'city council', 'common council', 'town board', 'village board', 'county board',
  'committee', 'commission', 'municipal', 'ordinance', 'resolution',
  'public hearing', 'city hall', 'town hall', 'village hall',
  'board of trustees', 'board meeting', 'alderman', 'aldermen', 'alderperson',
  'mayor', 'city administrator', 'city manager', 'village administrator',
  'zoning', 'planning commission', 'plan commission', 'historic preservation',
  'parks committee', 'finance committee', 'public works committee',
  'police commission', 'fire commission', 'library board',
  'school board', 'board of education', 'referendum',
  'tax levy', 'budget hearing', 'annual meeting', 'special meeting',
  'executive session', 'closed session', 'open session',
  'public comment', 'citizen comment', 'minutes approval',
  'city of lake geneva', 'town of linn', 'village of fontana', 'village of williams bay',
  'walworth county', 'walworth county board'
];

function isCivicContent(title: string, content: string): boolean {
  const text = `${title || ''} ${content || ''}`.toLowerCase();
  return CIVIC_KEYWORDS.some(keyword => text.includes(keyword));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all stories that are NOT already civic
    const { data: stories, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, title, content, category')
      .neq('category', 'civic');

    if (fetchError) throw fetchError;

    console.log(`📋 Checking ${stories?.length || 0} stories for civic content`);

    let updated = 0;
    let skipped = 0;
    const updatedStories: string[] = [];

    for (const story of stories || []) {
      if (isCivicContent(story.title, story.content)) {
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ category: 'civic' })
          .eq('id', story.id);

        if (updateError) {
          console.error(`❌ Failed to update ${story.id}: ${updateError.message}`);
        } else {
          updated++;
          updatedStories.push(story.title.substring(0, 50));
          console.log(`🏛️ Updated to civic: "${story.title.substring(0, 50)}..."`);
        }
      } else {
        skipped++;
      }
    }

    const result = {
      success: true,
      totalChecked: stories?.length || 0,
      updated,
      skipped,
      updatedStories: updatedStories.slice(0, 20), // First 20 for preview
    };

    console.log(`✅ Backfill complete: ${updated} stories updated to civic category`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
