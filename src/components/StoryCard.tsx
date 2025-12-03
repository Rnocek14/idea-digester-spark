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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {imageUrl && (
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              <img
                src={imageUrl}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </a>
          ) : (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          )}
          {category && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur pointer-events-none">
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

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <h3 className="text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight font-semibold">
              {title}
            </h3>
          </a>
        ) : (
          <h3 className="text-base sm:text-lg text-slate-900 line-clamp-2 leading-tight font-semibold">
            {title}
          </h3>
        )}

        {summary && (
          <p className="mt-1 text-sm text-slate-600 line-clamp-3 leading-relaxed">
            {summary}
          </p>
        )}

        {meta && (meta.time || meta.source) && (
          <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-1">
            {meta.source && <span>{meta.source}</span>}
            {meta.source && meta.time && <span>•</span>}
            {meta.time && <span>{meta.time}</span>}
          </p>
        )}

        {url && (
          <div className="mt-auto pt-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
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
