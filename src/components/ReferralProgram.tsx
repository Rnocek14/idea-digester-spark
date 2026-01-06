import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Copy, Check, Users, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTier, getNextTier, REFERRAL_TIERS } from "@/lib/referralTracking";

interface ReferralProgramProps {
  subscriberEmail?: string;
}

export const ReferralProgram = ({ subscriberEmail }: ReferralProgramProps) => {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!subscriberEmail) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("subscribers")
        .select("referral_code, referral_count")
        .eq("email", subscriberEmail.toLowerCase().trim())
        .single();

      if (!error && data) {
        setReferralCode(data.referral_code);
        setReferralCount(data.referral_count || 0);
      }
      setLoading(false);
    };

    fetchReferralData();
  }, [subscriberEmail]);

  // Generate a display code if we don't have a real one yet
  const displayCode = referralCode || (subscriberEmail 
    ? subscriberEmail.split('@')[0].slice(0, 6).toUpperCase()
    : Math.random().toString(36).substring(2, 8).toUpperCase());
  
  const referralLink = `${window.location.origin}/?ref=${displayCode}`;

  const currentTier = getCurrentTier(referralCount);
  const nextTier = getNextTier(referralCount);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Lake Geneva Brief',
          text: 'Get free local news from Lake Geneva delivered to your inbox!',
          url: referralLink,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 bg-amber-200 rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-amber-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-amber-600" />
          Share the Brief
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Referral Stats */}
        {referralCount > 0 && (
          <div className="bg-white/80 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Your Referrals</span>
              <span className="text-lg font-bold text-amber-600">{referralCount}</span>
            </div>
            {currentTier && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{currentTier.badge}</span>
                <span className="font-medium text-slate-800">{currentTier.name}</span>
                <span className="text-slate-500">• {currentTier.benefit}</span>
              </div>
            )}
            {nextTier && (
              <div className="mt-2 text-xs text-slate-500">
                {nextTier.count - referralCount} more to unlock {nextTier.badge} {nextTier.name}
              </div>
            )}
          </div>
        )}

        {/* Rewards Preview */}
        {referralCount === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Share your link and earn rewards as friends subscribe!
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REFERRAL_TIERS.slice(0, 2).map((tier) => (
                <div key={tier.name} className="bg-white/60 rounded p-2 text-center">
                  <span className="text-lg">{tier.badge}</span>
                  <div className="text-xs font-medium text-slate-700">{tier.count}+ = {tier.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-lg border border-amber-200 px-3 py-2 text-xs text-slate-600 font-mono truncate">
            {referralLink}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 border-amber-300 hover:bg-amber-100"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex-1 border-amber-300 hover:bg-amber-100"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-2 border-t border-amber-200">
          <Users className="h-3 w-3" />
          The more neighbors who subscribe, the stronger our local coverage becomes.
        </div>
      </CardContent>
    </Card>
  );
};
