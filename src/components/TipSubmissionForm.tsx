import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TipSubmissionFormProps {
  incidentId: string;
}

export default function TipSubmissionForm({ incidentId }: TipSubmissionFormProps) {
  const queryClient = useQueryClient();
  const [tip, setTip] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const submitTipMutation = useMutation({
    mutationFn: async () => {
      if (!tip.trim()) throw new Error("Please enter what you saw");

      const tipText = [
        tip.trim(),
        location.trim() ? `📍 Location: ${location}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase.from("incident_updates").insert({
        incident_id: incidentId,
        source: "community",
        source_label: "Community tip",
        text: tipText,
        is_verified: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident-updates", incidentId] });
      toast.success("Tip submitted", {
        description: "Thank you for helping keep our community informed.",
      });
      setTip("");
      setLocation("");
      setContact("");
      setIsExpanded(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit tip");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTipMutation.mutate();
  };

  if (!isExpanded) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            <strong>See something?</strong> Help us keep this page accurate.
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
            Send a Tip
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Send className="h-4 w-4" />
          Send a Tip
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Please only share what you've directly seen or heard from officials.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tip" className="text-xs">
              What did you see? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="tip"
              placeholder="Describe what you observed..."
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              rows={3}
              className="text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-xs">
              Location / Cross street (optional)
            </Label>
            <Input
              id="location"
              placeholder="e.g., Main St & Broad St"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact" className="text-xs">
              Contact (optional, won't be published)
            </Label>
            <Input
              id="contact"
              placeholder="Email or phone"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={submitTipMutation.isPending || !tip.trim()}
            >
              {submitTipMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Sending...
                </>
              ) : (
                "Submit Tip"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              Cancel
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Tips are reviewed before appearing publicly and are clearly labeled as unconfirmed.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
