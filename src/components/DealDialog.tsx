import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"ambassador_deals">;
type Business = Pick<Tables<"business_profiles">, "id" | "name">;

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  onSuccess: () => void;
}

export function DealDialog({ open, onOpenChange, deal, onSuccess }: DealDialogProps) {
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    discount_code: "",
    business_id: "",
    valid_until: "",
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchBusinesses();
      if (deal) {
        setFormData({
          title: deal.title || "",
          description: deal.description || "",
          discount_code: deal.discount_code || "",
          business_id: deal.business_id || "",
          valid_until: deal.valid_until || "",
          is_active: deal.is_active ?? true,
        });
      } else {
        setFormData({
          title: "",
          description: "",
          discount_code: "",
          business_id: "",
          valid_until: "",
          is_active: true,
        });
      }
    }
  }, [open, deal]);

  const fetchBusinesses = async () => {
    const { data } = await supabase
      .from("business_profiles")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    if (data) setBusinesses(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        discount_code: formData.discount_code.trim() || null,
        business_id: formData.business_id || null,
        valid_until: formData.valid_until || null,
        is_active: formData.is_active,
      };

      if (deal) {
        const { error } = await supabase
          .from("ambassador_deals")
          .update(payload)
          .eq("id", deal.id);
        if (error) throw error;
        toast.success("Deal updated");
      } else {
        const { error } = await supabase
          .from("ambassador_deals")
          .insert(payload);
        if (error) throw error;
        toast.success("Deal created");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save deal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "Add New Deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., 10% off all purchases"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details about the deal..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business">Business (optional)</Label>
            <Select
              value={formData.business_id}
              onValueChange={(value) => setFormData({ ...formData, business_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No business linked</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount_code">Discount Code</Label>
            <Input
              id="discount_code"
              value={formData.discount_code}
              onChange={(e) => setFormData({ ...formData, discount_code: e.target.value })}
              placeholder="e.g., AMBASSADOR10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input
              id="valid_until"
              type="date"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : deal ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
