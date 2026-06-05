import { format } from "date-fns";

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

  const scrollToCategory = (category: string | null) => {
    if (!category) return;
    const el = document.getElementById(category.toLowerCase());
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative border-b border-gray-200 bg-white">
      {/* Lake accent strip — echoes the Shore Path map palette */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: "var(--gradient-lake)" }}
        aria-hidden
      />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-lake-deep uppercase">
            Good morning, Lake Geneva
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl tracking-tight text-brand">
            Here's what's happening this week
          </h1>
          <p className="mt-3 max-w-xl text-sm text-gray-600 leading-relaxed">
            Short, trustworthy updates on city hall, schools, events, and real estate — in under 5 minutes.
          </p>

          {/* Category quick-links / chips */}
          {highlights.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {highlights.map((story) => (
                <button
                  key={story.id}
                  onClick={() => scrollToCategory(story.category)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:border-brand-accent hover:bg-blue-50 hover:text-brand-accent transition-colors"
                >
                  <span>{getCategoryEmoji(story.category)}</span>
                  <span className="capitalize font-medium">
                    {story.category?.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
