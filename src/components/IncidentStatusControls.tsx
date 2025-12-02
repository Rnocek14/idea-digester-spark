import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type IncidentStatus = "active" | "monitoring" | "resolved" | "false_alarm";

interface IncidentStatusControlsProps {
  incidentId: string;
  currentStatus: string;
}

const statusOptions: { value: IncidentStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "active", label: "Active", icon: <AlertCircle className="h-4 w-4" />, color: "text-red-600 border-red-200 hover:bg-red-50" },
  { value: "monitoring", label: "Monitoring", icon: <Eye className="h-4 w-4" />, color: "text-yellow-600 border-yellow-200 hover:bg-yellow-50" },
  { value: "resolved", label: "Resolved", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-600 border-green-200 hover:bg-green-50" },
  { value: "false_alarm", label: "False Alarm", icon: <XCircle className="h-4 w-4" />, color: "text-muted-foreground border-muted hover:bg-muted/50" },
];

export default function IncidentStatusControls({ incidentId, currentStatus }: IncidentStatusControlsProps) {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: IncidentStatus) => {
      const { error } = await supabase
        .from("incidents")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

      if (error) throw error;

      // Also add an update to the timeline
      await supabase.from("incident_updates").insert({
        incident_id: incidentId,
        source: "editor",
        source_label: "Lake Geneva Brief",
        text: `Status changed to ${newStatus.replace("_", " ")}`,
        is_verified: true,
      });
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["incident"] });
      queryClient.invalidateQueries({ queryKey: ["incident-updates"] });
      queryClient.invalidateQueries({ queryKey: ["incidents-public"] });
      queryClient.invalidateQueries({ queryKey: ["incidents-sidebar"] });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Update Status</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              disabled={currentStatus === option.value || updateStatusMutation.isPending}
              onClick={() => updateStatusMutation.mutate(option.value)}
              className={`gap-1.5 ${currentStatus === option.value ? "bg-accent" : option.color}`}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
