import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false } = await req.json().catch(() => ({}));
    console.log(`🚀 Autopilot Newsletter Engine starting... (force=${force})`);

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

    // GUARDRAIL: Email sending stubbed out for now
    // In the future, uncomment this to enable real sending:
    // await sendNewsletterEmail(savedNewsletter);
    // await supabase.from("newsletters").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", savedNewsletter.id);

    console.log(`✅ Newsletter generated successfully! ID: ${savedNewsletter.id}`);
    console.log(`📧 Status: ${savedNewsletter.status} (email sending disabled for safety)`);

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

// GUARDRAIL: Email sending stubbed out for safety
// Uncomment when ready to enable real sending
/*
async function sendNewsletterEmail(newsletter: any) {
  const emailApiKey = Deno.env.get("EMAIL_API_KEY");
  const listId = Deno.env.get("EMAIL_LIST_ID");

  if (!emailApiKey || !listId) {
    console.log("⚠️ Email provider not configured, skipping send");
    return;
  }

  console.log("📧 Sending newsletter via email provider...");

  const res = await fetch("https://api.your-email-provider.com/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      listId,
      subject: newsletter.subject,
      html: newsletter.html_body,
      text: newsletter.text_body
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send newsletter: ${res.status} ${text}`);
  }

  console.log("✅ Newsletter sent successfully");
}
*/