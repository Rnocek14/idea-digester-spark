import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      // If it's Friday afternoon, look at this weekend
      daysUntilFriday = 0;
    } else if (daysUntilFriday === 0) {
      daysUntilFriday = 0; // Friday morning, use this weekend
    }
    
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);

    console.log(`Looking for events between ${friday.toISOString()} and ${sunday.toISOString()}`);

    // Query events for the weekend
    // Look for events with publish_date in weekend range OR events category items
    const { data: events, error: eventsError } = await supabase
      .from('content_queue')
      .select('id, title, summary, category, publish_date, original_url, metadata')
      .in('status', ['approved', 'auto_published', 'published'])
      .eq('safety_level', 'safe')
      .or(`category.eq.events,category.eq.community,category.eq.entertainment`)
      .order('publish_date', { ascending: true })
      .limit(50);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    // Filter to weekend events if they have dates, otherwise include recent events
    const weekendEvents = (events || []).filter((event: WeekendEvent) => {
      if (event.publish_date) {
        const eventDate = new Date(event.publish_date);
        return eventDate >= friday && eventDate <= sunday;
      }
      // Include events without specific dates (category = events)
      return event.category === 'events';
    }).slice(0, 10); // Top 10 events

    console.log(`Found ${weekendEvents.length} weekend events`);

    if (weekendEvents.length === 0) {
      // If no weekend-specific events, use recent events/community items
      const { data: recentEvents } = await supabase
        .from('content_queue')
        .select('id, title, summary, category, publish_date, original_url, metadata')
        .in('status', ['approved', 'auto_published', 'published'])
        .eq('safety_level', 'safe')
        .in('category', ['events', 'community', 'entertainment', 'dining'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentEvents && recentEvents.length > 0) {
        weekendEvents.push(...recentEvents);
      }
    }

    if (weekendEvents.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No events found for the weekend roundup',
        eventsFound: 0,
        postsCreated: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format the weekend roundup post
    const formatEventLine = (event: WeekendEvent, index: number): string => {
      const emoji = getCategoryEmoji(event.category);
      const title = event.title.length > 60 ? event.title.substring(0, 57) + '...' : event.title;
      
      // Try to extract time/date info from metadata or title
      let dateInfo = '';
      if (event.metadata?.raw_event_date) {
        dateInfo = ` - ${formatEventDate(event.metadata.raw_event_date)}`;
      } else if (event.publish_date) {
        const d = new Date(event.publish_date);
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        dateInfo = ` - ${dayName}`;
      }
      
      return `${emoji} ${title}${dateInfo}`;
    };

    const eventLines = weekendEvents.slice(0, 8).map((e, i) => formatEventLine(e, i));
    
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

    // Schedule posts (next Thursday 9 AM or now if testing)
    const scheduledFor = getNextThursday9AM();
    
    const platforms = ['facebook', 'x']; // Instagram needs images, skip for text-only
    const postsCreated: string[] = [];

    for (const platform of platforms) {
      const postText = platform === 'facebook' ? postTextFacebook : 
                       platform === 'instagram' ? postTextInstagram : postTextX;

      // Check for existing weekend roundup post
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

      // Create a "virtual" story_id for the roundup (use first event's id)
      const storyId = weekendEvents[0].id;

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
            event_ids: weekendEvents.map(e => e.id),
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
      message: `Generated weekend roundup with ${weekendEvents.length} events for ${postsCreated.join(', ')}`,
      details: {
        events_count: weekendEvents.length,
        platforms: postsCreated,
        date_range: weekendDateRange,
      }
    });

    const result: RoundupResult = {
      success: true,
      eventsFound: weekendEvents.length,
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

function getCategoryEmoji(category: string | null): string {
  const emojis: Record<string, string> = {
    'events': '🎭',
    'community': '🏘️',
    'entertainment': '🎵',
    'dining': '🍽️',
    'sports': '⚽',
    'arts': '🎨',
    'family': '👨‍👩‍👧‍👦',
    'nightlife': '🌙',
    'outdoor': '🌲',
    'shopping': '🛍️',
  };
  return emojis[category || ''] || '▪️';
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
  return rawDate.substring(0, 20);
}

function formatShortDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getNextThursday9AM(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  
  // If it's Thursday and past 9 AM, schedule for next Thursday
  if (daysUntilThursday === 0 && now.getHours() >= 9) {
    daysUntilThursday = 7;
  }
  
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + daysUntilThursday);
  thursday.setHours(9, 0, 0, 0);
  
  return thursday;
}
