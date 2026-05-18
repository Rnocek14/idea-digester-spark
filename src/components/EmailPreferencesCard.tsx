import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Mail, CalendarClock, Loader2 } from "lucide-react";

interface EmailPreferencesCardProps {
  email: string;
  token: string;
}

export default function EmailPreferencesCard({ email, token }: EmailPreferencesCardProps) {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["employer-email-preferences", email],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_employer_preferences", { _token: token });

      if (error) throw error;
      return (data && data[0]) || { weekly_digest: true, expiry_reminders: true };
    },
    enabled: !!email && !!token,
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ field, value }: { field: "weekly_digest" | "expiry_reminders"; value: boolean }) => {
      const { error } = await supabase.rpc("set_employer_preference", {
        _token: token,
        _field: field,
        _value: value,
      });
      if (error) throw error;
    },
    onSuccess: (_, { field, value }) => {
      queryClient.invalidateQueries({ queryKey: ["employer-email-preferences", email] });
      const fieldLabel = field === "weekly_digest" ? "Weekly digest" : "Expiry reminders";
      toast.success(`${fieldLabel} ${value ? "enabled" : "disabled"}`);
    },
    onError: () => {
      toast.error("Failed to update preferences");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Email Preferences</CardTitle>
        </div>
        <CardDescription>
          Manage the emails you receive from Lake Geneva Media
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <Label htmlFor="weekly-digest" className="font-medium">Weekly Performance Digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly summary of your job listing clicks and performance
              </p>
            </div>
          </div>
          <Switch
            id="weekly-digest"
            checked={preferences?.weekly_digest ?? true}
            onCheckedChange={(checked) => 
              updatePreferenceMutation.mutate({ field: "weekly_digest", value: checked })
            }
            disabled={updatePreferenceMutation.isPending}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <CalendarClock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <Label htmlFor="expiry-reminders" className="font-medium">Expiry Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your job listings are about to expire
              </p>
            </div>
          </div>
          <Switch
            id="expiry-reminders"
            checked={preferences?.expiry_reminders ?? true}
            onCheckedChange={(checked) => 
              updatePreferenceMutation.mutate({ field: "expiry_reminders", value: checked })
            }
            disabled={updatePreferenceMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
