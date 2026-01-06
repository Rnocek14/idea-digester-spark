import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Mail, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSubscribeSource } from "@/lib/referralTracking";

export const StickySubscribeBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  // Show banner after scrolling past hero
  useEffect(() => {
    const dismissed = sessionStorage.getItem('subscribe-banner-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > 600);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch subscriber count for social proof
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("subscribers")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (count && count > 10) {
        setSubscriberCount(count);
      }
    };
    fetchCount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("subscribers").insert({
        email: email.toLowerCase().trim(),
        source: getSubscribeSource(),
        status: "active",
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You're already subscribed!");
        } else {
          throw error;
        }
      } else {
        toast.success("Welcome to the Lake Geneva Brief!");
        setIsDismissed(true);
        sessionStorage.setItem('subscribe-banner-dismissed', 'true');
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('subscribe-banner-dismissed', 'true');
  };

  if (isDismissed || !isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg border-t border-blue-500">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left: Message */}
            <div className="flex items-center gap-3 text-white">
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-white/20 items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm sm:text-base">
                  Get Lake Geneva news in your inbox
                </p>
                <p className="text-blue-100 text-xs">
                  Free weekly updates • No spam
                  {subscriberCount && subscriberCount > 50 && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {subscriberCount.toLocaleString()}+ readers
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="h-9 text-sm bg-white/95 border-0 rounded-full px-4 w-full sm:w-48 focus:ring-2 focus:ring-white/50"
                disabled={isSubmitting}
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-5 rounded-full bg-white text-blue-600 hover:bg-blue-50 font-semibold text-sm shrink-0"
              >
                {isSubmitting ? '...' : 'Subscribe'}
              </Button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
