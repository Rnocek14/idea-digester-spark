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
  original_url: string | null;
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

    // KILL SWITCH CHECK
    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = settings?.value?.enabled !== false;
    const newsletterEnabled = settings?.value?.newsletter_enabled !== false;
    
    if (!automationEnabled || !newsletterEnabled) {
      console.log("⛔ Newsletter automation is disabled via kill switch");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Newsletter automation is disabled",
          automation_enabled: automationEnabled,
          newsletter_enabled: newsletterEnabled
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    console.log("✅ Kill switch check passed");

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
      
      // BUG FIX: If newsletter exists with status='ready' AND sendNow=true, send it!
      if (existingNewsletter.status === "ready" && sendNow) {
        console.log("📧 sendNow=true and newsletter is ready, sending existing newsletter...");
        
        // Fetch full newsletter for sending
        const { data: fullNewsletter, error: fetchFullError } = await supabase
          .from("newsletters")
          .select("*")
          .eq("id", existingNewsletter.id)
          .single();
        
        if (fetchFullError || !fullNewsletter) {
          throw new Error(`Failed to fetch newsletter for sending: ${fetchFullError?.message}`);
        }
        
        const { sent, failed, errors, subscriberCount } = await sendNewsletterEmail(supabase, fullNewsletter, supabaseUrl);
        
        console.log(`📧 Send result: sent=${sent}, failed=${failed}, subscriberCount=${subscriberCount}, errors=${JSON.stringify(errors)}`);
        
        if (sent > 0) {
          // Update status to sent
          const { error: updateSentError } = await supabase
            .from("newsletters")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", existingNewsletter.id);
          
          if (updateSentError) {
            console.error("Failed to update newsletter status:", updateSentError);
          } else {
            console.log(`✅ Newsletter status updated to 'sent' for ID: ${existingNewsletter.id}`);
          }
          
          console.log(`✅ Newsletter sent to ${sent} subscribers (${failed} failed)`);
          
          return new Response(
            JSON.stringify({
              success: true,
              newsletter_id: existingNewsletter.id,
              status: "sent",
              story_count: existingNewsletter.story_count,
              subject: existingNewsletter.subject,
              sent_count: sent,
              failed_count: failed,
              subscriber_count: subscriberCount,
              message: `Newsletter sent to ${sent} subscribers`,
              already_existed: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        } else {
          // ALL sends failed - return detailed error info
          console.log(`⚠️ No emails were sent. Errors: ${JSON.stringify(errors)}`);
          
          // Determine the actual error message
          let errorMessage = "No emails were sent";
          if (errors.length > 0) {
            // Check for common Resend errors
            if (errors.some(e => e.includes("domain is not verified"))) {
              errorMessage = "Email domain not verified in Resend. Please verify citybrief.info at https://resend.com/domains";
            } else if (errors.some(e => e.includes("RESEND_API_KEY"))) {
              errorMessage = "RESEND_API_KEY not configured";
            } else if (subscriberCount === 0) {
              errorMessage = "No active subscribers found";
            } else {
              errorMessage = `Send failed: ${errors[0]}`;
            }
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              newsletter_id: existingNewsletter.id,
              status: existingNewsletter.status,
              message: errorMessage,
              sent_count: 0,
              failed_count: failed,
              subscriber_count: subscriberCount,
              errors: errors,
              hint: "Check the errors array for details. Domain verification is the most common issue."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      
      // Otherwise, just return existing newsletter info
      return new Response(
        JSON.stringify({ 
          newsletter_id: existingNewsletter.id,
          status: existingNewsletter.status,
          subject: existingNewsletter.subject,
          edition_date: editionDate,
          already_exists: true,
          existing_story_count: existingNewsletter.story_count,
          hint: "Pass sendNow=true to send this ready newsletter"
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

    // ========== FRESHNESS PIPELINE ==========
    // Only include stories from the last 24 hours that have already been published
    // This prevents stale content and future-dated stories from appearing
    
    const freshnessWindowHours = 24;
    const freshCutoff = new Date();
    freshCutoff.setHours(freshCutoff.getHours() - freshnessWindowHours);
    
    const todayDate = today.toISOString().split("T")[0]; // YYYY-MM-DD for event_date comparison

    console.log(`🔍 Fetching fresh stories (last ${freshnessWindowHours}h, approved/auto_published/published + safe)...`);
    console.log(`   Freshness cutoff: ${freshCutoff.toISOString()}`);
    console.log(`   Today's date for events: ${todayDate}`);

    // Fetch fresh stories with freshness filter on publish_date
    const { data: freshStories, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, summary, category, content_newsletter, voice_generated_at, status, created_at, original_url, publish_date, event_date")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .is("last_newsletter_id", null) // GUARDRAIL: Dedupe - never reuse stories
      .gte("publish_date", freshCutoff.toISOString()) // Only stories from last 24h
      .lte("publish_date", today.toISOString()) // No future-dated stories
      .order("publish_date", { ascending: false });

    if (fetchError) throw fetchError;

    // Filter out past events (event_date < today)
    let candidates = (freshStories || []).filter(story => {
      // If it has an event_date, it must be today or in the future
      if (story.event_date) {
        return story.event_date >= todayDate;
      }
      // Non-events pass through
      return true;
    });

    console.log(`✅ Found ${candidates.length} fresh candidates (${freshStories?.length || 0} before event filter)`);

    // Also fetch active incidents for content threshold check
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    const { data: activeIncidents } = await supabase
      .from("incidents")
      .select("id")
      .eq("status", "active")
      .gte("updated_at", sixHoursAgo.toISOString());

    const incidentCount = activeIncidents?.length || 0;
    console.log(`📢 Active incidents in last 6h: ${incidentCount}`);

    // ========== MINIMUM CONTENT THRESHOLD ==========
    // Skip newsletter if not enough fresh content
    // Rules: 
    //   - At least 3 fresh stories, OR
    //   - At least 2 fresh stories + 1 active incident
    const storyCount = candidates.length;
    const hasEnoughContent = 
      storyCount >= 3 || 
      (storyCount >= 2 && incidentCount >= 1);

    if (!hasEnoughContent) {
      const skipReason = storyCount === 0 
        ? "no_fresh_content" 
        : "not_enough_fresh_content";
      
      console.log(`⚠️ Not enough fresh content (stories=${storyCount}, incidents=${incidentCount}), skipping newsletter`);
      
      const { data: skippedNewsletter, error: skipError } = await supabase
        .from("newsletters")
        .insert({
          edition_date: editionDate,
          status: "skipped",
          subject: `Lake Geneva Local - ${editionDate} (Skipped)`,
          preheader: "Not enough fresh content today",
          html_body: "<p>No newsletter generated – not enough fresh content available.</p>",
          text_body: "No newsletter generated – not enough fresh content available.",
          story_ids: [],
          story_count: 0,
          metadata: { 
            skipped_reason: skipReason,
            story_count: storyCount,
            incident_count: incidentCount,
            freshness_window_hours: freshnessWindowHours
          }
        })
        .select()
        .single();

      if (skipError) throw skipError;

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Newsletter skipped: ${skipReason}`,
          newsletter_id: skippedNewsletter.id,
          status: "skipped",
          story_count: storyCount,
          incident_count: incidentCount,
          freshness_window_hours: freshnessWindowHours
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`✅ Found ${candidates.length} eligible stories`);

    // ========== EVERGREEN FALLBACK ==========
    // If we have fewer than MIN_EVENTS upcoming events, inject evergreen content
    // Threshold set to 9 so evergreen fires when we have 8 or fewer events
    const MIN_EVENTS_THRESHOLD = 9;
    const eventCandidates = candidates.filter(s => s.category === "events" && s.event_date);
    let evergreenItems: any[] = [];
    
    if (eventCandidates.length < MIN_EVENTS_THRESHOLD) {
      console.log(`📚 Low event count (${eventCandidates.length} < ${MIN_EVENTS_THRESHOLD}), fetching evergreen content...`);
      
      // Determine current season
      const month = today.getMonth() + 1;
      let currentSeason = "all";
      if (month >= 12 || month <= 2) currentSeason = "winter";
      else if (month >= 3 && month <= 5) currentSeason = "spring";
      else if (month >= 6 && month <= 8) currentSeason = "summer";
      else currentSeason = "fall";
      
      const evergreenNeeded = Math.min(3, MIN_EVENTS_THRESHOLD - eventCandidates.length);
      
      const { data: evergreen } = await supabase
        .from("evergreen_content")
        .select("id, title, content, category")
        .eq("is_active", true)
        .or(`season.eq.all,season.eq.${currentSeason}`)
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .order("priority", { ascending: false })
        .limit(evergreenNeeded);
      
      if (evergreen && evergreen.length > 0) {
        evergreenItems = evergreen;
        console.log(`✅ Adding ${evergreenItems.length} evergreen items: ${evergreenItems.map(e => e.title).join(", ")}`);
        
        // Update usage tracking - simple update without RPC
        const evergreenIds = evergreenItems.map(e => e.id);
        for (const evId of evergreenIds) {
          await supabase
            .from("evergreen_content")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", evId);
        }
      }
    }

    // Rank and pick top stories
    const rankedStories = rankStories(candidates as Story[], 12);
    const selectedStories = rankedStories.slice(0, 12);

    console.log(`📊 Selected ${selectedStories.length} stories + ${evergreenItems.length} evergreen for newsletter`);

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

    // Check for active sponsor placements
    console.log("💰 Checking for active sponsor placements...");
    const { data: activePlacements } = await supabase
      .from("ad_placements")
      .select("*, business_profiles(*), ad_slots(*)")
      .eq("status", "active")
      .lte("start_date", editionDate)
      .gte("end_date", editionDate);

    const headerSponsor = activePlacements?.find(p => p.slot_id === "newsletter_header");

    // Fetch approved job listings for "Now Hiring" section
    console.log("💼 Fetching approved job listings...");
    const { data: jobListings } = await supabase
      .from("job_listings")
      .select("id, title, business_name, category, job_type, pay_display, location_text, apply_url, contact_email, is_featured")
      .eq("status", "approved")
      .gt("expires_at", today.toISOString())
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    console.log(`✅ Found ${jobListings?.length || 0} job listings for newsletter`);

    // Build newsletter
    console.log("📝 Building newsletter content...");
    const newsletter = buildNewsletter(selectedStories, optimizedStories, editionDate, headerSponsor, evergreenItems, jobListings || []);

    // Save newsletter to database
    console.log("💾 Saving newsletter to database...");
    const { data: savedNewsletter, error: saveError } = await supabase
      .from("newsletters")
      .insert({
        edition_date: editionDate,
        status: "ready",
        subject: newsletter.subject,
        preheader: newsletter.preheader,
        html_body: newsletter.htmlBody.replace(/\{\{NEWSLETTER_ID\}\}/g, "PLACEHOLDER"), // Temporary placeholder
        text_body: newsletter.textBody,
        story_ids: storyIds,
        story_count: selectedStories.length,
        auto_send_enabled: sendNow,
        metadata: { 
          categories: getCategoryCounts(selectedStories),
          generated_at: new Date().toISOString(),
          evergreen_count: evergreenItems.length,
          evergreen_ids: evergreenItems.map(e => e.id),
          evergreen_titles: evergreenItems.map(e => e.title)
        }
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Replace newsletter ID placeholder in HTML
    const finalHtmlBody = newsletter.htmlBody.replace(/\{\{NEWSLETTER_ID\}\}/g, savedNewsletter.id);
    
    // Update newsletter with final HTML containing real newsletter ID
    const { error: updateHtmlError } = await supabase
      .from("newsletters")
      .update({ html_body: finalHtmlBody })
      .eq("id", savedNewsletter.id);

    if (updateHtmlError) {
      console.error("Failed to update newsletter HTML:", updateHtmlError);
    }

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
      const { sent, failed, errors, subscriberCount } = await sendNewsletterEmail(supabase, savedNewsletter, supabaseUrl);
      
      console.log(`📧 Send result: sent=${sent}, failed=${failed}, subscriberCount=${subscriberCount}`);
      
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
            subscriber_count: subscriberCount,
            message: `Newsletter sent to ${sent} subscribers`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } else {
        // Send failed - log errors but still return the newsletter info
        console.log(`⚠️ Send failed. Errors: ${JSON.stringify(errors)}`);
        return new Response(
          JSON.stringify({
            success: false,
            newsletter_id: savedNewsletter.id,
            status: "ready",
            story_count: selectedStories.length,
            subject: newsletter.subject,
            message: errors.length > 0 ? errors[0] : "No emails were sent",
            errors: errors,
            subscriber_count: subscriberCount,
            hint: "Check the errors array for details"
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

// Convert category to Title Case (e.g., "real-estate" -> "Real Estate")
function toTitleCase(str: string): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
  editionDate: string,
  sponsor?: any,
  evergreen?: { id: string; title: string; content: string; category: string }[],
  jobs?: { id: string; title: string; business_name: string; category: string; job_type: string; pay_display: string | null; location_text: string | null; apply_url: string | null; contact_email: string; is_featured: boolean | null }[]
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
          const title = escapeHtml(s.title);
          const linkHtml = s.original_url 
            ? ` <a href="${escapeHtml(s.original_url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500;">→ Details</a>`
            : '';
          return `<li style="margin-bottom: 6px; font-size: 14px; line-height: 1.5; color: #4a5568;"><strong>${title}</strong>${linkHtml}</li>`;
        }).join("\n");
        return `
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #718096; letter-spacing: 0.5px;">${toTitleCase(category)}</p>
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
      const linkHtml = s.original_url 
        ? `<div style="margin-top: 8px;"><a href="${escapeHtml(s.original_url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500;">More info →</a></div>`
        : '';
      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1a202c;">${escapeHtml(s.title)}</h3>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a5568;">${escapeHtml(body)}</p>
          ${linkHtml}
        </div>
      `;
    }).join("\n");

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          ${emoji} ${toTitleCase(category)}
        </h2>
        ${items}
      </div>
    `;
  }).join("\n");

  // Build evergreen section if provided
  const evergreenHtml = evergreen && evergreen.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #fef3c7; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #92400e;">
        ✨ Local Favorites
      </h2>
      ${evergreen.map(item => `
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #fcd34d;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #78350f;">${escapeHtml(item.title)}</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">${escapeHtml(item.content)}</p>
        </div>
      `).join("\n")}
    </div>
  ` : "";

  // Build "Now Hiring" jobs section
  const jobCategoryEmoji: Record<string, string> = {
    hospitality: "🍽️",
    retail: "🛍️",
    trades: "🔧",
    services: "✂️",
    healthcare: "🏥",
    office: "💼",
    other: "💼"
  };

  const jobsHtml = jobs && jobs.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #e0f2fe; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0369a1;">
        💼 Now Hiring in Lake Geneva
      </h2>
      ${jobs.map(job => {
        const emoji = jobCategoryEmoji[job.category?.toLowerCase()] || "💼";
        const payInfo = job.pay_display ? `<span style="color: #0284c7; font-weight: 500;">${escapeHtml(job.pay_display)}</span>` : '';
        const locationInfo = job.location_text ? ` • ${escapeHtml(job.location_text)}` : '';
        const applyUrl = job.apply_url || `mailto:${job.contact_email}`;
        const featuredBadge = job.is_featured ? '<span style="background-color: #fbbf24; color: #78350f; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">FEATURED</span>' : '';
        return `
          <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #7dd3fc;">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #0c4a6e;">
              ${emoji} ${escapeHtml(job.title)}${featuredBadge}
            </h3>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #0369a1;">
              <strong>${escapeHtml(job.business_name)}</strong>${locationInfo}
            </p>
            <p style="margin: 0; font-size: 13px; color: #0284c7;">
              ${escapeHtml(job.job_type)}${payInfo ? ` • ${payInfo}` : ''}
              <a href="${escapeHtml(applyUrl)}" data-job-id="${job.id}" target="_blank" rel="noopener noreferrer" style="color: #0369a1; text-decoration: none; font-weight: 500; margin-left: 8px;">Apply →</a>
            </p>
          </div>
        `;
      }).join("")}
      <p style="margin: 16px 0 0 0; font-size: 13px; text-align: center;">
        <a href="https://lakegeneva.news/jobs" target="_blank" rel="noopener noreferrer" style="color: #0369a1; text-decoration: none; font-weight: 600;">
          View all local job openings →
        </a>
      </p>
    </div>
  ` : "";

  // Build sponsor block if present
  const sponsorBlock = sponsor ? `
    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        ${sponsor.business_profiles.logo_url ? `
          <img src="${sponsor.business_profiles.logo_url}" 
               alt="${sponsor.business_profiles.name}" 
               style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px;" />
        ` : ''}
        <div>
          <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Presented By</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
            ${sponsor.label || sponsor.business_profiles.name}
          </p>
          ${sponsor.business_profiles.website ? `
            <a href="https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.business_profiles.website)}&source=newsletter_sponsor&bid=${sponsor.business_id}&pid=${sponsor.id}&nid={{NEWSLETTER_ID}}" 
               style="color: #667eea; text-decoration: none; font-size: 14px;">
              Visit Website →
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  ` : '';

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
      
      ${sponsorBlock}
      
      ${atAGlanceHtml}
      
      ${htmlSections}
      
      ${evergreenHtml}
      
      ${jobsHtml}
      
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
    const items = categoryStories.map(s => {
      const urlSuffix = s.original_url ? ` — ${s.original_url}` : '';
      return `• ${s.title}${urlSuffix}`;
    }).join("\n");
    return `${toTitleCase(category)}\n${items}`;
  }).join("\n\n");

  // Build plain text
  const textSections = Object.entries(grouped).map(([category, categoryStories]) => {
    const items = categoryStories.map(s => {
      const rawContent = s.content ?? "";
      const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 200);
      const urlSuffix = s.original_url ? `\nMore info: ${s.original_url}` : '';
      return `${s.title}\n${body}${urlSuffix}\n`;
    }).join("\n");

    return `== ${toTitleCase(category)} ==\n\n${items}`;
  }).join("\n\n");

  // Build plain text evergreen
  const evergreenText = evergreen && evergreen.length > 0 ? `
== LOCAL FAVORITES ==

${evergreen.map(item => `${item.title}\n${item.content}`).join("\n\n")}
` : "";

  // Build plain text jobs
  const jobsText = jobs && jobs.length > 0 ? `
== NOW HIRING IN LAKE GENEVA ==

${jobs.map(job => {
  const payInfo = job.pay_display ? ` | ${job.pay_display}` : '';
  const locationInfo = job.location_text ? ` | ${job.location_text}` : '';
  const applyUrl = job.apply_url || `mailto:${job.contact_email}`;
  return `• ${job.title} at ${job.business_name}
  ${job.job_type}${payInfo}${locationInfo}
  Apply: ${applyUrl}`;
}).join("\n\n")}

View all jobs: https://lakegeneva.news/jobs
` : "";

  const textBody = `
LAKE GENEVA LOCAL
${dateLabel}

Good morning, Lake Geneva! 👋
Here's what's happening around town this week.

== THIS WEEK AT A GLANCE ==

${atAGlanceText}

${textSections}
${evergreenText}
${jobsText}
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
  // Match <a> tags with href and optional data-job-id attributes
  const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
  
  return htmlBody.replace(linkRegex, (match, before, url, after) => {
    // Skip tracking for unsubscribe links, anchors, mailto, tel, and links already using track-click
    if (url.includes('unsubscribe') || 
        url.startsWith('#') || 
        url.startsWith('mailto:') || 
        url.startsWith('tel:') ||
        url.includes('/track-click?')) {
      return match;
    }
    
    // Check for job ID in the data attribute
    const jobIdMatch = (before + after).match(/data-job-id=["']([^"']+)["']/);
    const jobId = jobIdMatch ? jobIdMatch[1] : null;
    
    // Build tracking URL
    const encodedUrl = encodeURIComponent(url);
    let trackingUrl = `${baseUrl}/functions/v1/track-click?nid=${newsletterId}&sid=${subscriberId}&url=${encodedUrl}`;
    
    // Add job ID if present
    if (jobId) {
      trackingUrl += `&jid=${jobId}`;
    }
    
    // Remove data-job-id from output (it was only for tracking purposes)
    const cleanedBefore = before.replace(/data-job-id=["'][^"']*["']\s*/gi, '');
    const cleanedAfter = after.replace(/data-job-id=["'][^"']*["']\s*/gi, '');
    
    return `<a ${cleanedBefore}href="${trackingUrl}"${cleanedAfter}>`;
  });
}

// Send newsletter email via Resend
async function sendNewsletterEmail(
  supabase: any,
  newsletter: any,
  baseUrl: string
): Promise<{ sent: number; failed: number; errors: string[]; subscriberCount: number }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const errors: string[] = [];
  
  if (!resendApiKey) {
    console.log("⚠️ RESEND_API_KEY not configured, skipping send");
    errors.push("RESEND_API_KEY not configured");
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
  }

  const resend = new Resend(resendApiKey);

  // Fetch active subscribers
  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active");
    // Future: .eq("city_id", newsletter.city_id) for multi-city

  if (error) {
    console.log("⚠️ Failed to fetch subscribers:", error);
    errors.push(`Failed to fetch subscribers: ${error.message}`);
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
  }
  
  if (!subscribers?.length) {
    console.log("⚠️ No active subscribers found");
    errors.push("No active subscribers found");
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
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
          from: "Lake Geneva Brief <newsletter@citybrief.info>",
          to: subscriber.email,
          subject: newsletter.subject,
          html: htmlBody,
          text: textBody,
        });

        if (sendError) {
          const errorMsg = `Failed to send to ${subscriber.email}: ${sendError.message || JSON.stringify(sendError)}`;
          console.error(errorMsg);
          // Capture unique errors (avoid duplicating same error for each subscriber)
          if (!errors.some(e => e.includes(sendError.message || ''))) {
            errors.push(sendError.message || JSON.stringify(sendError));
          }
          totalFailed++;
        } else {
          console.log(`✅ Sent to ${subscriber.email}`);
          totalSent++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        const errorMsg = `Exception sending to ${subscriber.email}: ${error.message}`;
        console.error(errorMsg);
        if (!errors.some(e => e.includes(error.message || ''))) {
          errors.push(error.message || String(error));
        }
        totalFailed++;
      }
    }
  }

  console.log(`📧 Send complete: ${totalSent} sent, ${totalFailed} failed`);
  return { sent: totalSent, failed: totalFailed, errors, subscriberCount: subscribers.length };
}