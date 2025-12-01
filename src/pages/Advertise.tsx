import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Check, TrendingUp, Users, Zap, Building2, Star, Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const leadSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(100),
  contactName: z.string().trim().min(1, "Contact name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(1000).optional(),
});

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
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitLeadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof leadSchema>) => {
      // 1) Insert lead and get id back
      const { data: inserted, error } = await supabase
        .from("advertiser_leads")
        .insert({
          business_name: data.businessName,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone || null,
          website: data.website || null,
          notes: data.notes || null,
          source: "advertise_page",
          status: "new",
        })
        .select("id, created_at")
        .single();

      if (error) throw error;

      // 2) Fire notification (best-effort; don't block user on failure)
      try {
        await supabase.functions.invoke("notify-on-lead", {
          body: {
            lead: {
              id: inserted.id,
              created_at: inserted.created_at,
              business_name: data.businessName,
              contact_name: data.contactName,
              email: data.email,
              phone: data.phone || null,
              website: data.website || null,
              notes: data.notes || null,
              source: "advertise_page",
            },
          },
        });
      } catch (notifyErr) {
        // Log, but don't surface as a form failure
        console.error("notify-on-lead failed:", notifyErr);
      }
    },
    onSuccess: () => {
      toast.success("Thank you! We'll be in touch within 1 business day.");
      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        website: "",
        notes: "",
      });
      setErrors({});
    },
    onError: () => {
      toast.error("Failed to submit inquiry. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    submitLeadMutation.mutate(result.data);
  };

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
        <section className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
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

        {/* Pricing Section */}
        <section className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand">Newsletter Sponsorships</h3>
            <p className="text-gray-600">
              Appear directly in our weekly email newsletter
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <Card className="p-8 hover:shadow-md transition-shadow border-2 hover:border-brand-accent/50 rounded-2xl">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold text-brand">Featured Sponsor</h4>
                  <p className="text-sm text-gray-600 mt-1">Premium visibility in every newsletter</p>
                </div>
                <div className="text-3xl font-bold text-brand-accent">
                  $400
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Prime visibility in weekly newsletter</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Logo + link to your website</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Reach 2,000+ local subscribers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Click tracking & performance reports</span>
                  </li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-md transition-shadow border-2 hover:border-brand-accent/50 rounded-2xl">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold text-brand">Directory Listing</h4>
                  <p className="text-sm text-gray-600 mt-1">Stand out in our business directory</p>
                </div>
                <div className="text-3xl font-bold text-brand-accent">
                  Included
                  <span className="text-sm text-gray-500"> free</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Sponsor badge highlighting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Top-of-page placement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Logo, description, and contact details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <span>Direct link to your website</span>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </section>

        {/* Lead Capture Form */}
        <section className="space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Get Started
            </p>
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand">Let's grow your business together</h3>
            <p className="text-gray-600">
              Fill out the form below and we'll get back to you within 1 business day.
            </p>
          </div>
          <Card className="p-8 rounded-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name *
                  </label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className={errors.businessName ? "border-red-500" : ""}
                  />
                  {errors.businessName && (
                    <p className="mt-1 text-xs text-red-600">{errors.businessName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name *
                  </label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className={errors.contactName ? "border-red-500" : ""}
                  />
                  {errors.contactName && (
                    <p className="mt-1 text-xs text-red-600">{errors.contactName}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  What are you interested in?
                </label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Tell us about your advertising goals..."
                  className={errors.notes ? "border-red-500" : ""}
                />
                {errors.notes && (
                  <p className="mt-1 text-xs text-red-600">{errors.notes}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitLeadMutation.isPending}
                className="w-full rounded-full bg-brand-accent px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {submitLeadMutation.isPending ? "Submitting..." : "Submit Inquiry"}
              </Button>

              <p className="text-xs text-center text-gray-500">
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
