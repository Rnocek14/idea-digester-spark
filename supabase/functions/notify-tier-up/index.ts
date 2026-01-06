import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TierUpRequest {
  subscriber_id: string;
  email: string;
  new_referral_count: number;
  old_referral_count: number;
}

interface Tier {
  name: string;
  emoji: string;
  threshold: number;
  benefits: string[];
}

const TIERS: Tier[] = [
  {
    name: "Supporter",
    emoji: "⭐",
    threshold: 1,
    benefits: [
      "Early access to breaking news alerts (1-2 hours before regular subscribers)",
      "Be the first to know about important local developments",
    ],
  },
  {
    name: "Advocate",
    emoji: "🌟",
    threshold: 3,
    benefits: [
      "Your name featured in our newsletter's Community Advocates section",
      "Recognition as a valued community member",
      "All previous tier benefits",
    ],
  },
  {
    name: "Ambassador",
    emoji: "💫",
    threshold: 5,
    benefits: [
      "Exclusive access to local deals and discounts from partner businesses",
      "Special Ambassador-only offers and promotions",
      "All previous tier benefits",
    ],
  },
  {
    name: "Champion",
    emoji: "🏆",
    threshold: 10,
    benefits: [
      "VIP invitations to exclusive local events",
      "Direct access to our editorial team",
      "Special recognition as a community leader",
      "All previous tier benefits",
    ],
  },
];

function getTierForCount(count: number): Tier | null {
  // Return the highest tier the subscriber qualifies for
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (count >= TIERS[i].threshold) {
      return TIERS[i];
    }
  }
  return null;
}

function getNewlyReachedTier(oldCount: number, newCount: number): Tier | null {
  // Find if they crossed into a new tier
  for (const tier of TIERS) {
    if (oldCount < tier.threshold && newCount >= tier.threshold) {
      // They just crossed this tier threshold - but return the highest one they qualify for
      return getTierForCount(newCount);
    }
  }
  return null;
}

function getNextTier(currentTier: Tier): Tier | null {
  const currentIndex = TIERS.findIndex(t => t.name === currentTier.name);
  if (currentIndex < TIERS.length - 1) {
    return TIERS[currentIndex + 1];
  }
  return null;
}

function buildEmailHtml(
  tier: Tier,
  referralCount: number,
  nextTier: Tier | null
): string {
  const benefitsList = tier.benefits
    .map(b => `<li style="margin-bottom: 8px;">${b}</li>`)
    .join("");

  const nextTierSection = nextTier
    ? `
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">
        <strong>Next goal:</strong> Refer ${nextTier.threshold - referralCount} more ${
        nextTier.threshold - referralCount === 1 ? "friend" : "friends"
      } to become a ${nextTier.emoji} ${nextTier.name}!
      </p>
    </div>
  `
    : `
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        🎉 <strong>You've reached the highest tier!</strong> Thank you for being an incredible community champion.
      </p>
    </div>
  `;

  const dealsLink = tier.threshold >= 5
    ? `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${Deno.env.get("APP_BASE_URL") || "https://lakegeneva.news"}/deals" 
         style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        View Your Exclusive Deals
      </a>
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <div style="text-align: center; padding: 32px 0;">
    <div style="font-size: 64px; margin-bottom: 16px;">${tier.emoji}</div>
    <h1 style="margin: 0; font-size: 28px; color: #0f172a;">
      Congratulations!
    </h1>
    <p style="margin: 8px 0 0 0; font-size: 18px; color: #475569;">
      You've reached <strong>${tier.name}</strong> status!
    </p>
  </div>

  <div style="background-color: #eff6ff; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #3b82f6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
      Your Referral Count
    </p>
    <p style="margin: 0; font-size: 36px; font-weight: 700; color: #1e40af;">
      ${referralCount} ${referralCount === 1 ? "friend" : "friends"} referred
    </p>
  </div>

  <h2 style="font-size: 18px; color: #0f172a; margin-bottom: 12px;">
    Your ${tier.name} Benefits:
  </h2>
  
  <ul style="padding-left: 20px; margin: 0;">
    ${benefitsList}
  </ul>

  ${dealsLink}
  ${nextTierSection}

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  
  <p style="font-size: 14px; color: #64748b; text-align: center;">
    Thank you for spreading the word about local news!<br>
    <strong>Lake Geneva News</strong>
  </p>

</body>
</html>
`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subscriber_id, email, new_referral_count, old_referral_count }: TierUpRequest =
      await req.json();

    console.log(
      `[notify-tier-up] Processing: ${email}, old=${old_referral_count}, new=${new_referral_count}`
    );

    // Check if they crossed into a new tier
    const newTier = getNewlyReachedTier(old_referral_count, new_referral_count);

    if (!newTier) {
      console.log(`[notify-tier-up] No new tier reached for ${email}`);
      return new Response(
        JSON.stringify({ success: true, message: "No new tier reached" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[notify-tier-up] ${email} reached ${newTier.name} tier!`);

    const nextTier = getNextTier(newTier);
    const html = buildEmailHtml(newTier, new_referral_count, nextTier);

    const emailResponse = await resend.emails.send({
      from: "Lake Geneva News <hello@lakegeneva.news>",
      to: [email],
      subject: `${newTier.emoji} You're now a ${newTier.name}! New rewards unlocked`,
      html,
    });

    console.log(`[notify-tier-up] Email sent to ${email}:`, emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        tier: newTier.name,
        emailResponse,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[notify-tier-up] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
