import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Lock, CheckCircle, Calendar, Tag, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { REFERRAL_TIERS, getCurrentTier, getNextTier } from "@/lib/referralTracking";
import { PageMeta } from "@/components/PageMeta";

export default function Deals() {
  const [email, setEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [subscriberData, setSubscriberData] = useState<{
    referral_count: number;
    referral_code: string;
  } | null>(null);

  const AMBASSADOR_THRESHOLD = 5;

  // Fetch deals (only shown when verified)
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["ambassador-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_deals")
        .select("*, business_profiles(name, logo_url)")
        .eq("is_active", true)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().split("T")[0]}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: verified && (subscriberData?.referral_count || 0) >= AMBASSADOR_THRESHOLD,
  });

  const handleVerify = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase
        .from("subscribers")
        .select("referral_count, referral_code, status")
        .eq("email", email.toLowerCase().trim())
        .eq("status", "active")
        .single();

      if (error || !data) {
        toast.error("Email not found or not an active subscriber");
        setVerified(false);
        setSubscriberData(null);
        return;
      }

      setSubscriberData({
        referral_count: data.referral_count || 0,
        referral_code: data.referral_code || "",
      });
      setVerified(true);

      if ((data.referral_count || 0) >= AMBASSADOR_THRESHOLD) {
        toast.success("Welcome, Ambassador! 💫 Enjoy your exclusive deals.");
      } else {
        const needed = AMBASSADOR_THRESHOLD - (data.referral_count || 0);
        toast.info(`You need ${needed} more referral${needed === 1 ? "" : "s"} to unlock Ambassador deals.`);
      }
    } catch (e: any) {
      toast.error("Verification failed", { description: e.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const isAmbassador = verified && (subscriberData?.referral_count || 0) >= AMBASSADOR_THRESHOLD;
  const currentTier = subscriberData ? getCurrentTier(subscriberData.referral_count) : null;
  const nextTier = subscriberData ? getNextTier(subscriberData.referral_count) : null;

  return (
    <PageShell
      title="Exclusive Local Deals"
      description="Special offers for Lake Geneva Local Ambassadors"
    >
      <PageMeta
        title="Ambassador Deals — Local Lake Geneva Offers | The Brief"
        description="Exclusive discounts from Lake Geneva businesses, available to Brief subscribers who've referred friends. Verify your email to unlock current deals."
        path="/deals"
      />
      <div className="container max-w-4xl py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Ambassador Exclusive Deals</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Special discounts from local Lake Geneva businesses, exclusively for our community Ambassadors.
          </p>
        </div>

        {/* Verification Form */}
        {!verified && (
          <Card className="max-w-md mx-auto mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Verify Your Status
              </CardTitle>
              <CardDescription>
                Enter your subscriber email to access Ambassador deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
                <Button onClick={handleVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verified but Not Ambassador */}
        {verified && !isAmbassador && (
          <Card className="max-w-lg mx-auto mb-12 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
                  <Star className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {currentTier ? `You're a ${currentTier.name}!` : "Almost There!"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  You have <strong>{subscriberData?.referral_count || 0}</strong> referral
                  {(subscriberData?.referral_count || 0) === 1 ? "" : "s"}.
                  {nextTier && nextTier.count <= AMBASSADOR_THRESHOLD && (
                    <> Refer <strong>{nextTier.count - (subscriberData?.referral_count || 0)}</strong> more friend
                    {nextTier.count - (subscriberData?.referral_count || 0) === 1 ? "" : "s"} to become an Ambassador and unlock exclusive deals!</>
                  )}
                </p>

                <div className="bg-background rounded-lg p-4 mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Share your referral link:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                    https://lakegeneva.news?ref={subscriberData?.referral_code}
                  </code>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {REFERRAL_TIERS.map((tier) => (
                    <Badge
                      key={tier.count}
                      variant={(subscriberData?.referral_count || 0) >= tier.count ? "default" : "outline"}
                      className="text-xs"
                    >
                      {tier.badge} {tier.name} ({tier.count}+)
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ambassador Deals */}
        {isAmbassador && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                  💫 Ambassador
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {subscriberData?.referral_count} referrals
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVerified(false);
                  setSubscriberData(null);
                  setEmail("");
                }}
              >
                Sign Out
              </Button>
            </div>

            {dealsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : deals && deals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {deals.map((deal) => (
                  <Card key={deal.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{deal.title}</CardTitle>
                          {deal.business_profiles?.name && (
                            <CardDescription className="mt-1">
                              {deal.business_profiles.name}
                            </CardDescription>
                          )}
                        </div>
                        {deal.discount_code && (
                          <Badge variant="secondary" className="font-mono">
                            <Tag className="h-3 w-3 mr-1" />
                            {deal.discount_code}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {deal.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {deal.description}
                        </p>
                      )}
                      {deal.valid_until && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Valid until {format(new Date(deal.valid_until), "MMM d, yyyy")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Deals Yet</h3>
                  <p className="text-muted-foreground">
                    We're working on bringing you exclusive local deals. Check back soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Become an Ambassador CTA */}
        {!verified && (
          <Card className="mt-12 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Become an Ambassador</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Refer 5 friends to Lake Geneva Local and unlock exclusive deals from local businesses.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {REFERRAL_TIERS.map((tier) => (
                    <div key={tier.count} className="text-center p-3 bg-background rounded-lg">
                      <div className="text-2xl mb-1">{tier.badge}</div>
                      <div className="font-semibold text-sm">{tier.name}</div>
                      <div className="text-xs text-muted-foreground">{tier.count}+ referrals</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
