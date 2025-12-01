import { format } from "date-fns";
import { Card } from "@/components/ui/card";

type Story = {
  id: string;
  title: string;
  category: string | null;
};

type BriefHeroProps = {
  stories: Story[];
};

const getCategoryEmoji = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "news": return "📰";
    case "events": return "🎉";
    case "dining": return "🍽️";
    case "real_estate": return "🏡";
    case "community": return "🤝";
    case "schools": return "🏫";
    default: return "📍";
  }
};

export const BriefHero = ({ stories }: BriefHeroProps) => {
  // Get top story from each category (max 4)
  const categoriesShown = new Set<string>();
  const highlights = stories
    .filter((s) => {
      const cat = s.category?.toLowerCase() || "other";
      if (categoriesShown.has(cat) || categoriesShown.size >= 4) return false;
      categoriesShown.add(cat);
      return true;
    })
    .slice(0, 4);

  return (
    <Card className="p-8 md:p-12 bg-gradient-to-br from-primary/5 via-background to-muted/20 border-primary/10">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            Good morning, Lake Geneva 👋
          </h2>
          <p className="text-lg text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {highlights.length > 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">
              Here's what's happening today
            </p>
            <div className="grid gap-2 text-left">
              {highlights.map((story) => (
                <div
                  key={story.id}
                  className="flex items-start gap-3 text-sm md:text-base"
                >
                  <span className="text-xl flex-shrink-0">
                    {getCategoryEmoji(story.category)}
                  </span>
                  <span className="text-foreground/90 leading-relaxed">
                    {story.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
