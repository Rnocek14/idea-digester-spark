import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSubscribeSource, getReferralCode } from "@/lib/referralTracking";

// Rotating headlines to keep it fresh
const HEADLINES = [
  "Stay in the loop",
  "Don't miss a thing",
  "Your weekly local update",
  "Lake Geneva, delivered",
];

export const InlineSubscribeCTA = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const referralCode = getReferralCode();
      const { error } = await supabase.from("subscribers").insert({
        email: email.toLowerCase().trim(),
        source: getSubscribeSource(),
        status: "active",
        referred_by_code: referralCode,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You're already subscribed!");
        } else {
          throw error;
        }
      } else {
        toast.success("Welcome to the Lake Geneva Brief!");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="col-span-full my-4 p-5 rounded-sm bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-100">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{headline}</p>
            <p className="text-sm text-slate-500">Free Lake Geneva news, weekly.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="h-9 text-sm rounded-full border-slate-300 px-4 w-full sm:w-44"
            disabled={isSubmitting}
          />
          <Button 
            type="submit"
            disabled={isSubmitting}
            aria-label="Subscribe to the Lake Geneva Brief newsletter"
            className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 h-9 shrink-0"
          >
            {isSubmitting ? '...' : <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

