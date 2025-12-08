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
    case "civic": return "🏛️";
    default: return "📍";
  }
};

const getRelativeTime = (dateString?: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};

// Check if content is fresh (< 6 hours)
const isFreshContent = (dateString?: string | null) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  return diffMs < 6 * 60 * 60 * 1000;
};

interface AlsoTodayCardProps {
  stories: Story[];
}

export default function AlsoTodayCard({ stories }: AlsoTodayCardProps) {
  if (stories.length === 0) return null;

  // Sort by created_at (most recent first) to show freshest content
  const sortedStories = [...stories].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const freshCount = sortedStories.filter(s => isFreshContent(s.created_at)).length;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Latest Updates
        </p>
        {freshCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            {freshCount} new
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-3">
        {sortedStories.slice(0, 5).map((story) => {
          const fresh = isFreshContent(story.created_at);
          return (
            <li key={story.id}>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(
                    (story.category || 'other').toLowerCase(),
                  );
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full text-left group"
              >
                <div className="flex items-start gap-2">
                  {fresh && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <div className={fresh ? '' : 'ml-3.5'}>
                    <p className="text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                      {story.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={fresh ? 'text-emerald-600 font-medium' : ''}>
                        {getRelativeTime(story.created_at)}
                      </span>
                      {story.category && (
                        <>
                          <span className="opacity-40">•</span>
                          <span>{getCategoryEmoji(story.category)}</span>
                          <span className="capitalize">
                            {story.category.replace('_', ' ')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}