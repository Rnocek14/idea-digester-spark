// Welcome email — sent once, within seconds of a reader subscribing.
//
// Why this exists: before it, a reader who signed up at 2pm heard nothing until
// the next 8am send (or later, if the day's brief was skipped). That is the
// highest-intent moment we will ever have with them, and it was silence. This
// email does four jobs, in this order of value:
//   1. Sets the expectation ("one email, weekday mornings") so the first brief
//      is not a surprise — surprise is what gets a sender marked as spam.
//   2. Hands them their OWN referral link, which is the only link that makes
//      `increment_referral_count` fire.
//   3. Points at one genuinely useful page rather than a tour of the site.
//   4. Asks one question. Replies are the single strongest deliverability
//      signal a sending domain can earn, and they are also story leads.
//
// Invoked by the `trigger_send_welcome_email` AFTER INSERT trigger on
// `subscribers`, which passes ONLY the new row's id — the address is read back
// server-side, so a caller can never aim this at an arbitrary inbox.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getCityConfig } from "../_shared/cityConfig.ts";
import {
  siteOrigin as resolveSiteOrigin,
  fromAddress,
  referralUrl,
  bulkMailHeaders,
  unsubscribeUrl as buildUnsubscribeUrl,
} from "../_shared/emailIdentity.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdmin(req);
  if (authFail) return authFail;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  if (!resendApiKey) {
    // Not an error worth failing the signup over — the row is already saved.
    console.log("[send-welcome-email] RESEND_API_KEY not configured, skipping");
    return json({ success: true, skipped: "no_api_key" });
  }

  try {
    const { subscriber_id } = await req.json();
    if (!subscriber_id) return json({ error: "subscriber_id is required" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: subscriber, error: findError } = await supabase
      .from("subscribers")
      .select("id, email, status, referral_code, unsubscribe_token, welcome_sent_at")
      .eq("id", subscriber_id)
      .maybeSingle();

    if (findError || !subscriber) {
      console.error("[send-welcome-email] Subscriber not found:", findError);
      return json({ error: "Subscriber not found" }, 404);
    }

    // Two guards, both cheap, both protecting a real person's inbox: never
    // welcome someone who has already been welcomed (the trigger can fire again
    // on a re-subscribe), and never mail an address that is not active.
    if (subscriber.welcome_sent_at) {
      console.log(`[send-welcome-email] Already welcomed: ${subscriber.email}`);
      return json({ success: true, skipped: "already_sent" });
    }
    if (subscriber.status && subscriber.status !== "active") {
      console.log(
        `[send-welcome-email] Status is "${subscriber.status}", skipping: ${subscriber.email}`,
      );
      return json({ success: true, skipped: "not_active" });
    }

    const cityConfig = await getCityConfig(supabase);
    const origin = resolveSiteOrigin(cityConfig);
    const unsubUrl = buildUnsubscribeUrl(supabaseUrl, subscriber.unsubscribe_token);
    const refUrl = referralUrl(origin, subscriber.referral_code) || origin;

    // Optional: only set a Reply-To we know a human actually reads. A reply-to
    // that bounces is worse than none — it invites a reply and then loses it.
    const replyTo = (cityConfig.metadata as Record<string, unknown> | null)
      ?.reply_to_email as string | undefined;

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: fromAddress(cityConfig),
      to: subscriber.email,
      subject: `You're in — here's how ${cityConfig.site_name} works`,
      html: buildHtml({
        siteName: cityConfig.site_name,
        cityName: cityConfig.city_name,
        origin,
        refUrl,
        unsubUrl,
      }),
      text: buildText({
        siteName: cityConfig.site_name,
        cityName: cityConfig.city_name,
        origin,
        refUrl,
        unsubUrl,
      }),
      headers: bulkMailHeaders(unsubUrl),
      ...(replyTo ? { replyTo } : {}),
    });

    if (sendError) {
      console.error(`[send-welcome-email] Send failed for ${subscriber.email}:`, sendError);
      return json({ error: sendError.message || "Send failed" }, 500);
    }

    await supabase
      .from("subscribers")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", subscriber.id);

    console.log(`[send-welcome-email] Sent to ${subscriber.email}`);
    return json({ success: true });
  } catch (error) {
    console.error("[send-welcome-email] Error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});

type EmailParams = {
  siteName: string;
  cityName: string;
  origin: string;
  refUrl: string;
  unsubUrl: string;
};

function buildHtml({ siteName, cityName, origin, refUrl, unsubUrl }: EmailParams): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: #ffffff; border-radius: 12px; padding: 32px 28px;">

      <h1 style="margin: 0 0 4px; font-size: 24px; font-weight: 700; color: #1a202c;">
        Welcome to ${escapeHtml(siteName)}
      </h1>
      <p style="margin: 0 0 24px; font-size: 15px; color: #4a5568;">
        You're subscribed. Here's exactly what that means.
      </p>

      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #2d3748;">
        <strong>One email, weekday mornings.</strong> Five minutes on what actually
        happened in ${escapeHtml(cityName)} — city hall, schools, public safety,
        business, and what's on this week. No paywall, no filler, and you can
        leave any time with one click at the bottom of any issue.
      </p>

      <div style="margin: 24px 0; padding: 18px 20px; background: #f7fafc; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #2d3748;">
          Start here
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #4a5568;">
          <a href="${escapeHtml(origin)}/today" style="color: #667eea; text-decoration: underline;">Today's brief</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(origin)}/events" style="color: #667eea; text-decoration: underline;">What's on this week</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(origin)}/guides" style="color: #667eea; text-decoration: underline;">Local guides</a>
        </p>
      </div>

      <div style="margin: 24px 0; padding: 18px 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #2d3748;">
          Know a neighbor who'd want this?
        </p>
        <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #4a5568;">
          This is your personal link — sign-ups through it are credited to you.
        </p>
        <p style="margin: 0;">
          <a href="${escapeHtml(refUrl)}" style="font-size: 14px; color: #667eea; text-decoration: underline; word-break: break-all;">${escapeHtml(refUrl)}</a>
        </p>
      </div>

      <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #2d3748;">
        <strong>One question, if you have ten seconds:</strong> what's happening on
        your street or in your corner of ${escapeHtml(cityName)} that never makes
        the news? Just hit reply — a real person reads every one, and it's where a
        lot of our best stories start.
      </p>

      <p style="margin: 20px 0 0; font-size: 15px; color: #4a5568;">
        — The ${escapeHtml(siteName)} desk
      </p>

      <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #718096;">
          You're getting this because you subscribed at ${escapeHtml(origin)}.<br>
          <a href="${escapeHtml(unsubUrl)}" style="color: #718096; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildText({ siteName, cityName, origin, refUrl, unsubUrl }: EmailParams): string {
  return `
WELCOME TO ${siteName.toUpperCase()}

You're subscribed. Here's exactly what that means.

ONE EMAIL, WEEKDAY MORNINGS. Five minutes on what actually happened in
${cityName} — city hall, schools, public safety, business, and what's on this
week. No paywall, no filler, and you can leave any time with one click at the
bottom of any issue.

START HERE
Today's brief: ${origin}/today
What's on this week: ${origin}/events
Local guides: ${origin}/guides

KNOW A NEIGHBOR WHO'D WANT THIS?
This is your personal link — sign-ups through it are credited to you:
${refUrl}

ONE QUESTION, IF YOU HAVE TEN SECONDS: what's happening on your street or in
your corner of ${cityName} that never makes the news? Just hit reply — a real
person reads every one, and it's where a lot of our best stories start.

— The ${siteName} desk

---
You're getting this because you subscribed at ${origin}.
Unsubscribe: ${unsubUrl}
  `.trim();
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
