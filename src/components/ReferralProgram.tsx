import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Copy, Check, Users, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ReferralProgramProps {
  subscriberEmail?: string;
}

export const ReferralProgram = ({ subscriberEmail }: ReferralProgramProps) => {
  const [copied, setCopied] = useState(false);
  
  // Generate a simple referral code from email or random
  const referralCode = subscriberEmail 
    ? btoa(subscriberEmail).slice(0, 8).toUpperCase()
    : Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

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

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-amber-600" />
          Share the Brief
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Know someone who'd love Lake Geneva news? Share your link and help grow our community.
        </p>
        
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
