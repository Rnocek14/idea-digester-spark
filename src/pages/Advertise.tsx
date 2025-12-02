import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageShell from "@/components/PageShell";
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
    <PageShell
      title="Advertise with Lake Geneva Brief"
      description="Sponsor the Lake Geneva Brief newsletter and reach local readers with targeted, trackable campaigns."
    >
      {/* Hero */}
      <header className="mb-10 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Lake Geneva Brief · Advertise
        </p>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Reach Lake Geneva locals where they already pay attention.
            </h1>
            <p className="text-sm text-slate-600">
              Lake Geneva Brief is the five-minute newsletter locals read to stay on
              top of city hall, schools, events, and real estate. Your business can
              be part of that daily habit.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                📬 Weekly newsletter
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                🧭 Local directory placement
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                📊 Performance reporting
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm text-xs text-slate-600">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Snapshot (pilot targets)
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-slate-500">Subscribers</dt>
                <dd className="text-lg font-semibold text-slate-900">2,000+</dd>
              </div>
              <div>
                <dt className="text-slate-500">Avg. open rate</dt>
                <dd className="text-lg font-semibold text-slate-900">40%+</dd>
              </div>
              <div>
                <dt className="text-slate-500">Audience</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  100% local
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Primary focus</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  Residents & small biz
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-slate-500">
              Pilot metrics will update as we grow. You're getting in at the
              beginning.
            </p>
          </div>
        </div>
      </header>

      {/* Packages */}
      <section className="mb-10 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Sponsorship options
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Primary package */}
          <article className="relative flex flex-col rounded-2xl border border-amber-200 bg-white p-5 shadow-sm ring-1 ring-amber-100">
            <div className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Most popular
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Featured Newsletter Sponsor
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Your logo, message, and link at the top of every weekly newsletter.
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">$400</span>
              <span className="text-xs text-slate-500">/month</span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Prime placement in weekly email</li>
              <li>• Click-through tracking and report</li>
              <li>• Sponsor badge in business directory</li>
              <li>• Optional social shout-out</li>
            </ul>
          </article>

          {/* Secondary package */}
          <article className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Directory Sponsor
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Stand out inside the Lake Geneva Business Directory.
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-lg font-semibold text-slate-900">$100</span>
              <span className="text-xs text-slate-500">/month</span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Sponsor badge and highlight</li>
              <li>• Top-of-category placement</li>
              <li>• Logo, description, contact info</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Lead form */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Get a custom proposal
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tell us a bit about your business and goals. We'll respond within
            one business day.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="businessName" className="block text-xs font-medium text-slate-700 mb-1">
                Business Name *
              </label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm
                           focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  errors.businessName ? "border-red-500" : "border-slate-200"
                }`}
              />
              {errors.businessName && (
                <p className="mt-1 text-xs text-red-600">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label htmlFor="contactName" className="block text-xs font-medium text-slate-700 mb-1">
                Contact Name *
              </label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm
                           focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  errors.contactName ? "border-red-500" : "border-slate-200"
                }`}
              />
              {errors.contactName && (
                <p className="mt-1 text-xs text-red-600">{errors.contactName}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">
                Email *
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm
                           focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  errors.email ? "border-red-500" : "border-slate-200"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-slate-700 mb-1">
                Phone
              </label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm
                           focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="website" className="block text-xs font-medium text-slate-700 mb-1">
              Website
            </label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm
                         focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-xs font-medium text-slate-700 mb-1">
              What are you interested in?
            </label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Tell us about your advertising goals..."
              className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm
                         focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                errors.notes ? "border-red-500" : "border-slate-200"
              }`}
            />
            {errors.notes && (
              <p className="mt-1 text-xs text-red-600">{errors.notes}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitLeadMutation.isPending}
            className="w-full rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitLeadMutation.isPending ? "Submitting..." : "Submit Inquiry"}
          </button>

          <p className="mt-2 text-[11px] text-center text-slate-500">
            No spam. We'll only use this info to follow up on your inquiry.
          </p>
        </form>
      </section>
    </PageShell>
  );
};

export default Advertise;
