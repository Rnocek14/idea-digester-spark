import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StoryCardProps = {
  title: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  url: string | null;
  sponsored?: boolean;
};

const getCategoryColor = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "news": return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "events": return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "dining": return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
    case "real_estate": return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
    case "community": return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20";
    case "schools": return "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export const StoryCard = ({
  title,
  summary,
  imageUrl,
  category,
  url,
  sponsored = false,
}: StoryCardProps) => {
  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all relative overflow-hidden",
      "border-l-4",
      category?.toLowerCase() === "news" && "border-l-blue-500",
      category?.toLowerCase() === "events" && "border-l-purple-500",
      category?.toLowerCase() === "dining" && "border-l-orange-500",
      category?.toLowerCase() === "real_estate" && "border-l-green-500",
      category?.toLowerCase() === "community" && "border-l-cyan-500",
      category?.toLowerCase() === "schools" && "border-l-pink-500",
    )}>
      {sponsored && (
        <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20">
          <Star className="h-3 w-3 mr-1 fill-primary" />
          Sponsored
        </Badge>
      )}

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Image */}
          {imageUrl && (
            <div className="w-full md:w-32 h-32 flex-shrink-0">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* Category Badge */}
            {category && (
              <Badge className={cn("text-xs border", getCategoryColor(category))}>
                {category}
              </Badge>
            )}

            {/* Title */}
            <h3 className="text-xl font-serif font-bold leading-tight group-hover:text-primary transition-colors">
              {title}
            </h3>

            {/* Summary */}
            {summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {summary}
              </p>
            )}

            {/* Read More Link */}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
              >
                Read more <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
