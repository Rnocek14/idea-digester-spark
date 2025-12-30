import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Star, ExternalLink } from "lucide-react";

type JobListing = {
  id: string;
  business_name: string;
  title: string;
  category: string;
  job_type: string;
  description: string;
  location_text: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string | null;
  pay_display: string | null;
  contact_email: string;
  apply_url: string | null;
  is_featured: boolean;
  created_at: string;
  expires_at: string;
};

type JobCardProps = {
  job: JobListing;
  onApply?: (job: JobListing) => void;
};

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  return `${diffWeeks} weeks ago`;
};

const formatPay = (job: JobListing) => {
  if (job.pay_display) return job.pay_display;
  if (job.pay_min && job.pay_max) {
    const type = job.pay_type === 'hourly' ? '/hr' : job.pay_type === 'salary' ? '/yr' : '';
    return `$${job.pay_min}-${job.pay_max}${type}`;
  }
  if (job.pay_min) {
    const type = job.pay_type === 'hourly' ? '/hr' : job.pay_type === 'salary' ? '/yr' : '';
    return `From $${job.pay_min}${type}`;
  }
  return null;
};

const categoryColors: Record<string, string> = {
  hospitality: "bg-orange-100 text-orange-700 border-orange-200",
  retail: "bg-blue-100 text-blue-700 border-blue-200",
  services: "bg-purple-100 text-purple-700 border-purple-200",
  trades: "bg-amber-100 text-amber-700 border-amber-200",
  seasonal: "bg-green-100 text-green-700 border-green-200",
};

export function JobCard({ job, onApply }: JobCardProps) {
  const pay = formatPay(job);
  
  const handleApply = () => {
    if (job.apply_url) {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = `mailto:${job.contact_email}?subject=Application for ${job.title} at ${job.business_name}`;
    }
    onApply?.(job);
  };

  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${job.is_featured ? 'ring-2 ring-yellow-400 bg-yellow-50/30' : ''}`}>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {job.is_featured && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{job.business_name}</p>
          </div>
          {pay && (
            <div className="text-right flex-shrink-0">
              <span className="font-medium text-foreground">{pay}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={`capitalize ${categoryColors[job.category] || 'bg-gray-100 text-gray-700'}`}>
            {job.category}
          </Badge>
          <Badge variant="outline" className="capitalize bg-muted text-muted-foreground">
            {job.job_type.replace('-', ' ')}
          </Badge>
        </div>

        {/* Description preview */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {job.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {job.location_text && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location_text}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getRelativeTime(job.created_at)}
            </span>
          </div>
          <Button size="sm" onClick={handleApply}>
            Apply
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
