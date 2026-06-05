import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Check, DollarSign, Star } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { addDays } from "date-fns";

const jobSchema = z.object({
  business_name: z.string().min(2, "Business name is required"),
  title: z.string().min(2, "Job title is required"),
  category: z.string().min(1, "Category is required"),
  job_type: z.string().min(1, "Job type is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  location_text: z.string().optional(),
  pay_display: z.string().optional(),
  pay_min: z.number().optional().nullable(),
  pay_max: z.number().optional().nullable(),
  pay_type: z.string().optional(),
  contact_email: z.string().email("Valid email is required"),
  contact_phone: z.string().optional(),
  apply_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  pricing_tier: z.string().default("standard"),
});

type JobFormData = z.infer<typeof jobSchema>;

const CATEGORIES = [
  { value: "hospitality", label: "Hospitality" },
  { value: "retail", label: "Retail" },
  { value: "services", label: "Services" },
  { value: "trades", label: "Trades" },
  { value: "seasonal", label: "Seasonal" },
];

const JOB_TYPES = [
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "seasonal", label: "Seasonal" },
  { value: "contract", label: "Contract" },
];

const PRICING_TIERS = [
  {
    value: "standard",
    label: "Standard",
    price: "$50",
    duration: "30 days",
    features: ["Listed on jobs page", "Email applications"],
  },
  {
    value: "featured",
    label: "Featured",
    price: "$100",
    duration: "30 days",
    features: [
      "Highlighted on jobs page",
      "Newsletter mention",
      "Homepage widget",
      "Priority placement",
    ],
  },
];

const PostJob = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<JobFormData>>({
    pricing_tier: "standard",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Title/description handled by PageMeta below.

  const submitMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const expiresAt = addDays(new Date(), 30).toISOString();
      const createdAt = new Date().toISOString();
      
      const { data: insertedJob, error } = await supabase.from("job_listings").insert({
        business_name: data.business_name,
        title: data.title,
        category: data.category,
        job_type: data.job_type,
        description: data.description,
        location_text: data.location_text || null,
        pay_display: data.pay_display || null,
        pay_min: data.pay_min || null,
        pay_max: data.pay_max || null,
        pay_type: data.pay_type || null,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || null,
        apply_url: data.apply_url || null,
        pricing_tier: data.pricing_tier,
        is_featured: data.pricing_tier === "featured",
        status: "pending",
        payment_status: "unpaid",
        expires_at: expiresAt,
        created_at: createdAt,
      }).select("id").single();

      if (error) throw error;

      // Send notification to admin (fire and forget)
      supabase.functions.invoke("notify-on-job", {
        body: {
          job: {
            id: insertedJob?.id,
            business_name: data.business_name,
            title: data.title,
            category: data.category,
            job_type: data.job_type,
            description: data.description,
            location_text: data.location_text,
            pay_display: data.pay_display,
            contact_email: data.contact_email,
            contact_phone: data.contact_phone,
            apply_url: data.apply_url,
            pricing_tier: data.pricing_tier,
            created_at: createdAt,
          },
        },
      }).catch((err) => {
        console.error("Failed to send job notification:", err);
      });
    },
    onSuccess: () => {
      toast.success("Job submitted! We'll review and contact you about payment.");
      navigate("/jobs");
    },
    onError: (error) => {
      toast.error("Failed to submit job. Please try again.");
      console.error("Job submission error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = jobSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const zodErrors = result.error.issues || [];
      zodErrors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    submitMutation.mutate(result.data);
  };

  const updateField = (field: keyof JobFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <PageShell>
      <PageMeta
        title="Post a Job in Lake Geneva, WI | Lake Geneva Brief"
        description="Hire locally in Lake Geneva. Post your full-time, part-time, seasonal, or contract job to The Brief's audience starting at $50 for 30 days."
        path="/jobs/post"
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Post a Local Job
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Reach Lake Geneva area job seekers. Your listing will be reviewed 
            and published within 24 hours.
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {PRICING_TIERS.map((tier) => (
            <Card
              key={tier.value}
              className={`p-4 cursor-pointer transition-all ${
                formData.pricing_tier === tier.value
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => updateField("pricing_tier", tier.value)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {tier.value === "featured" && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <h3 className="font-semibold text-foreground">{tier.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.duration}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">{tier.price}</span>
                </div>
              </div>
              <ul className="space-y-1">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              {formData.pricing_tier === tier.value && (
                <div className="mt-3 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                    Selected
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="p-6 space-y-6">
            {/* Business Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground border-b pb-2">Business Information</h3>
              
              <div>
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  value={formData.business_name || ""}
                  onChange={(e) => updateField("business_name", e.target.value)}
                  placeholder="Your business name"
                  className={errors.business_name ? "border-destructive" : ""}
                />
                {errors.business_name && (
                  <p className="text-xs text-destructive mt-1">{errors.business_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="location_text">Location (optional)</Label>
                <Input
                  id="location_text"
                  value={formData.location_text || ""}
                  onChange={(e) => updateField("location_text", e.target.value)}
                  placeholder="e.g., Downtown Lake Geneva"
                />
              </div>
            </div>

            {/* Job Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground border-b pb-2">Job Details</h3>
              
              <div>
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={formData.title || ""}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g., Line Cook, Server, Sales Associate"
                  className={errors.title ? "border-destructive" : ""}
                />
                {errors.title && (
                  <p className="text-xs text-destructive mt-1">{errors.title}</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={formData.category || ""}
                    onValueChange={(v) => updateField("category", v)}
                  >
                    <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-xs text-destructive mt-1">{errors.category}</p>
                  )}
                </div>

                <div>
                  <Label>Job Type *</Label>
                  <Select
                    value={formData.job_type || ""}
                    onValueChange={(v) => updateField("job_type", v)}
                  >
                    <SelectTrigger className={errors.job_type ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.job_type && (
                    <p className="text-xs text-destructive mt-1">{errors.job_type}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the position, responsibilities, and requirements..."
                  rows={5}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">{errors.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="pay_display">Pay Range (optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pay_display"
                    value={formData.pay_display || ""}
                    onChange={(e) => updateField("pay_display", e.target.value)}
                    placeholder="e.g., $16-20/hr, $45k-55k/yr, DOE"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Listings with pay info get 40% more applications
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground border-b pb-2">Contact Information</h3>
              
              <div>
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email || ""}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                  placeholder="hiring@yourbusiness.com"
                  className={errors.contact_email ? "border-destructive" : ""}
                />
                {errors.contact_email && (
                  <p className="text-xs text-destructive mt-1">{errors.contact_email}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Used for applications and payment confirmation
                </p>
              </div>

              <div>
                <Label htmlFor="contact_phone">Phone (optional)</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone || ""}
                  onChange={(e) => updateField("contact_phone", e.target.value)}
                  placeholder="(262) 555-1234"
                />
              </div>

              <div>
                <Label htmlFor="apply_url">External Application URL (optional)</Label>
                <Input
                  id="apply_url"
                  type="url"
                  value={formData.apply_url || ""}
                  onChange={(e) => updateField("apply_url", e.target.value)}
                  placeholder="https://yourbusiness.com/careers"
                  className={errors.apply_url ? "border-destructive" : ""}
                />
                {errors.apply_url && (
                  <p className="text-xs text-destructive mt-1">{errors.apply_url}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  If blank, applicants will email you directly
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Job Listing
                    {formData.pricing_tier === "featured" ? " • $100" : " • $50"}
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Your listing will be reviewed within 24 hours. 
                Payment instructions will be sent to your email.
              </p>
            </div>
          </Card>
        </form>
      </div>
    </PageShell>
  );
};

export default PostJob;
