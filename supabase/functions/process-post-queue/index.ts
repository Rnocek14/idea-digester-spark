import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Twitter API credentials
const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

// Rate limiting configuration
const DAILY_POST_LIMIT = 5;
const MIN_HOURS_BETWEEN_POSTS = 3;
const POSTING_START_HOUR = 7; // 7am Central
const POSTING_END_HOUR = 21; // 9pm Central

function validateTwitterCredentials(): boolean {
  if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || 
      !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
    console.error("[process-post-queue] Missing Twitter API credentials");
    return false;
  }
  return true;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  return signature;
}

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    TWITTER_CONSUMER_SECRET!,
    TWITTER_ACCESS_TOKEN_SECRET!
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function postToTwitter(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const url = "https://api.x.com/2/tweets";
  const method = "POST";

  try {
    const oauthHeader = generateOAuthHeader(method, url);
    console.log("[process-post-queue] Posting to X API...");

    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const responseText = await response.text();
    console.log("[process-post-queue] X API Response Status:", response.status);
    console.log("[process-post-queue] X API Response Body:", responseText);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
      };
    }

    const data = JSON.parse(responseText);
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error: any) {
    console.error("[process-post-queue] X API Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function isWithinPostingWindow(): boolean {
  // Get current time in Central Time (America/Chicago)
  const now = new Date();
  const centralTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const hour = centralTime.getHours();
  
  const inWindow = hour >= POSTING_START_HOUR && hour < POSTING_END_HOUR;
  console.log(`[process-post-queue] Current Central hour: ${hour}, posting window: ${POSTING_START_HOUR}-${POSTING_END_HOUR}, in window: ${inWindow}`);
  return inWindow;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[process-post-queue] Starting queue processing...");

    // KILL SWITCH CHECK
    const { data: settings } = await supabaseClient
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = (settings?.value as any)?.enabled !== false;
    const socialEnabled = (settings?.value as any)?.social_enabled !== false;
    
    if (!automationEnabled || !socialEnabled) {
      console.log("[process-post-queue] ⛔ Social automation is disabled via kill switch");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Social automation is disabled",
          automation_enabled: automationEnabled,
          social_enabled: socialEnabled
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[process-post-queue] ✅ Kill switch check passed");

    // Check if Twitter credentials are configured
    const twitterConfigured = validateTwitterCredentials();
    console.log(`[process-post-queue] Twitter credentials configured: ${twitterConfigured}`);

    // Check posting time window for X
    const inPostingWindow = isWithinPostingWindow();

    // Check daily X post count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayXPostCount } = await supabaseClient
      .from("post_queue")
      .select("*", { count: "exact", head: true })
      .eq("platform", "x")
      .eq("status", "sent")
      .gte("sent_at", today.toISOString());
    
    console.log(`[process-post-queue] X posts sent today: ${todayXPostCount || 0}/${DAILY_POST_LIMIT}`);
    const canPostToX = (todayXPostCount || 0) < DAILY_POST_LIMIT && inPostingWindow && twitterConfigured;

    // Check last X post time for spacing
    let lastXPostTime: Date | null = null;
    if (canPostToX) {
      const { data: lastXPost } = await supabaseClient
        .from("post_queue")
        .select("sent_at")
        .eq("platform", "x")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();
      
      if (lastXPost?.sent_at) {
        lastXPostTime = new Date(lastXPost.sent_at);
        const hoursSinceLastPost = (Date.now() - lastXPostTime.getTime()) / (1000 * 60 * 60);
        console.log(`[process-post-queue] Hours since last X post: ${hoursSinceLastPost.toFixed(1)}`);
        
        if (hoursSinceLastPost < MIN_HOURS_BETWEEN_POSTS) {
          console.log(`[process-post-queue] ⏳ Spacing limit: need ${MIN_HOURS_BETWEEN_POSTS}h between posts, only ${hoursSinceLastPost.toFixed(1)}h elapsed`);
        }
      }
    }

    // Fetch posts that are ready to be sent with safety checks
    const now = new Date();
    const { data: pendingPosts, error: fetchError } = await supabaseClient
      .from("post_queue")
      .select(`
        *,
        content_queue!inner (
          id,
          title,
          safety_level,
          status
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true });

    if (fetchError) {
      console.error("[process-post-queue] Error fetching posts:", fetchError);
      throw fetchError;
    }

    console.log(`[process-post-queue] Found ${pendingPosts?.length || 0} posts ready to process`);

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts ready to process",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedCount = 0;
    let xPostsThisRun = 0;
    const results: any[] = [];

    for (const post of pendingPosts) {
      const story = post.content_queue;
      const storyTitle = story?.title || "Unknown";
      const safetyLevel = story?.safety_level;
      const storyStatus = story?.status;

      console.log(`\n[process-post-queue] ========================================`);
      console.log(`[process-post-queue] Processing: "${storyTitle.substring(0, 50)}..."`);
      console.log(`[process-post-queue] Platform: ${post.platform.toUpperCase()}`);
      console.log(`[process-post-queue] Safety: ${safetyLevel}, Story Status: ${storyStatus}`);

      // SAFETY GATE: Check content safety and status
      const safeStatuses = ['approved', 'auto_published', 'published'];
      if (safetyLevel !== 'safe') {
        console.log(`[process-post-queue] ⛔ BLOCKED: Content safety_level is "${safetyLevel}", not "safe"`);
        await supabaseClient
          .from("post_queue")
          .update({
            status: "blocked",
            error_message: `Content safety_level is "${safetyLevel}", not "safe"`,
            metadata: { ...post.metadata, blocked_at: now.toISOString(), block_reason: "safety_level" }
          })
          .eq("id", post.id);
        results.push({ post_id: post.id, platform: post.platform, success: false, blocked: true, reason: "safety_level" });
        continue;
      }

      if (!safeStatuses.includes(storyStatus)) {
        console.log(`[process-post-queue] ⛔ BLOCKED: Story status is "${storyStatus}", not in [${safeStatuses.join(', ')}]`);
        await supabaseClient
          .from("post_queue")
          .update({
            status: "blocked",
            error_message: `Story status is "${storyStatus}", not approved/published`,
            metadata: { ...post.metadata, blocked_at: now.toISOString(), block_reason: "story_status" }
          })
          .eq("id", post.id);
        results.push({ post_id: post.id, platform: post.platform, success: false, blocked: true, reason: "story_status" });
        continue;
      }

      // Handle X (Twitter) - REAL POSTING
      if (post.platform === "x" && twitterConfigured) {
        // Check all rate limits for X
        if (!inPostingWindow) {
          console.log(`[process-post-queue] ⏳ X post skipped: outside posting window (7am-9pm CT)`);
          results.push({ post_id: post.id, platform: post.platform, success: false, skipped: true, reason: "outside_posting_window" });
          continue;
        }

        if ((todayXPostCount || 0) + xPostsThisRun >= DAILY_POST_LIMIT) {
          console.log(`[process-post-queue] ⏳ X post skipped: daily limit reached (${DAILY_POST_LIMIT})`);
          results.push({ post_id: post.id, platform: post.platform, success: false, skipped: true, reason: "daily_limit" });
          continue;
        }

        if (lastXPostTime) {
          const hoursSinceLastPost = (Date.now() - lastXPostTime.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastPost < MIN_HOURS_BETWEEN_POSTS && xPostsThisRun === 0) {
            console.log(`[process-post-queue] ⏳ X post skipped: spacing limit (${MIN_HOURS_BETWEEN_POSTS}h)`);
            results.push({ post_id: post.id, platform: post.platform, success: false, skipped: true, reason: "spacing_limit" });
            continue;
          }
        }

        // Only allow 1 X post per run for safety
        if (xPostsThisRun >= 1) {
          console.log(`[process-post-queue] ⏳ X post skipped: max 1 per run for safety`);
          results.push({ post_id: post.id, platform: post.platform, success: false, skipped: true, reason: "max_per_run" });
          continue;
        }

        // POST TO X FOR REAL
        console.log(`[process-post-queue] 🚀 REAL POST to X...`);
        const tweetResult = await postToTwitter(post.post_text);

        if (tweetResult.success) {
          console.log(`[process-post-queue] ✅ Tweet posted! ID: ${tweetResult.tweetId}`);
          await supabaseClient
            .from("post_queue")
            .update({
              status: "sent",
              sent_at: now.toISOString(),
              external_post_id: tweetResult.tweetId,
              metadata: {
                ...post.metadata,
                tweet_id: tweetResult.tweetId,
                posted_at: now.toISOString(),
              },
            })
            .eq("id", post.id);

          xPostsThisRun++;
          processedCount++;
          results.push({
            post_id: post.id,
            platform: post.platform,
            success: true,
            real_post: true,
            tweet_id: tweetResult.tweetId,
          });
        } else {
          console.error(`[process-post-queue] ❌ Tweet failed: ${tweetResult.error}`);
          await supabaseClient
            .from("post_queue")
            .update({
              status: "failed",
              error_message: tweetResult.error,
              metadata: {
                ...post.metadata,
                failed_at: now.toISOString(),
                error: tweetResult.error,
              },
            })
            .eq("id", post.id);

          results.push({
            post_id: post.id,
            platform: post.platform,
            success: false,
            error: tweetResult.error,
          });
        }
        continue;
      }

      // Handle Facebook/Instagram - SIMULATED MODE
      console.log(`[process-post-queue] 📝 SIMULATED POST to ${post.platform.toUpperCase()}`);
      console.log(`[process-post-queue] Content: ${post.post_text.substring(0, 100)}...`);

      await supabaseClient
        .from("post_queue")
        .update({
          status: "simulated",
          sent_at: now.toISOString(),
          metadata: {
            ...post.metadata,
            simulated_at: now.toISOString(),
            simulation_note: "Would have posted to real platform API",
          },
        })
        .eq("id", post.id);

      processedCount++;
      results.push({
        post_id: post.id,
        platform: post.platform,
        success: true,
        simulated: true,
      });
    }

    console.log(`\n[process-post-queue] ========================================`);
    console.log(`[process-post-queue] Processed ${processedCount} posts (${xPostsThisRun} real X posts)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} posts`,
        processed: processedCount,
        x_posts_sent: xPostsThisRun,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[process-post-queue] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
