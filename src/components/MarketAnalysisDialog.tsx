import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2 } from "lucide-react";

interface MarketAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsorName: string;
  sponsorId: string;
  sponsorEmail?: string;
}

export function MarketAnalysisDialog({ 
  open, 
  onOpenChange, 
  sponsorName,
  sponsorId,
  sponsorEmail 
}: MarketAnalysisDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    propertyAddress: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide your name and email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert lead into advertiser_leads
      const { data: lead, error: insertError } = await supabase
        .from("advertiser_leads")
        .insert({
          business_name: `Market Analysis Request - ${sponsorName}`,
          contact_name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          notes: formData.propertyAddress.trim() 
            ? `Property Address: ${formData.propertyAddress.trim()}` 
            : null,
          source: "market_analysis",
          business_id: sponsorId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Notify sponsor via edge function
      await supabase.functions.invoke("notify-on-lead", {
        body: {
          lead: {
            ...lead,
            sponsor_name: sponsorName,
            sponsor_email: sponsorEmail,
          },
        },
      });

      toast({
        title: "Request sent!",
        description: `${sponsorName} will contact you shortly with your free market analysis.`,
      });

      // Reset form and close
      setFormData({ name: "", phone: "", email: "", propertyAddress: "" });
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting market analysis request:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again or call directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Free Market Analysis
          </DialogTitle>
          <DialogDescription>
            Get a personalized home value report from {sponsorName}. No obligation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name *</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(262) 555-1234"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address (optional)</Label>
            <Textarea
              id="propertyAddress"
              placeholder="123 Main St, Lake Geneva, WI 53147"
              value={formData.propertyAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, propertyAddress: e.target.value }))}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Request Free Analysis"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {sponsorName} will contact you within 24 hours.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
