import { ExternalLink } from "lucide-react";

type StoryCardProps = {
  title: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  url: string | null;
  sponsored?: boolean;
  meta?: {
    time?: string | null;
    source?: string | null;
  };
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

export const StoryCard = ({
  title,
  summary,
  imageUrl,
  category,
  url,
  sponsored = false,
  meta,
}: StoryCardProps) => {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {imageUrl && (
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {category && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur">
              {getCategoryEmoji(category)}{" "}
              <span className="capitalize">{category.replace('_', ' ')}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {sponsored && (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700">
            Sponsored
          </span>
        )}

        <h3 className="font-display text-base sm:text-lg text-brand group-hover:text-brand-accent transition-colors line-clamp-2 leading-tight">
          {title}
        </h3>

        {summary && (
          <p className="mt-1 text-sm text-gray-600 line-clamp-3 leading-relaxed">
            {summary}
          </p>
        )}

        {meta && (meta.time || meta.source) && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
            {meta.source && (
              <span className="truncate max-w-[50%]">
                {meta.source}
              </span>
            )}
            {meta.source && meta.time && <span>•</span>}
            {meta.time && <span>{meta.time}</span>}
          </div>
        )}

        {url && (
          <div className="mt-auto pt-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
            >
              Read more
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </article>
  );
};
