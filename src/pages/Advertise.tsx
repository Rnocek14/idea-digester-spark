import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Star, TrendingUp, Users, Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

type AdSlot = {
  id: string;
  name: string;
  channel: string;
  description: string | null;
  price_monthly: number | null;
  is_active: boolean | null;
};

const Advertise = () => {
  const [formData, setFormData] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    interested_package: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch ad slots to show packages
  const { data: adSlots = [] } = useQuery({
    queryKey: ["public-ad-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_slots")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });

      if (error) throw error;
      return data as AdSlot[];
    },
    staleTime: 300000, // 5 minutes
  });

  // Submit lead mutation
  const submitLeadMutation = useMutation({
    mutationFn: async (leadData: typeof formData) => {
      const { error } = await supabase.from("business_profiles").insert({
        name: leadData.business_name,
        email: leadData.email,
        phone: leadData.phone,
        website: leadData.website,
        status: "lead",
        metadata: {
          contact_name: leadData.contact_name,
          interested_package: leadData.interested_package,
          message: leadData.message,
          lead_source: "advertise_page",
          submitted_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thank you for your interest!", {
        description: "We'll be in touch within 24 hours to discuss your sponsorship.",
      });
      setFormData({
        business_name: "",
        contact_name: "",
        email: "",
        phone: "",
        website: "",
        interested_package: "",
        message: "",
      });
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      toast.error("Submission failed", {
        description: "Please try again or email us directly.",
      });
      setIsSubmitting(false);
      console.error("Lead submission error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name || !formData.email) {
      toast.error("Please fill in required fields");
      return;
    }
    setIsSubmitting(true);
    submitLeadMutation.mutate(formData);
  };

  // Group packages by channel
  const newsletterSlots = adSlots.filter((s) => s.channel === "newsletter");
  const websiteSlots = adSlots.filter((s) => s.channel === "website");
  const socialSlots = adSlots.filter((s) => s.channel === "social");

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <main className="container max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand-accent border border-blue-100">
            New Local Media Platform
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-brand tracking-tight">
            Connect with Lake Geneva residents through trusted local news
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Thousands of local readers turn to Lake Geneva Brief every week for community news,
            events, and dining. Your brand can be part of their daily routine.
          </p>
        </section>

        {/* Stats */}
        <section className="grid md:grid-cols-3 gap-5">
          <Card className="p-6 text-center rounded-2xl border-gray-200">
            <Users className="h-10 w-10 text-brand-accent mx-auto mb-3" />
            <div className="text-3xl font-bold text-brand">2,000+</div>
            <p className="text-sm text-gray-500">Weekly Readers</p>
          </Card>
          <Card className="p-6 text-center rounded-2xl border-gray-200">
            <Mail className="h-10 w-10 text-brand-accent mx-auto mb-3" />
            <div className="text-3xl font-bold text-brand">40%+</div>
            <p className="text-sm text-gray-500">Open Rate</p>
          </Card>
          <Card className="p-6 text-center rounded-2xl border-gray-200">
            <TrendingUp className="h-10 w-10 text-brand-accent mx-auto mb-3" />
            <div className="text-3xl font-bold text-brand">100%</div>
            <p className="text-sm text-gray-500">Local Audience</p>
          </Card>
        </section>

        {/* Newsletter Packages */}
        {newsletterSlots.length > 0 && (
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand">Newsletter Sponsorships</h3>
              <p className="text-gray-600">
                Appear directly in our weekly email newsletter
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {newsletterSlots.map((slot) => (
                <Card
                  key={slot.id}
                  className="p-8 hover:shadow-md transition-shadow border-2 hover:border-brand-accent/50 rounded-2xl"
                >
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xl font-semibold text-brand">{slot.name}</h4>
                      {slot.description && (
                        <p className="text-sm text-gray-600 mt-1">{slot.description}</p>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-brand-accent">
                      ${slot.price_monthly}
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Prime visibility in weekly newsletter</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Logo + link to your website</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Reach 2,000+ local subscribers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Click tracking & performance reports</span>
                      </li>
                    </ul>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Directory Listing */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-3xl font-serif font-bold">Featured Directory Listing</h3>
            <p className="text-muted-foreground">
              Stand out in our local business directory
            </p>
          </div>
          <Card className="p-8 max-w-2xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Building2 className="h-10 w-10 text-primary flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <h4 className="text-xl font-bold">Enhanced Directory Presence</h4>
                  <p className="text-sm text-muted-foreground">
                    Get priority placement with a sponsor badge, featured positioning, and
                    full business details in our public directory.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Sponsor badge highlighting</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Top-of-page placement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Logo, description, and contact details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Direct link to your website</span>
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground italic">
                    Included with newsletter sponsorship packages
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Coming Soon: Social */}
        {socialSlots.length > 0 && (
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <Badge variant="secondary">Coming Soon</Badge>
              <h3 className="text-3xl font-serif font-bold">Social Media Amplification</h3>
              <p className="text-muted-foreground">
                Extend your reach to Instagram, Facebook, and X
              </p>
            </div>
            <Card className="p-8 max-w-2xl mx-auto bg-muted/20">
              <div className="text-center space-y-3">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  Multi-platform social posting launching soon. Get on the waitlist by submitting
                  your information below.
                </p>
              </div>
            </Card>
          </section>
        )}

        {/* Lead Capture Form */}
        <section className="space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <h3 className="text-3xl font-serif font-bold">Get Started</h3>
            <p className="text-muted-foreground">
              Tell us about your business and we'll create a custom sponsorship proposal
            </p>
          </div>
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Business Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={formData.business_name}
                    onChange={(e) =>
                      setFormData({ ...formData, business_name: e.target.value })
                    }
                    placeholder="Your business name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Website</label>
                <Input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourbusiness.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Interested In</label>
                <Select
                  value={formData.interested_package}
                  onValueChange={(value) =>
                    setFormData({ ...formData, interested_package: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent>
                    {newsletterSlots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.name} (${slot.price_monthly}/mo)
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Package</SelectItem>
                    <SelectItem value="not_sure">Not Sure Yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your goals and what you'd like to achieve..."
                  rows={4}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Request Sponsorship Info"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                We'll respond within 24 hours with a custom proposal
              </p>
            </form>
          </Card>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Advertise;
