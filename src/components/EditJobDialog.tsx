import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface JobListing {
  id: string;
  title: string;
  business_name: string;
  category: string;
  job_type: string;
  description: string;
  location_text: string | null;
  pay_display: string | null;
  contact_email: string;
  contact_phone: string | null;
  apply_url: string | null;
}

interface EditJobDialogProps {
  job: JobListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employerEmail: string;
}

const jobSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  location_text: z.string().optional(),
  pay_display: z.string().optional(),
  contact_phone: z.string().optional(),
  apply_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

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

export default function EditJobDialog({ job, open, onOpenChange, employerEmail }: EditJobDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    job_type: "",
    location_text: "",
    pay_display: "",
    contact_phone: "",
    apply_url: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || "",
        description: job.description || "",
        category: job.category || "",
        job_type: job.job_type || "",
        location_text: job.location_text || "",
        pay_display: job.pay_display || "",
        contact_phone: job.contact_phone || "",
        apply_url: job.apply_url || "",
      });
      setErrors({});
    }
  }, [job]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!job) throw new Error("No job to update");
      
      const { error } = await supabase
        .from("job_listings")
        .update({
          title: data.title,
          description: data.description,
          category: data.category,
          job_type: data.job_type,
          location_text: data.location_text || null,
          pay_display: data.pay_display || null,
          contact_phone: data.contact_phone || null,
          apply_url: data.apply_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("contact_email", employerEmail.toLowerCase());

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job listing updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["employer-jobs", employerEmail] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update job listing");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = jobSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    updateMutation.mutate(formData);
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job Listing</DialogTitle>
          <DialogDescription>
            Update your job listing details. Changes will be reflected immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Job Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Job Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
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
                  value={formData.category}
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
              </div>

              <div>
                <Label>Job Type *</Label>
                <Select
                  value={formData.job_type}
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
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Job Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
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
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location_text}
                onChange={(e) => updateField("location_text", e.target.value)}
                placeholder="e.g., Downtown Lake Geneva"
              />
            </div>

            <div>
              <Label htmlFor="edit-pay">Pay Range</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-pay"
                  value={formData.pay_display}
                  onChange={(e) => updateField("pay_display", e.target.value)}
                  placeholder="e.g., $16-20/hr, $45k-55k/yr, DOE"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
            
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => updateField("contact_phone", e.target.value)}
                placeholder="(262) 555-1234"
              />
            </div>

            <div>
              <Label htmlFor="edit-apply-url">External Application URL</Label>
              <Input
                id="edit-apply-url"
                type="url"
                value={formData.apply_url}
                onChange={(e) => updateField("apply_url", e.target.value)}
                placeholder="https://yourbusiness.com/careers"
                className={errors.apply_url ? "border-destructive" : ""}
              />
              {errors.apply_url && (
                <p className="text-xs text-destructive mt-1">{errors.apply_url}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
