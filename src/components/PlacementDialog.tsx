import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PlacementDialogProps {
  businessId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlacementDialog = ({ businessId, open, onOpenChange }: PlacementDialogProps) => {
  const queryClient = useQueryClient();
  const [slotId, setSlotId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("id", businessId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const { data: slots } = useQuery({
    queryKey: ["ad-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_slots")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: placements } = useQuery({
    queryKey: ["placements", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("ad_placements")
        .select("*, ad_slots(name, channel)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  useEffect(() => {
    if (!open) {
      setSlotId("");
      setStartDate("");
      setEndDate("");
      setLabel("");
      setNotes("");
      setStatus("active");
    }
  }, [open]);

  const createPlacementMutation = useMutation({
    mutationFn: async (placementData: any) => {
      const { error } = await supabase
        .from("ad_placements")
        .insert([placementData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placements"] });
      toast.success("Ad placement created");
      setSlotId("");
      setStartDate("");
      setEndDate("");
      setLabel("");
      setNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create placement");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!slotId || !startDate || !endDate) {
      toast.error("Slot, start date, and end date are required");
      return;
    }

    const placementData = {
      business_id: businessId,
      slot_id: slotId,
      start_date: startDate,
      end_date: endDate,
      label: label || null,
      notes: notes || null,
      status,
    };

    createPlacementMutation.mutate(placementData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "scheduled":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "expired":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {business ? `Ad Placements - ${business.name}` : "Ad Placements"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Placements */}
          {placements && placements.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Current Placements</h3>
              <div className="space-y-2">
                {placements.map((placement: any) => (
                  <div
                    key={placement.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{placement.ad_slots?.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(placement.start_date), "MMM d")} - {format(new Date(placement.end_date), "MMM d, yyyy")}
                      </div>
                      {placement.label && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Label: {placement.label}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={getStatusColor(placement.status)}>
                      {placement.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Placement Form */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Create New Placement</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slot">Ad Slot *</Label>
                <Select value={slotId} onValueChange={setSlotId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ad slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots?.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.name} - ${(slot.price_monthly / 100).toFixed(0)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {slotId && slots && (
                  <p className="text-sm text-muted-foreground">
                    {slots.find(s => s.id === slotId)?.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Presented by Lake Geneva Realty"
                />
                <p className="text-sm text-muted-foreground">
                  Custom text to show with the sponsor block
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this placement..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={createPlacementMutation.isPending}>
                  {createPlacementMutation.isPending ? "Creating..." : "Create Placement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
