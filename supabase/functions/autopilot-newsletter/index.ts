import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Story {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string | null;
  content_newsletter: string | null;
  voice_generated_at: string | null;
  status: string;
  created_at: string;
}

interface Subscriber {
  id: string;
  email: string;
  unsubscribe_token: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false, sendNow = false } = await req.json().catch(() => ({}));
    console.log(`🚀 Autopilot Newsletter Engine starting... (force=${force}, sendNow=${sendNow})`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const editionDate = today.toISOString().split("T")[0];

    console.log(`📅 Checking for existing newsletter for ${editionDate}...`);

    // Check if newsletter already exists for today
    const { data: existingNewsletter } = await supabase
      .from("newsletters")
      .select("id, status, subject, story_count")
      .eq("edition_date", editionDate)
      .maybeSingle();

    if (existingNewsletter && !force) {
      console.log(`✅ Newsletter already exists for today (status: ${existingNewsletter.status})`);
      return new Response(
        JSON.stringify({ 
          newsletter_id: existingNewsletter.id,
          status: existingNewsletter.status,
          subject: existingNewsletter.subject,
          edition_date: editionDate,
          already_exists: true,
          existing_story_count: existingNewsletter.story_count
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // If force=true and newsletter exists, delete it first
    if (existingNewsletter && force) {
      console.log(`🔄 Force regenerate: deleting existing newsletter ${existingNewsletter.id}`);
      const { error: deleteError } = await supabase
        .from("newsletters")
        .delete()
        .eq("id", existingNewsletter.id);
      
      if (deleteError) {
        console.error("Failed to delete existing newsletter:", deleteError);
        throw deleteError;
      }
      console.log("✅ Existing newsletter deleted, proceeding with fresh generation");
    }

    // Select eligible stories
    // GUARDRAIL: Filter by last_newsletter_id IS NULL for dedupe
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    console.log(`🔍 Fetching eligible stories (strict: approved/auto_published/published + safe)...`);

    // STRICT: Try approved/auto_published/published first
    const { data: strictCandidates, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, summary, category, content_newsletter, voice_generated_at, status, created_at")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .is("last_newsletter_id", null) // GUARDRAIL: Dedupe
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    let candidates = strictCandidates || [];
    console.log(`✅ Found ${candidates.length} strict candidates`);

    // FALLBACK: If fewer than 5 strict candidates, include pending+safe stories
    if (candidates.length < 5) {
      console.log(`⚠️ Only ${candidates.length} strict candidates, adding pending+safe stories as fallback...`);
      
      const { data: relaxedCandidates, error: relaxedError } = await supabase
        .from("content_queue")
        .select("id, title, content, summary, category, content_newsletter, voice_generated_at, status, created_at")
        .in("status", ["approved", "auto_published", "published", "pending"])
        .eq("safety_level", "safe")
        .is("last_newsletter_id", null)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (relaxedError) throw relaxedError;
      
      candidates = relaxedCandidates || [];
      console.log(`✅ Found ${candidates.length} total candidates (including pending+safe)`);
    }

    if (!candidates || candidates.length === 0) {
      console.log("⚠️ No eligible stories found, creating skipped newsletter");
      
      const { data: skippedNewsletter, error: skipError } = await supabase
        .from("newsletters")
        .insert({
          edition_date: editionDate,
          status: "skipped",
          subject: `Lake Geneva Local - ${editionDate} (No stories)`,
          preheader: "No new stories available today",
          html_body: "<p>No newsletter generated – no eligible stories available.</p>",
          text_body: "No newsletter generated – no eligible stories available.",
          story_ids: [],
          story_count: 0,
          metadata: { reason: "no_eligible_stories" }
        })
        .select()
        .single();

      if (skipError) throw skipError;

      return new Response(
        JSON.stringify({ 
          message: "No eligible stories, newsletter skipped",
          newsletter_id: skippedNewsletter.id,
          status: "skipped"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`✅ Found ${candidates.length} eligible stories`);

    // Rank and pick top stories
    const rankedStories = rankStories(candidates as Story[], 12);
    const selectedStories = rankedStories.slice(0, 12);

    console.log(`📊 Selected ${selectedStories.length} stories for newsletter`);

    // Ensure voice exists for all stories
    console.log("🎤 Ensuring voice generation for all stories...");
    await ensureVoiceForStories(supabase, selectedStories);

    // Optimize newsletter flow
    console.log("✨ Optimizing newsletter flow...");
    const storyIds = selectedStories.map(s => s.id);
    
    const { data: optimizeData, error: optimizeError } = await supabase.functions.invoke(
      "optimize-newsletter-flow",
      { 
        body: { storyIds },
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      }
    );

    if (optimizeError) {
      console.error("Optimize flow error:", optimizeError);
      console.error("Optimize flow error details:", JSON.stringify(optimizeError, null, 2));
      // If optimization fails, continue with existing newsletter voices
      console.log("⚠️ Optimization failed, using existing content_newsletter values");
    }

    const optimizedStories = optimizeData?.optimizedStories ?? [];
    console.log(`✅ Optimized ${optimizedStories.length} stories`);

    // Build newsletter
    console.log("📝 Building newsletter content...");
    const newsletter = buildNewsletter(selectedStories, optimizedStories, editionDate);

    // Save newsletter to database
    console.log("💾 Saving newsletter to database...");
    const { data: savedNewsletter, error: saveError } = await supabase
      .from("newsletters")
      .insert({
        edition_date: editionDate,
        status: "ready",
        subject: newsletter.subject,
        preheader: newsletter.preheader,
        html_body: newsletter.htmlBody,
        text_body: newsletter.textBody,
        story_ids: storyIds,
        story_count: selectedStories.length,
        auto_send_enabled: sendNow,
        metadata: { 
          categories: getCategoryCounts(selectedStories),
          generated_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Update stories with newsletter reference (dedupe marker) + auto-mark as published
    console.log("🔗 Updating stories with newsletter reference + marking as auto_published...");
    const { error: updateError } = await supabase
      .from("content_queue")
      .update({ 
        last_newsletter_id: savedNewsletter.id,
        status: "auto_published"
      })
      .in("id", storyIds);

    if (updateError) throw updateError;

    // Check if auto-send is enabled for this newsletter
    const shouldSend = savedNewsletter.auto_send_enabled === true;

    if (shouldSend) {
      console.log("📧 Auto-send enabled, sending newsletter...");
      const { sent, failed } = await sendNewsletterEmail(supabase, savedNewsletter, supabaseUrl);
      
      if (sent > 0) {
        await supabase
          .from("newsletters")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", savedNewsletter.id);
        
        console.log(`✅ Newsletter sent to ${sent} subscribers (${failed} failed)`);
        
        return new Response(
          JSON.stringify({
            success: true,
            newsletter_id: savedNewsletter.id,
            status: "sent",
            story_count: selectedStories.length,
            subject: newsletter.subject,
            sent_count: sent,
            failed_count: failed,
            message: `Newsletter sent to ${sent} subscribers`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } else {
      console.log("📧 Auto-send disabled, newsletter saved as 'ready'");
    }

    console.log(`✅ Newsletter generated successfully! ID: ${savedNewsletter.id}`);
    console.log(`📧 Status: ${savedNewsletter.status}`);

    return new Response(
      JSON.stringify({
        success: true,
        newsletter_id: savedNewsletter.id,
        status: savedNewsletter.status,
        story_count: selectedStories.length,
        subject: newsletter.subject,
        message: "Newsletter generated successfully (email sending disabled)"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Autopilot newsletter error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Rank stories by priority: approved first, category diversity, then recency
function rankStories(stories: Story[], limit: number): Story[] {
  // Priority scoring
  const scored = stories.map(s => {
    let score = 0;
    
    // Status priority
    if (s.status === "approved") score += 100;
    else if (s.status === "auto_published") score += 50;
    else if (s.status === "published") score += 75;
    
    // Recency (more recent = higher score)
    const ageHours = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 20 - ageHours / 24); // 0-20 points based on age
    
    return { story: s, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Apply category diversity (max 5 per category)
  const categoryCounts: Record<string, number> = {};
  const selected: Story[] = [];

  for (const item of scored) {
    const category = item.story.category || "uncategorized";
    const count = categoryCounts[category] || 0;

    if (count < 5) {
      selected.push(item.story);
      categoryCounts[category] = count + 1;
    }

    if (selected.length >= limit) break;
  }

  return selected;
}

// Ensure voice generation for stories missing content_newsletter
async function ensureVoiceForStories(supabase: any, stories: Story[]) {
  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];

    if (story.content_newsletter && story.voice_generated_at) {
      console.log(`✓ Story ${i + 1}/${stories.length}: Voice already exists`);
      continue;
    }

    console.log(`🎤 Story ${i + 1}/${stories.length}: Generating voice for "${story.title.substring(0, 50)}..."`);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const { error } = await supabase.functions.invoke("transform-voice", {
      body: { mode: "single", id: story.id },
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });

    if (error) {
      console.error(`❌ Failed to generate voice for story ${story.id}:`, error);
      // Continue anyway - story will use summary as fallback
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Build newsletter HTML and text
function buildNewsletter(
  stories: Story[],
  optimized: { id: string; newsletter_voice: string }[],
  editionDate: string
) {
  const optimizedMap = new Map(optimized.map(o => [o.id, o.newsletter_voice]));

  // Format date
  const date = new Date(editionDate);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const subject = `Lake Geneva This Week – ${dateLabel}`;
  const preheader = stories[0]?.title || "Your weekly roundup of local news and events";

  // Group by category
  const grouped: Record<string, Story[]> = {};
  stories.forEach(s => {
    const cat = s.category || "Community";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  // Category emoji map
  const categoryEmoji: Record<string, string> = {
    events: "📅",
    news: "📰",
    dining: "🍽️",
    community: "🏘️",
    "real-estate": "🏡"
  };

  // Build At-a-Glance section (scannable summary)
  const atAGlanceItems = Object.entries(grouped).flatMap(([category, categoryStories]) => {
    return categoryStories.map(s => {
      // Extract date/time/venue from content_newsletter or summary
      const content = s.content_newsletter || s.summary || "";
      return {
        title: s.title,
        category: category,
        content: content
      };
    });
  });

  const atAGlanceHtml = `
    <div style="margin-bottom: 32px; padding: 20px; background-color: #f7fafc; border-left: 4px solid #667eea; border-radius: 4px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #2d3748;">
        📋 This Week at a Glance
      </h2>
      ${Object.entries(grouped).map(([category, categoryStories]) => {
        const categoryItems = categoryStories.map(s => {
          return `<li style="margin-bottom: 6px; font-size: 14px; line-height: 1.5; color: #4a5568;"><strong>${escapeHtml(s.title)}</strong></li>`;
        }).join("\n");
        return `
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">${category}</p>
            <ul style="margin: 0; padding-left: 20px;">
              ${categoryItems}
            </ul>
          </div>
        `;
      }).join("\n")}
    </div>
  `;

  // Build HTML sections
  const htmlSections = Object.entries(grouped).map(([category, categoryStories]) => {
    const emoji = categoryEmoji[category.toLowerCase()] || "📌";
    const items = categoryStories.map(s => {
      const rawContent = s.content ?? "";
      const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 200);
      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1a202c;">${escapeHtml(s.title)}</h3>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a5568;">${escapeHtml(body)}</p>
        </div>
      `;
    }).join("\n");

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          ${emoji} ${category}
        </h2>
        ${items}
      </div>
    `;
  }).join("\n");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="padding: 32px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Lake Geneva Local</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${dateLabel}</p>
    </div>
    
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #4a5568;">
        Good morning, Lake Geneva! 👋<br>
        Here's what's happening around town this week.
      </p>
      
      ${atAGlanceHtml}
      
      ${htmlSections}
      
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #718096;">
          You're receiving this because you subscribed to Lake Geneva Local.<br>
          <a href="#" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text At-a-Glance
  const atAGlanceText = Object.entries(grouped).map(([category, categoryStories]) => {
    const items = categoryStories.map(s => `• ${s.title}`).join("\n");
    return `${category.toUpperCase()}\n${items}`;
  }).join("\n\n");

  // Build plain text
  const textSections = Object.entries(grouped).map(([category, categoryStories]) => {
    const items = categoryStories.map(s => {
      const rawContent = s.content ?? "";
      const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 200);
      return `${s.title}\n${body}\n`;
    }).join("\n");

    return `== ${category.toUpperCase()} ==\n\n${items}`;
  }).join("\n\n");

  const textBody = `
LAKE GENEVA LOCAL
${dateLabel}

Good morning, Lake Geneva! 👋
Here's what's happening around town this week.

== THIS WEEK AT A GLANCE ==

${atAGlanceText}

${textSections}

---
You're receiving this because you subscribed to Lake Geneva Local.
Unsubscribe: [link]
  `.trim();

  return { subject, preheader, htmlBody, textBody };
}

// Get category counts for metadata
function getCategoryCounts(stories: Story[]): Record<string, number> {
  const counts: Record<string, number> = {};
  stories.forEach(s => {
    const cat = s.category || "uncategorized";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

// Escape HTML entities
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Add tracking pixel to HTML
function addTrackingPixel(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  const trackingPixelUrl = `${baseUrl}/functions/v1/track-open?nid=${newsletterId}&sid=${subscriberId}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;" />`;
  
  // Insert before </body> if exists, otherwise at end
  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${trackingPixel}</body>`);
  }
  return htmlBody + trackingPixel;
}

// Rewrite all links to use click tracking
function rewriteLinksForTracking(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  // Match href="..." or href='...'
  const linkRegex = /href=["']([^"']+)["']/gi;
  
  return htmlBody.replace(linkRegex, (match, url) => {
    // Skip tracking for unsubscribe links, anchors, mailto, tel
    if (url.includes('unsubscribe') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match;
    }
    
    // Build tracking URL
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${baseUrl}/functions/v1/track-click?nid=${newsletterId}&sid=${subscriberId}&url=${encodedUrl}`;
    
    return `href="${trackingUrl}"`;
  });
}

// Send newsletter email via Resend
async function sendNewsletterEmail(
  supabase: any,
  newsletter: any,
  baseUrl: string
): Promise<{ sent: number; failed: number }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    console.log("⚠️ RESEND_API_KEY not configured, skipping send");
    return { sent: 0, failed: 0 };
  }

  const resend = new Resend(resendApiKey);

  // Fetch active subscribers
  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active");
    // Future: .eq("city_id", newsletter.city_id) for multi-city

  if (error || !subscribers?.length) {
    console.log("⚠️ No active subscribers found");
    return { sent: 0, failed: 0 };
  }

  console.log(`📧 Sending to ${subscribers.length} subscribers...`);

  // Batch in chunks of 100 for Resend limits
  const BATCH_SIZE = 100;
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    for (const subscriber of batch) {
      try {
        const unsubscribeUrl = `${baseUrl}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`;
        
        // Replace unsubscribe placeholder
        let htmlBody = newsletter.html_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );
        const textBody = newsletter.text_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );

        // Add tracking pixel and rewrite links
        htmlBody = rewriteLinksForTracking(htmlBody, newsletter.id, subscriber.id, baseUrl);
        htmlBody = addTrackingPixel(htmlBody, newsletter.id, subscriber.id, baseUrl);

        const { error: sendError } = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: subscriber.email,
          subject: newsletter.subject,
          html: htmlBody,
          text: textBody,
        });

        if (sendError) {
          console.error(`Failed to send to ${subscriber.email}:`, sendError);
          totalFailed++;
        } else {
          totalSent++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Exception sending to ${subscriber.email}:`, error);
        totalFailed++;
      }
    }
  }

  return { sent: totalSent, failed: totalFailed };
}