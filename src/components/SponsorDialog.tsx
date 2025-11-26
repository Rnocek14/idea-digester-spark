import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { logActivity } from "@/lib/logActivity";

interface SponsorDialogProps {
  sponsorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SponsorDialog({ sponsorId, open, onOpenChange }: SponsorDialogProps) {
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [tier, setTier] = useState("basic");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adSlotsRemaining, setAdSlotsRemaining] = useState("0");
  const [notes, setNotes] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: sponsor } = useQuery({
    queryKey: ["sponsor", sponsorId],
    queryFn: async () => {
      if (!sponsorId) return null;
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .eq("id", sponsorId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!sponsorId,
  });

  useEffect(() => {
    if (sponsor) {
      setBusinessName(sponsor.business_name || "");
      setContactName(sponsor.contact_name || "");
      setEmail(sponsor.email || "");
      setPhone(sponsor.phone || "");
      setWebsite(sponsor.website || "");
      setTier(sponsor.tier || "basic");
      setStatus(sponsor.status || "active");
      setStartDate(sponsor.start_date || "");
      setEndDate(sponsor.end_date || "");
      setAdSlotsRemaining(sponsor.ad_slots_remaining?.toString() || "0");
      setNotes(sponsor.notes || "");
      setLogoUrl(sponsor.logo_url || "");
    } else {
      setBusinessName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setTier("basic");
      setStatus("active");
      setStartDate("");
      setEndDate("");
      setAdSlotsRemaining("0");
      setNotes("");
      setLogoUrl("");
    }
  }, [sponsor, open]);

  const saveMutation = useMutation({
    mutationFn: async (sponsorData: any) => {
      if (sponsorId) {
        const { error } = await supabase
          .from("sponsors")
          .update(sponsorData)
          .eq("id", sponsorId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sponsors").insert(sponsorData);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sponsors"] });
      queryClient.invalidateQueries({ queryKey: ["sponsor", sponsorId] });
      toast.success(sponsorId ? "Sponsor updated" : "Sponsor added");

      // Log activity
      await logActivity({
        entityType: "sponsor",
        entityId: sponsorId,
        action: sponsorId ? "updated" : "created",
        message: `${sponsorId ? "Updated" : "Created"} sponsor "${businessName}" (${tier})`,
        details: {
          tier,
          status,
        },
      });

      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to save sponsor");
    },
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("sponsor-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("sponsor-assets").getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }

    const sponsorData = {
      business_name: businessName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      website: website || null,
      tier,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      ad_slots_remaining: parseInt(adSlotsRemaining) || 0,
      notes: notes || null,
      logo_url: logoUrl || null,
    };

    saveMutation.mutate(sponsorData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sponsorId ? "Edit Sponsor" : "Add New Sponsor"}</DialogTitle>
          <DialogDescription>
            {sponsorId
              ? "Update sponsor information and advertising details"
              : "Add a new sponsor to manage their advertising campaigns"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@acme.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adSlots">Ad Slots Remaining</Label>
              <Input
                id="adSlots"
                type="number"
                value={adSlotsRemaining}
                onChange={(e) => setAdSlotsRemaining(e.target.value)}
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="flex-1"
              />
              {logoUrl && (
                <img src={logoUrl} alt="Logo preview" className="h-12 w-12 object-cover rounded" />
              )}
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this sponsor"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : sponsorId ? "Update" : "Add"} Sponsor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
