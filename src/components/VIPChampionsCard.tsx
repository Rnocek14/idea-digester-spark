import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Mail, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function VIPChampionsCard() {
  const { data: champions, isLoading } = useQuery({
    queryKey: ["vip-champions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscribers")
        .select("id, email, referral_count, is_vip, subscribed_at")
        .eq("status", "active")
        .eq("is_vip", true)
        .order("referral_count", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Crown className="h-4 w-4 text-amber-500" />
            VIP Champions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Crown className="h-4 w-4 text-amber-500" />
          VIP Champions
          <Badge variant="secondary" className="ml-auto text-xs">
            {champions?.length || 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {champions && champions.length > 0 ? (
          <div className="space-y-3">
            {champions.map((champion) => (
              <div
                key={champion.id}
                className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold text-sm">
                    {champion.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{champion.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {champion.referral_count} referrals
                    </p>
                  </div>
                </div>
                <a
                  href={`mailto:${champion.email}`}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Send email invite"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Crown className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No VIP Champions yet</p>
            <p className="text-xs">
              Subscribers with 10+ referrals become Champions
            </p>
          </div>
        )}
        {champions && champions.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
            💡 Champions are eligible for VIP event invites. Click the mail icon to send invitations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
