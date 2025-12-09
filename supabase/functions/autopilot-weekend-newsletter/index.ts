import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Story {
  id: string;
  title: string;
  content: string;
  content_newsletter?: string;
  category?: string;
  image_url?: string;
  original_url?: string;
  event_date?: string;
  event_time?: string;
  performer?: string;
  publish_date?: string;
}

interface Subscriber {
  id: string;
  email: string;
  unsubscribe_token: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sendNow = false, force = false } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[Weekend Guide] Starting weekend newsletter generation...");

    // Check kill switch
    const { data: killSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "newsletter_kill_switch")
      .maybeSingle();

    if (killSetting?.value === true) {
      console.log("[Weekend Guide] Kill switch is ON, skipping");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "kill_switch" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate upcoming weekend (Friday-Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    
    // Find next Friday
    const daysUntilFriday = dayOfWeek <= 4 ? (5 - dayOfWeek) : (12 - dayOfWeek);
    const friday = new Date(today);
    friday.setDate(today.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);

    const fridayStr = friday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    console.log(`[Weekend Guide] Looking for events from ${fridayStr} to ${sundayStr}`);

    // Check for existing weekend newsletter this week
    const weekNumber = getWeekNumber(today);
    const { data: existingNewsletter } = await supabase
      .from("newsletters")
      .select("id, status, sent_at")
      .eq("newsletter_type", "weekend")
      .gte("created_at", getWeekStart(today).toISOString())
      .maybeSingle();

    if (existingNewsletter && !force) {
      console.log(`[Weekend Guide] Already have weekend newsletter for this week: ${existingNewsletter.id}`);
      
      if (sendNow && existingNewsletter.status === "ready" && !existingNewsletter.sent_at) {
        console.log("[Weekend Guide] Sending existing ready newsletter...");
        const result = await sendNewsletterEmail(supabase, existingNewsletter.id);
        
        await supabase
          .from("newsletters")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", existingNewsletter.id);
        
        return new Response(
          JSON.stringify({ status: "sent", newsletter_id: existingNewsletter.id, ...result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ status: "exists", newsletter_id: existingNewsletter.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch weekend events
    const { data: weekendEvents, error: eventsError } = await supabase
      .from("content_queue")
      .select("*")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .in("category", ["events", "entertainment", "dining", "community"])
      .gte("event_date", fridayStr)
      .lte("event_date", sundayStr)
      .order("event_date", { ascending: true })
      .limit(30);

    if (eventsError) {
      console.error("[Weekend Guide] Error fetching events:", eventsError);
      throw eventsError;
    }

    console.log(`[Weekend Guide] Found ${weekendEvents?.length || 0} weekend events`);

    // Fetch top stories of the week (last 7 days, not events)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: topStories, error: storiesError } = await supabase
      .from("content_queue")
      .select("*")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .not("category", "in", "(events,entertainment)")
      .gte("publish_date", weekAgo.toISOString())
      .lte("publish_date", new Date().toISOString())
      .order("publish_date", { ascending: false })
      .limit(10);

    if (storiesError) {
      console.error("[Weekend Guide] Error fetching stories:", storiesError);
      throw storiesError;
    }

    console.log(`[Weekend Guide] Found ${topStories?.length || 0} top stories from the week`);

    const eventCount = weekendEvents?.length || 0;
    const storyCount = topStories?.length || 0;

    // Minimum content threshold for Weekend Guide
    const hasEnough = eventCount >= 3 || (eventCount >= 1 && storyCount >= 3);

    if (!hasEnough) {
      console.log(`[Weekend Guide] Not enough content: ${eventCount} events, ${storyCount} stories`);
      
      const { data: skipped } = await supabase
        .from("newsletters")
        .insert({
          edition_date: fridayStr,
          status: "skipped",
          newsletter_type: "weekend",
          subject: `Lake Geneva Weekend Guide – ${formatWeekendRange(friday, sunday)} (Skipped)`,
          preheader: "Not enough quality weekend content",
          html_body: "Weekend guide skipped – not enough solid events this weekend.",
          text_body: "Weekend guide skipped – not enough solid events this weekend.",
          story_ids: [],
          story_count: 0,
          metadata: {
            skipped_reason: "not_enough_weekend_content",
            event_count: eventCount,
            story_count: storyCount,
          },
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ status: "skipped", reason: "not_enough_content", newsletter_id: skipped?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the newsletter
    const weekendRange = formatWeekendRange(friday, sunday);
    const subject = `Lake Geneva Weekend Guide – ${weekendRange}`;
    const preheader = `${eventCount} things to do this weekend in Lake Geneva`;

    const { htmlBody, textBody } = buildWeekendNewsletter(
      weekendEvents || [],
      topStories || [],
      subject,
      weekendRange
    );

    const allStoryIds = [
      ...(weekendEvents || []).map(e => e.id),
      ...(topStories || []).map(s => s.id)
    ];

    const { data: newsletter, error: insertError } = await supabase
      .from("newsletters")
      .insert({
        edition_date: fridayStr,
        status: "ready",
        newsletter_type: "weekend",
        subject,
        preheader,
        html_body: htmlBody,
        text_body: textBody,
        story_ids: allStoryIds,
        story_count: allStoryIds.length,
        metadata: {
          event_count: eventCount,
          story_count: storyCount,
          weekend_range: weekendRange,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Weekend Guide] Error inserting newsletter:", insertError);
      throw insertError;
    }

    console.log(`[Weekend Guide] Created newsletter: ${newsletter.id}`);

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "newsletter",
      entity_id: newsletter.id,
      action: "weekend_guide_created",
      actor_type: "system",
      message: `Weekend guide created with ${eventCount} events and ${storyCount} stories`,
      details: { event_count: eventCount, story_count: storyCount, weekend_range: weekendRange },
    });

    // Send immediately if requested
    if (sendNow) {
      console.log("[Weekend Guide] sendNow=true, sending immediately...");
      const result = await sendNewsletterEmail(supabase, newsletter.id);
      
      await supabase
        .from("newsletters")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", newsletter.id);

      return new Response(
        JSON.stringify({ status: "sent", newsletter_id: newsletter.id, ...result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "ready", newsletter_id: newsletter.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Weekend Guide] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekendRange(friday: Date, sunday: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const friMonth = months[friday.getMonth()];
  const sunMonth = months[sunday.getMonth()];
  
  if (friMonth === sunMonth) {
    return `${friMonth} ${friday.getDate()}–${sunday.getDate()}`;
  }
  return `${friMonth} ${friday.getDate()} – ${sunMonth} ${sunday.getDate()}`;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

function getCategoryEmoji(category: string | null | undefined): string {
  switch (category?.toLowerCase()) {
    case "events": return "🎉";
    case "entertainment": return "🎵";
    case "dining": return "🍽️";
    case "community": return "👥";
    case "sports": return "⚽";
    case "outdoor": return "🌲";
    default: return "📍";
  }
}

function buildWeekendNewsletter(
  events: Story[],
  stories: Story[],
  subject: string,
  weekendRange: string
): { htmlBody: string; textBody: string } {
  const baseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegeneva.citybrief.info";

  // Group events by day
  const eventsByDay: Record<string, Story[]> = {};
  for (const event of events) {
    if (event.event_date) {
      const day = formatEventDate(event.event_date);
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  }

  // Build HTML
  let eventsHtml = "";
  for (const [day, dayEvents] of Object.entries(eventsByDay)) {
    eventsHtml += `
      <tr>
        <td style="padding: 16px 0 8px 0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e40af;">${day}</h3>
        </td>
      </tr>
    `;
    for (const event of dayEvents) {
      const emoji = getCategoryEmoji(event.category);
      const time = event.event_time ? ` • ${event.event_time}` : "";
      const performer = event.performer ? ` – ${event.performer}` : "";
      
      eventsHtml += `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 15px; color: #374151;">
              ${emoji} <strong>${event.title}</strong>${performer}${time}
            </p>
            ${event.content_newsletter || event.content ? 
              `<p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">${(event.content_newsletter || event.content).slice(0, 150)}${(event.content_newsletter || event.content).length > 150 ? "..." : ""}</p>` 
              : ""}
          </td>
        </tr>
      `;
    }
  }

  // Build stories section
  let storiesHtml = "";
  if (stories.length > 0) {
    storiesHtml = `
      <tr>
        <td style="padding: 24px 0 12px 0;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
            📰 This Week in Lake Geneva
          </h2>
        </td>
      </tr>
    `;
    for (const story of stories.slice(0, 5)) {
      storiesHtml += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 15px; color: #374151;">
              <strong>${story.title}</strong>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
              ${(story.content_newsletter || story.content).slice(0, 120)}...
            </p>
          </td>
        </tr>
      `;
    }
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🌊 Lake Geneva Weekend Guide
              </h1>
              <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px;">
                ${weekendRange}
              </p>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Your weekend is sorted! Here's everything happening in Lake Geneva this weekend.
              </p>
            </td>
          </tr>

          <!-- Events Section -->
          <tr>
            <td style="padding: 0 24px;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
                🎉 Things To Do This Weekend
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%;">
                ${eventsHtml}
              </table>
            </td>
          </tr>

          <!-- Top Stories Section -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%;">
                ${storiesHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <a href="${baseUrl}/lake-geneva" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                See All Events →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                Lake Geneva Brief • Your local news, delivered.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                <a href="${baseUrl}" style="color: #6b7280;">Visit Website</a> •
                <a href="[UNSUBSCRIBE_URL]" style="color: #6b7280;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Build plain text
  let textBody = `LAKE GENEVA WEEKEND GUIDE – ${weekendRange}\n\n`;
  textBody += `Your weekend is sorted! Here's everything happening in Lake Geneva this weekend.\n\n`;
  textBody += `═══════════════════════════════════════\n`;
  textBody += `🎉 THINGS TO DO THIS WEEKEND\n`;
  textBody += `═══════════════════════════════════════\n\n`;

  for (const [day, dayEvents] of Object.entries(eventsByDay)) {
    textBody += `▸ ${day.toUpperCase()}\n`;
    for (const event of dayEvents) {
      const time = event.event_time ? ` (${event.event_time})` : "";
      const performer = event.performer ? ` – ${event.performer}` : "";
      textBody += `  • ${event.title}${performer}${time}\n`;
    }
    textBody += `\n`;
  }

  if (stories.length > 0) {
    textBody += `═══════════════════════════════════════\n`;
    textBody += `📰 THIS WEEK IN LAKE GENEVA\n`;
    textBody += `═══════════════════════════════════════\n\n`;
    for (const story of stories.slice(0, 5)) {
      textBody += `• ${story.title}\n`;
      textBody += `  ${(story.content_newsletter || story.content).slice(0, 100)}...\n\n`;
    }
  }

  textBody += `\n---\nLake Geneva Brief • Your local news, delivered.\n`;
  textBody += `Unsubscribe: [UNSUBSCRIBE_URL]\n`;

  return { htmlBody, textBody };
}

async function sendNewsletterEmail(
  supabase: any,
  newsletterId: string
): Promise<{ sent: number; failed: number }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const baseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegeneva.citybrief.info";

  // Get newsletter
  const { data: newsletter, error: nlError } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", newsletterId)
    .single();

  if (nlError || !newsletter) {
    throw new Error(`Newsletter not found: ${newsletterId}`);
  }

  // Get active subscribers
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active");

  if (subError) {
    throw new Error(`Failed to fetch subscribers: ${subError.message}`);
  }

  console.log(`[Weekend Guide] Sending to ${subscribers?.length || 0} subscribers...`);

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers || []) {
    try {
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${subscriber.unsubscribe_token}`;
      let htmlBody = newsletter.html_body.replace(/\[UNSUBSCRIBE_URL\]/g, unsubscribeUrl);
      let textBody = newsletter.text_body.replace(/\[UNSUBSCRIBE_URL\]/g, unsubscribeUrl);

      // Add tracking pixel
      const trackingPixel = `<img src="${baseUrl}/api/track-open?nid=${newsletterId}&sid=${subscriber.id}" width="1" height="1" style="display:none;" alt="" />`;
      htmlBody = htmlBody.replace("</body>", `${trackingPixel}</body>`);

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Lake Geneva Brief <newsletter@citybrief.info>",
          to: [subscriber.email],
          subject: newsletter.subject,
          html: htmlBody,
          text: textBody,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.status}`);
      }

      sent++;
      console.log(`[Weekend Guide] Sent to ${subscriber.email}`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failed++;
      console.error(`[Weekend Guide] Failed to send to ${subscriber.email}:`, error);
    }
  }

  console.log(`[Weekend Guide] Complete: ${sent} sent, ${failed} failed`);

  return { sent, failed };
}
