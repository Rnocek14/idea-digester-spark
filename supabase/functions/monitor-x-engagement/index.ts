import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

// Local hashtags and keywords to monitor
const MONITORED_HASHTAGS = [
  "#LakeGeneva",
  "#LakeGenevaWI", 
  "#GenevaLake",
  "#WalworthCounty",
];

const LOCAL_KEYWORDS = [
  "lake geneva wisconsin",
  "lake geneva wi",
  "geneva lake",
];

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
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!, ACCESS_TOKEN_SECRET!);
  const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

async function searchTweets(query: string): Promise<any[]> {
  const baseUrl = "https://api.twitter.com/2/tweets/search/recent";
  const params = new URLSearchParams({
    query: query,
    max_results: "20",
    "tweet.fields": "created_at,author_id,public_metrics,entities",
    "user.fields": "name,username,profile_image_url",
    expansions: "author_id",
  });
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  const oauthHeader = generateOAuthHeader("GET", baseUrl);
  
  console.log(`[monitor-x-engagement] Searching: ${query}`);
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: oauthHeader,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[monitor-x-engagement] Search error: ${response.status} - ${errorText}`);
    return [];
  }

  const data = await response.json();
  
  // Build user lookup map
  const users: Record<string, any> = {};
  if (data.includes?.users) {
    for (const user of data.includes.users) {
      users[user.id] = user;
    }
  }

  // Combine tweets with user info
  return (data.data || []).map((tweet: any) => ({
    ...tweet,
    author: users[tweet.author_id] || null,
  }));
}

function scoreTweet(tweet: any): number {
  let score = 0;
  
  // Engagement metrics boost
  const metrics = tweet.public_metrics || {};
  score += Math.min(metrics.like_count || 0, 10); // Cap at 10
  score += Math.min((metrics.retweet_count || 0) * 2, 20); // Retweets worth more
  score += Math.min((metrics.reply_count || 0) * 3, 15); // Replies indicate conversation
  
  // Recency boost (tweets from last hour get +5)
  const tweetAge = Date.now() - new Date(tweet.created_at).getTime();
  if (tweetAge < 60 * 60 * 1000) score += 5;
  else if (tweetAge < 3 * 60 * 60 * 1000) score += 3;
  
  // Local keywords boost
  const text = tweet.text?.toLowerCase() || '';
  if (text.includes('lake geneva')) score += 3;
  if (text.includes('local') || text.includes('community')) score += 2;
  
  return score;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
      throw new Error("Twitter API credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const allTweets: any[] = [];
    
    // Search each hashtag
    for (const hashtag of MONITORED_HASHTAGS) {
      const tweets = await searchTweets(hashtag);
      allTweets.push(...tweets.map(t => ({ ...t, source_hashtag: hashtag })));
      // Rate limit protection - small delay between searches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Search keywords
    for (const keyword of LOCAL_KEYWORDS) {
      const tweets = await searchTweets(`"${keyword}"`);
      allTweets.push(...tweets.map(t => ({ ...t, source_keyword: keyword })));
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[monitor-x-engagement] Found ${allTweets.length} total tweets`);

    // Deduplicate by tweet ID
    const uniqueTweets = new Map<string, any>();
    for (const tweet of allTweets) {
      if (!uniqueTweets.has(tweet.id)) {
        uniqueTweets.set(tweet.id, tweet);
      }
    }

    console.log(`[monitor-x-engagement] ${uniqueTweets.size} unique tweets after dedup`);

    // Insert opportunities
    let inserted = 0;
    let skipped = 0;

    for (const [tweetId, tweet] of uniqueTweets) {
      const author = tweet.author;
      const hashtags = tweet.entities?.hashtags?.map((h: any) => `#${h.tag}`) || [];
      
      const opportunity = {
        platform: 'x',
        opportunity_type: 'hashtag' as const,
        tweet_id: tweetId,
        author_username: author?.username || null,
        author_display_name: author?.name || null,
        author_profile_url: author?.username ? `https://twitter.com/${author.username}` : null,
        tweet_text: tweet.text,
        tweet_url: author?.username ? `https://twitter.com/${author.username}/status/${tweetId}` : null,
        hashtags: hashtags.length > 0 ? hashtags : null,
        tweet_created_at: tweet.created_at,
        priority_score: scoreTweet(tweet),
        metadata: {
          source_hashtag: tweet.source_hashtag,
          source_keyword: tweet.source_keyword,
          public_metrics: tweet.public_metrics,
        },
      };

      const { error } = await supabase
        .from('engagement_opportunities')
        .upsert(opportunity, { 
          onConflict: 'platform,tweet_id',
          ignoreDuplicates: true 
        });

      if (error) {
        if (error.code === '23505') {
          skipped++;
        } else {
          console.error(`[monitor-x-engagement] Insert error:`, error);
        }
      } else {
        inserted++;
      }
    }

    console.log(`[monitor-x-engagement] Inserted: ${inserted}, Skipped (dupes): ${skipped}`);

    return new Response(JSON.stringify({
      success: true,
      found: uniqueTweets.size,
      inserted,
      skipped,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[monitor-x-engagement] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
