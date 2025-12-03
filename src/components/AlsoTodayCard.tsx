import { Link } from "react-router-dom";

type Story = {
  id: string;
  title: string;
  category: string | null;
  publish_date: string | null;
  created_at: string;
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

const getRelativeTime = (dateString?: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

interface AlsoTodayCardProps {
  stories: Story[];
}

export default function AlsoTodayCard({ stories }: AlsoTodayCardProps) {
  if (stories.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Also today
      </p>
      <ul className="mt-3 space-y-3">
        {stories.slice(0, 5).map((story) => (
          <li key={story.id}>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(
                  (story.category || 'other').toLowerCase(),
                );
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-900 line-clamp-2 hover:text-blue-700 transition-colors">
                {story.title}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                {story.category && (
                  <>
                    <span>{getCategoryEmoji(story.category)}</span>
                    <span className="capitalize">
                      {story.category.replace('_', ' ')}
                    </span>
                    <span className="opacity-40">•</span>
                  </>
                )}
                <span>{getRelativeTime(story.publish_date || story.created_at)}</span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
