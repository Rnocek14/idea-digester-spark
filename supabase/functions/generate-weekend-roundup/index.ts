import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords that indicate civic/government content to EXCLUDE
const CIVIC_KEYWORDS = [
  'municipal', 'committee', 'commission', 'council', 'board', 'court',
  'hearing', 'canceled', 'meeting', 'agenda', 'resolution', 'ordinance',
  'zoning', 'planning', 'budget', 'tax', 'election', 'caucus'
];

interface WeekendEvent {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  publish_date: string | null;
  original_url: string | null;
  metadata: any;
}

interface RoundupResult {
  success: boolean;
  eventsFound: number;
  postsCreated: number;
  postText: string;
  platforms: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate weekend date range (Friday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate days until Friday (5)
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && now.getHours() >= 12) {
      daysUntilFriday = 0;
    } else if (daysUntilFriday === 0) {
      daysUntilFriday = 0;
    }
    
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);

    console.log(`Looking for events between ${friday.toISOString()} and ${sunday.toISOString()}`);

    // Query FUN events only - exclude community (catches civic meetings)
    const { data: events, error: eventsError } = await supabase
      .from('content_queue')
      .select('id, title, summary, category, publish_date, original_url, metadata')
      .in('status', ['approved', 'auto_published', 'published'])
      .eq('safety_level', 'safe')
      .in('category', ['events', 'entertainment', 'dining', 'nightlife'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`Found ${events?.length || 0} total events before filtering`);

    // Filter events:
    // 1. Exclude civic/government content by keyword
    // 2. Check if event date falls within weekend
    const weekendEvents = (events || [])
      .filter((event: WeekendEvent) => {
        // Exclude civic meetings by title keywords
        const titleLower = event.title.toLowerCase();
        const hasCivicKeyword = CIVIC_KEYWORDS.some(keyword => titleLower.includes(keyword));
        if (hasCivicKeyword) {
          console.log(`Excluding civic content: ${event.title}`);
          return false;
        }
        return true;
      })
      .filter((event: WeekendEvent) => {
        // Check if event has actual event date in metadata
        if (event.metadata?.raw_event_date) {
          const eventDate = parseEventDate(event.metadata.raw_event_date);
          if (eventDate) {
            const isWeekend = eventDate >= friday && eventDate <= sunday;
            if (isWeekend) {
              console.log(`Weekend event found: ${event.title} - ${event.metadata.raw_event_date}`);
            }
            return isWeekend;
          }
        }
        
        // Fallback: if category is events/entertainment/dining, include without date check
        // This catches recurring events like "Trivia Night" or "Live Music"
        if (['events', 'entertainment', 'dining', 'nightlife'].includes(event.category || '')) {
          return true;
        }
        
        return false;
      })
      .slice(0, 10);

    console.log(`Found ${weekendEvents.length} weekend events after filtering`);

    // Score and sort events by engagement potential
    const scoredEvents = weekendEvents
      .map((event: WeekendEvent) => ({
        ...event,
        score: scoreEvent(event, friday, sunday)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (scoredEvents.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No fun events found for the weekend roundup (civic meetings excluded)',
        eventsFound: 0,
        postsCreated: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format the weekend roundup post
    const formatEventLine = (event: WeekendEvent): string => {
      const emoji = getCategoryEmoji(event.category);
      const title = event.title.length > 55 ? event.title.substring(0, 52) + '...' : event.title;
      
      // Try to extract time/date info from metadata
      let dateInfo = '';
      if (event.metadata?.raw_event_date) {
        dateInfo = ` - ${formatEventDate(event.metadata.raw_event_date)}`;
      }
      
      return `${emoji} ${title}${dateInfo}`;
    };

    const eventLines = scoredEvents.map((e) => formatEventLine(e));
    
    // Generate post text for different platforms
    const weekendDateRange = `${formatShortDate(friday)} - ${formatShortDate(sunday)}`;
    
    const postTextFacebook = `🎉 THIS WEEKEND IN LAKE GENEVA
${weekendDateRange}

${eventLines.join('\n')}

What are YOU doing this weekend? 👇
#LakeGeneva #WeekendPlans #Wisconsin`;

    const postTextInstagram = `🎉 THIS WEEKEND IN LAKE GENEVA ✨

${eventLines.slice(0, 6).join('\n')}

Save this post for your weekend plans! 📌

#LakeGeneva #WeekendVibes #Wisconsin #LakeLife #ThingsToDoWisconsin`;

    const postTextX = `🎉 This Weekend in Lake Geneva (${weekendDateRange})

${eventLines.slice(0, 5).join('\n')}

What's on your agenda? 👇 #LakeGeneva`;

    // Schedule posts for Thursday 9 AM
    const scheduledFor = getNextThursday9AM();
    
    const platforms = ['facebook', 'x'];
    const postsCreated: string[] = [];

    for (const platform of platforms) {
      const postText = platform === 'facebook' ? postTextFacebook : 
                       platform === 'instagram' ? postTextInstagram : postTextX;

      // Check for existing weekend roundup post for this weekend
      const { data: existing } = await supabase
        .from('post_queue')
        .select('id')
        .eq('platform', platform)
        .gte('scheduled_for', friday.toISOString())
        .ilike('post_text', '%THIS WEEKEND IN LAKE GENEVA%')
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Weekend roundup already exists for ${platform}, skipping`);
        continue;
      }

      // Use first event's id as story_id
      const storyId = scoredEvents[0].id;

      const { error: insertError } = await supabase
        .from('post_queue')
        .insert({
          story_id: storyId,
          platform,
          post_text: postText,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          metadata: {
            type: 'weekend_roundup',
            event_ids: scoredEvents.map(e => e.id),
            date_range: weekendDateRange,
          }
        });

      if (insertError) {
        console.error(`Error creating ${platform} post:`, insertError);
      } else {
        postsCreated.push(platform);
        console.log(`Created weekend roundup for ${platform}`);
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      actor_type: 'system',
      entity_type: 'content',
      action: 'weekend_roundup_generated',
      message: `Generated weekend roundup with ${scoredEvents.length} fun events for ${postsCreated.join(', ')}`,
      details: {
        events_count: scoredEvents.length,
        event_titles: scoredEvents.map(e => e.title),
        platforms: postsCreated,
        date_range: weekendDateRange,
      }
    });

    const result: RoundupResult = {
      success: true,
      eventsFound: scoredEvents.length,
      postsCreated: postsCreated.length,
      postText: postTextFacebook,
      platforms: postsCreated,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating weekend roundup:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Score events by engagement potential (higher = better)
function scoreEvent(event: WeekendEvent, friday: Date, sunday: Date): number {
  let score = 0;
  const titleLower = event.title.toLowerCase();
  
  // Holiday/seasonal events (December priority)
  if (titleLower.includes('christmas') || titleLower.includes('holiday') || 
      titleLower.includes('santa') || titleLower.includes('winter')) {
    score += 30;
  }
  
  // Live music/entertainment
  if (titleLower.includes('live music') || titleLower.includes('concert') || 
      titleLower.includes('music @') || titleLower.includes('band')) {
    score += 25;
  }
  
  // Food & dining experiences
  if (titleLower.includes('dining') || titleLower.includes('brunch') || 
      titleLower.includes('tasting') || titleLower.includes('restaurant')) {
    score += 20;
  }
  
  // Unique experiences
  if (titleLower.includes('igloo') || titleLower.includes('candlelight') || 
      titleLower.includes('tour') || titleLower.includes('cruise')) {
    score += 20;
  }
  
  // Family activities
  if (titleLower.includes('family') || titleLower.includes('kids') || 
      titleLower.includes('children')) {
    score += 15;
  }
  
  // Trivia/games
  if (titleLower.includes('trivia') || titleLower.includes('game')) {
    score += 10;
  }
  
  // Events with actual weekend dates get bonus
  if (event.metadata?.raw_event_date) {
    const eventDate = parseEventDate(event.metadata.raw_event_date);
    if (eventDate && eventDate >= friday && eventDate <= sunday) {
      score += 15;
    }
  }
  
  // Category bonuses
  if (event.category === 'entertainment') score += 10;
  if (event.category === 'events') score += 5;
  if (event.category === 'dining') score += 8;
  if (event.category === 'nightlife') score += 8;
  
  return score;
}

// Parse various date formats to Date object
function parseEventDate(rawDate: string): Date | null {
  try {
    // Handle "All Day" events
    if (rawDate.toLowerCase().includes('all day')) {
      const monthMatch = rawDate.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i);
      if (monthMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.findIndex(m => m.startsWith(monthMatch[1].toLowerCase()));
        const day = parseInt(monthMatch[2]);
        const year = monthMatch[3] ? parseInt(monthMatch[3]) : new Date().getFullYear();
        if (monthIndex >= 0) {
          return new Date(year, monthIndex, day);
        }
      }
    }
    
    // Handle formats like "December 17, 2025, 3:00 PM - 8:30 PM"
    const fullMatch = rawDate.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i);
    if (fullMatch) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.findIndex(m => m.startsWith(fullMatch[1].toLowerCase()));
      const day = parseInt(fullMatch[2]);
      const year = fullMatch[3] ? parseInt(fullMatch[3]) : new Date().getFullYear();
      if (monthIndex >= 0) {
        return new Date(year, monthIndex, day);
      }
    }
    
    // Try direct parsing
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    console.error(`Failed to parse date: ${rawDate}`, e);
  }
  return null;
}

function getCategoryEmoji(category: string | null): string {
  const emojis: Record<string, string> = {
    'events': '🎭',
    'entertainment': '🎵',
    'dining': '🍽️',
    'nightlife': '🌙',
    'sports': '⚽',
    'arts': '🎨',
    'family': '👨‍👩‍👧‍👦',
    'outdoor': '🌲',
    'shopping': '🛍️',
  };
  return emojis[category || ''] || '✨';
}

function formatEventDate(rawDate: string): string {
  // Handle formats like "December 17, 2025, 3:00 PM - 8:30 PM"
  const match = rawDate.match(/(\w+)\s+(\d+).*?(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (match) {
    const month = match[1].substring(0, 3);
    const day = match[2];
    const time = match[3];
    return `${month} ${day} @ ${time}`;
  }
  
  // Handle "All Day" events
  if (rawDate.toLowerCase().includes('all day')) {
    const dateMatch = rawDate.match(/(\w+)\s+(\d+)/i);
    if (dateMatch) {
      return `${dateMatch[1].substring(0, 3)} ${dateMatch[2]}`;
    }
  }
  
  return rawDate.substring(0, 15);
}

function formatShortDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getNextThursday9AM(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  
  if (daysUntilThursday === 0 && now.getHours() >= 9) {
    daysUntilThursday = 7;
  }
  
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + daysUntilThursday);
  thursday.setHours(9, 0, 0, 0);
  
  return thursday;
}
