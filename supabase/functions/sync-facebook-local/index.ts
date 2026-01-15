import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= FACEBOOK SOURCE CONFIGURATION =============

interface FBSource {
  name: string;
  url: string;
  geo_tier: number;
  city?: string;
}

interface FBSources {
  [category: string]: FBSource[];
}

const FB_SOURCES: FBSources = {
  // FIRE DEPARTMENTS (→ incidents table)
  fire: [
    { name: "Lake Geneva Fire Dept", url: "facebook.com/CityOfLakeGenevaFireDepartment", geo_tier: 1, city: "Lake Geneva" },
    { name: "Fontana Fire & Rescue", url: "facebook.com/FontanaFireRescue", geo_tier: 1, city: "Fontana" },
    { name: "Town of Linn Fire", url: "facebook.com/TownOfLinnFire", geo_tier: 1, city: "Linn" },
    { name: "Delavan Fire Dept", url: "facebook.com/DelavanFire", geo_tier: 2, city: "Delavan" },
    { name: "Walworth Fire Dept", url: "facebook.com/WalworthFireRescue", geo_tier: 2, city: "Walworth" },
    { name: "Elkhorn Fire Dept", url: "facebook.com/ElkhornAreaFireDept", geo_tier: 2, city: "Elkhorn" },
  ],

  // MUNICIPAL GOVERNMENTS (→ content_queue)
  municipal: [
    { name: "City of Lake Geneva", url: "facebook.com/CityofLakeGenevaWI", geo_tier: 1, city: "Lake Geneva" },
    { name: "Village of Fontana", url: "facebook.com/VillageOfFontanaOnGenevaLake", geo_tier: 1, city: "Fontana" },
    { name: "Village of Williams Bay", url: "facebook.com/WilliamsBayWI", geo_tier: 1, city: "Williams Bay" },
    { name: "Town of Linn", url: "facebook.com/TownOfLinnWI", geo_tier: 1, city: "Linn" },
    { name: "Walworth County", url: "facebook.com/WalworthCountyWI", geo_tier: 2, city: "Elkhorn" },
  ],

  // SCHOOLS (→ content_queue + incidents for closures)
  schools: [
    { name: "Lake Geneva Schools", url: "facebook.com/LakeGenevaSchools", geo_tier: 1, city: "Lake Geneva" },
    { name: "Badger High School", url: "facebook.com/BadgerHighSchoolLG", geo_tier: 1, city: "Lake Geneva" },
    { name: "Williams Bay School District", url: "facebook.com/WilliamsBaySchools", geo_tier: 1, city: "Williams Bay" },
    { name: "Fontana School", url: "facebook.com/FontanaElementary", geo_tier: 1, city: "Fontana" },
  ],

  // TOURISM & CHAMBERS (→ content_queue)
  tourism: [
    { name: "Visit Lake Geneva", url: "facebook.com/VisitLakeGeneva", geo_tier: 1, city: "Lake Geneva" },
    { name: "Downtown Lake Geneva", url: "facebook.com/DowntownLakeGeneva", geo_tier: 1, city: "Lake Geneva" },
    { name: "Geneva Lake West Chamber", url: "facebook.com/GenevaLakeWestChamber", geo_tier: 1, city: "Fontana" },
    { name: "Lake Geneva Jaycees", url: "facebook.com/LakeGenevaJaycees", geo_tier: 1, city: "Lake Geneva" },
  ],

  // COMMUNITY GROUPS (→ content_queue)
  community: [
    { name: "Lake Geneva Now", url: "facebook.com/LakeGenevaNow", geo_tier: 1, city: "Lake Geneva" },
    { name: "Geneva Lake Report", url: "facebook.com/GenevaLakeReport", geo_tier: 1, city: "Lake Geneva" },
    { name: "Walworth County Scanner", url: "facebook.com/WalworthCountyScanner", geo_tier: 2, city: "Walworth County" },
  ],

  // NIGHTLIFE VENUES (→ content_queue with events category)
  nightlife: [
    { name: "Fat Cat", url: "facebook.com/fatcatslg", geo_tier: 1, city: "Lake Geneva" },
    { name: "Chuck's Lakeshore Inn", url: "facebook.com/ChucksLakeshoreInn", geo_tier: 1, city: "Lake Geneva" },
    { name: "DJs in the Drink", url: "facebook.com/inthedrink.lakecomo", geo_tier: 1, city: "Lake Como" },
    { name: "House of Music", url: "facebook.com/lghouseofmusic", geo_tier: 1, city: "Lake Geneva" },
    { name: "Topsy Turvy Brewery", url: "facebook.com/topsyturvybrewery", geo_tier: 1, city: "Lake Geneva" },
    { name: "Harpoon Willie's", url: "facebook.com/HarpoonWillies", geo_tier: 1, city: "Williams Bay" },
    { name: "Gordy's Boat House", url: "facebook.com/GordysBoatHouse", geo_tier: 1, city: "Fontana" },
    { name: "Pier 290", url: "facebook.com/Pier290", geo_tier: 1, city: "Williams Bay" },
    { name: "Geneva Tap House", url: "facebook.com/GenevaTapHouse", geo_tier: 1, city: "Lake Geneva" },
    { name: "Grand Geneva Resort", url: "facebook.com/GrandGeneva", geo_tier: 1, city: "Lake Geneva" },
    { name: "Abbey Resort", url: "facebook.com/TheAbbeyResort", geo_tier: 1, city: "Fontana" },
    { name: "Crafted Americana", url: "facebook.com/CraftedLG", geo_tier: 1, city: "Lake Geneva" },
    { name: "Lake City Social", url: "facebook.com/LakeCitySocialWI", geo_tier: 1, city: "Lake Geneva" },
    { name: "Thumbs Up Pub", url: "facebook.com/ThumbsUpPub", geo_tier: 1, city: "Lake Geneva" },
  ],
};

// ============= EXTRACTION SCHEMA FOR OPENAI =============

const FB_EXTRACTION_SCHEMA = {
  system: `You are an expert at extracting structured information from Facebook page content for Lake Geneva, Wisconsin area.
Extract ALL posts that contain events, incidents, alerts, or newsworthy content. Be thorough - extract multiple items if present.
Focus on recent content (last week). Ignore old posts, ads, and generic promotional content.
For fire/EMS pages, look for call responses, incidents, safety alerts.
For schools, look for closures, delays, events, announcements.
For venues, look for live music events, entertainment schedules.`,
  tool: {
    name: "extract_facebook_posts",
    description: "Extract structured posts from Facebook page content",
    parameters: {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              post_type: { 
                type: "string", 
                enum: ["event", "incident", "alert", "news", "announcement", "closure"],
                description: "Type of post content"
              },
              title: { 
                type: "string",
                description: "Concise title (under 80 chars)"
              },
              description: { 
                type: "string",
                description: "Full description or summary (under 300 chars)"
              },
              event_date: { 
                type: "string", 
                description: "YYYY-MM-DD format if applicable" 
              },
              event_time: { 
                type: "string", 
                description: "HH:MM format (24-hour)" 
              },
              performer: { 
                type: "string", 
                description: "Artist/band name for music events" 
              },
              location: { 
                type: "string",
                description: "Street address or venue name"
              },
              incident_type: { 
                type: "string", 
                enum: ["fire", "accident", "crime", "ems", "road_closure", "utility", "weather", "school_closure", "none"],
                description: "Type of incident if applicable"
              },
              is_urgent: { 
                type: "boolean",
                description: "Is this time-sensitive or breaking news?"
              },
              is_closure: {
                type: "boolean",
                description: "Is this a school closure or delay?"
              },
            },
            required: ["post_type", "title", "description"]
          }
        }
      },
      required: ["posts"]
    }
  }
};

// ============= USER AGENTS FOR ANTI-BOT EVASION =============

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

// ============= CONTENT FETCHING =============

async function fetchContent(
  url: string,
  firecrawlKey: string | undefined
): Promise<{ content: string; usedFirecrawl: boolean }> {
  
  // Try static fetch first (likely won't work for FB, but worth a shot)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const html = await res.text();
      if (html.length >= 2000 && !html.includes('login_form')) {
        return { content: html, usedFirecrawl: false };
      }
    }
  } catch (e) {
    console.log(`Static fetch failed for ${url}, trying Firecrawl`);
  }

  // Firecrawl fallback (required for Facebook)
  if (!firecrawlKey) {
    throw new Error('FIRECRAWL_API_KEY required for Facebook scraping');
  }

  console.log(`Using Firecrawl for: ${url}`);
  const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 3000,
      timeout: 30000,
    }),
  });

  if (!fcRes.ok) {
    const errText = await fcRes.text();
    throw new Error(`Firecrawl error: ${fcRes.status} - ${errText.slice(0, 200)}`);
  }

  const data = await fcRes.json();
  const markdown = data.data?.markdown || data.markdown || '';
  
  if (!markdown || markdown.length < 100) {
    throw new Error('No content extracted from page');
  }

  return { content: markdown, usedFirecrawl: true };
}

// ============= AI EXTRACTION =============

async function extractWithAI(
  content: string,
  sourceName: string,
  category: string
): Promise<{ posts: any[] }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  
  const apiKey = openaiKey || lovableKey;
  const apiUrl = openaiKey 
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
  
  if (!apiKey) {
    throw new Error('No AI API key configured (OPENAI_API_KEY or LOVABLE_API_KEY)');
  }

  // Add category-specific context to the prompt
  let categoryContext = '';
  switch (category) {
    case 'fire':
      categoryContext = 'This is a fire department page. Look for fire calls, EMS responses, rescue operations, safety alerts.';
      break;
    case 'schools':
      categoryContext = 'This is a school page. Look for closures, delays, events, sports, announcements. School closures are HIGH PRIORITY.';
      break;
    case 'nightlife':
      categoryContext = 'This is a bar/venue page. Look for live music events, performers, entertainment schedules, special events.';
      break;
    case 'municipal':
      categoryContext = 'This is a government page. Look for public notices, road closures, meetings, community announcements.';
      break;
    case 'tourism':
      categoryContext = 'This is a tourism/chamber page. Look for community events, festivals, promotions.';
      break;
    case 'community':
      categoryContext = 'This is a community page. Look for local incidents, events, happenings, scanner reports.';
      break;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiKey ? 'gpt-4o-mini' : 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: FB_EXTRACTION_SCHEMA.system },
        { 
          role: 'user', 
          content: `Extract posts from this ${sourceName} Facebook page content.\n\nCategory context: ${categoryContext}\n\nContent:\n${content.substring(0, 12000)}` 
        },
      ],
      tools: [{ type: 'function', function: FB_EXTRACTION_SCHEMA.tool }],
      tool_choice: { type: 'function', function: { name: 'extract_facebook_posts' } },
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    console.log('No extraction result from AI');
    return { posts: [] };
  }

  return JSON.parse(toolCall.function.arguments);
}

// ============= INCIDENT TYPE MAPPING =============

function mapIncidentType(type: string): string {
  const mapping: Record<string, string> = {
    'fire': 'fire',
    'accident': 'accident',
    'crime': 'crime',
    'ems': 'accident',
    'road_closure': 'road_closure',
    'utility': 'other',
    'weather': 'weather',
    'school_closure': 'other',
    'none': 'other',
  };
  return mapping[type] || 'other';
}

// ============= DEDUPLICATION UTILITIES =============

function generateSlug(text: string, sourceUrl: string): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const slug = `fb-${text.substring(0, 40)}-${dateStr}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug;
}

// Generate a content hash for cross-system deduplication
function generateContentHash(title: string, date?: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);
  return date ? `${normalized}-${date}` : normalized;
}

// Check if title is too similar to existing content (fuzzy match)
function isTitleSimilar(newTitle: string, existingTitle: string, threshold = 0.8): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const a = normalize(newTitle);
  const b = normalize(existingTitle);
  
  // Exact prefix match
  if (a.startsWith(b.substring(0, 30)) || b.startsWith(a.substring(0, 30))) {
    return true;
  }
  
  // Word overlap check
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  const similarity = overlap / Math.min(wordsA.size, wordsB.size);
  return similarity >= threshold;
}

// ============= PROCESS EXTRACTED POSTS =============

async function processExtractedPosts(
  posts: any[],
  source: FBSource,
  category: string,
  supabase: any
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // CROSS-SYSTEM DEDUP: Load recent titles from both tables (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const [{ data: recentContent }, { data: recentIncidents }] = await Promise.all([
    supabase
      .from('content_queue')
      .select('title, normalized_url')
      .gte('created_at', sevenDaysAgo)
      .in('status', ['pending', 'approved', 'auto_published', 'published']),
    supabase
      .from('incidents')
      .select('title, slug')
      .gte('started_at', sevenDaysAgo)
  ]);

  const existingContentTitles = new Set((recentContent || []).map((c: any) => c.title.toLowerCase()));
  const existingContentSlugs = new Set((recentContent || []).map((c: any) => c.normalized_url));
  const existingIncidentTitles = new Set((recentIncidents || []).map((i: any) => i.title.toLowerCase()));
  const existingIncidentSlugs = new Set((recentIncidents || []).map((i: any) => i.slug));

  console.log(`  Cross-system dedup: ${existingContentTitles.size} content, ${existingIncidentTitles.size} incidents loaded`);

  for (const post of posts) {
    try {
      const slug = generateSlug(post.title, source.url);
      const titleLower = post.title.toLowerCase();
      
      // DEDUP CHECK 1: Exact slug match in content_queue
      if (existingContentSlugs.has(slug)) {
        console.log(`  ⏭️ Skipping (slug exists): ${post.title.substring(0, 40)}`);
        skipped++;
        continue;
      }

      // DEDUP CHECK 2: Exact title match across both systems
      if (existingContentTitles.has(titleLower) || existingIncidentTitles.has(titleLower)) {
        console.log(`  ⏭️ Skipping (title exists): ${post.title.substring(0, 40)}`);
        skipped++;
        continue;
      }

      // DEDUP CHECK 3: Fuzzy title similarity check
      let isSimilar = false;
      const allExistingTitles = [...Array.from(existingContentTitles), ...Array.from(existingIncidentTitles)] as string[];
      for (const existingTitle of allExistingTitles) {
        if (isTitleSimilar(post.title, existingTitle, 0.75)) {
          console.log(`  ⏭️ Skipping (similar to "${existingTitle.substring(0, 30)}"): ${post.title.substring(0, 40)}`);
          isSimilar = true;
          break;
        }
      }
      if (isSimilar) {
        skipped++;
        continue;
      }

      // FIRE/EMS: Insert into incidents table
      if (category === 'fire' && post.incident_type && post.incident_type !== 'none') {
        const incidentSlug = `incident-${slug}`;
        
        if (existingIncidentSlugs.has(incidentSlug)) {
          skipped++;
          continue;
        }

        const { error: incidentError } = await supabase
          .from('incidents')
          .insert({
            title: post.title,
            slug: incidentSlug,
            incident_type: mapIncidentType(post.incident_type),
            location: post.location || source.city,
            source: `facebook:${source.name}`,
            status: post.is_urgent ? 'active' : 'monitoring',
            priority_score: post.is_urgent ? 80 : 50,
            started_at: new Date().toISOString(),
          });

        if (!incidentError) {
          console.log(`  ✅ Incident: ${post.title}`);
          inserted++;
          existingIncidentTitles.add(titleLower);
          existingIncidentSlugs.add(incidentSlug);
        } else {
          console.error(`  ❌ Incident error: ${incidentError.message}`);
        }
        continue;
      }

      // SCHOOLS: Create incident for closures/delays
      if (category === 'schools' && (post.is_closure || post.incident_type === 'school_closure')) {
        const closureSlug = `closure-${slug}`;
        
        if (!existingIncidentSlugs.has(closureSlug)) {
          await supabase.from('incidents').insert({
            title: `School Alert: ${post.title}`,
            slug: closureSlug,
            incident_type: 'other',
            sub_type: 'school_closure',
            location: source.city,
            source: `facebook:${source.name}`,
            status: 'active',
            priority_score: 90,
            started_at: new Date().toISOString(),
          });
          console.log(`  ✅ School closure: ${post.title}`);
          existingIncidentSlugs.add(closureSlug);
        }
      }

      // Determine category for content_queue
      let contentCategory = 'community';
      if (category === 'nightlife' || post.post_type === 'event') {
        contentCategory = 'events';
      } else if (category === 'schools') {
        contentCategory = 'schools';
      } else if (category === 'municipal') {
        contentCategory = 'civic';
      } else if (post.post_type === 'incident' || post.post_type === 'alert') {
        contentCategory = 'news';
      }

      // Insert into content_queue
      const { error: insertError } = await supabase
        .from('content_queue')
        .insert({
          title: post.title,
          content: post.description,
          summary: post.description?.substring(0, 200),
          category: contentCategory,
          status: 'pending',
          safety_level: 'safe',
          original_url: `https://www.${source.url}`,
          normalized_url: slug,
          event_date: post.event_date || null,
          event_time: post.event_time || null,
          performer: post.performer || null,
          geo_tier: source.geo_tier,
          geo_label: source.city,
          source_type: 'facebook',
          is_breaking: post.is_urgent || false,
          metadata: {
            fb_source: source.url,
            fb_category: category,
            post_type: post.post_type,
            verticals: [category],
          },
        });

      if (insertError) {
        console.error(`  ❌ Insert error: ${insertError.message}`);
      } else {
        console.log(`  ✅ Content: ${post.title}`);
        inserted++;
        existingContentTitles.add(titleLower);
        existingContentSlugs.add(slug);
      }
    } catch (err) {
      console.error(`  ❌ Error processing: ${err}`);
    }
  }

  return { inserted, skipped };
}

// ============= MAIN HANDLER =============

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    // Parse request options
    let options: { categories?: string[]; source_name?: string; limit?: number } = {};
    try {
      options = await req.json();
    } catch {
      // Default: process all categories
    }

    const categoriesToProcess = options.categories || Object.keys(FB_SOURCES);
    const sourceLimit = options.limit || 50;

    console.log(`Processing categories: ${categoriesToProcess.join(', ')}`);

    const results: Array<{
      source: string;
      category: string;
      posts_found: number;
      inserted: number;
      error?: string;
    }> = [];
    
    let totalInserted = 0;
    let sourcesProcessed = 0;

    for (const category of categoriesToProcess) {
      const sources = FB_SOURCES[category];
      if (!sources) continue;

      for (const source of sources) {
        // Check source limit
        if (sourcesProcessed >= sourceLimit) break;

        // Filter by source_name if specified
        if (options.source_name && !source.name.toLowerCase().includes(options.source_name.toLowerCase())) {
          continue;
        }

        console.log(`\n📘 Scraping: ${source.name} (${category})`);
        sourcesProcessed++;

        try {
          // Fetch content
          const { content, usedFirecrawl } = await fetchContent(
            `https://www.${source.url}`,
            firecrawlKey
          );
          console.log(`  Fetched ${content.length} chars (firecrawl: ${usedFirecrawl})`);

          // Extract with AI
          const extracted = await extractWithAI(content, source.name, category);
          console.log(`  AI extracted ${extracted.posts?.length || 0} posts`);

          // Process posts
          const { inserted, skipped } = await processExtractedPosts(
            extracted.posts || [],
            source,
            category,
            supabase
          );

          results.push({
            source: source.name,
            category,
            posts_found: extracted.posts?.length || 0,
            inserted,
          });

          totalInserted += inserted;

          // Rate limiting delay between sources
          await new Promise(r => setTimeout(r, 1500));

        } catch (err) {
          console.error(`  ❌ Error: ${err}`);
          results.push({
            source: source.name,
            category,
            posts_found: 0,
            inserted: 0,
            error: String(err).substring(0, 100),
          });
        }
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'source',
      action: 'facebook_local_sync',
      actor_type: 'system',
      message: `Facebook local sync: ${totalInserted} items from ${sourcesProcessed} sources`,
      details: { 
        categories: categoriesToProcess,
        results_summary: results.slice(0, 20),
        totalInserted,
        sourcesProcessed,
      },
    });

    console.log(`\n✅ Complete: ${totalInserted} items inserted from ${sourcesProcessed} sources`);

    return new Response(
      JSON.stringify({
        success: true,
        totalInserted,
        sourcesProcessed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
