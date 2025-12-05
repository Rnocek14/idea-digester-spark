import { ExternalLink } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";

type StoryCardProps = {
  title: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  url: string | null;
  sponsored?: boolean;
  geoTier?: number | null;
  geoLabel?: string | null;
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

const getGeoIcon = (tier: number | null | undefined) => {
  if (tier === 1) return "🏙️";
  if (tier === 2) return "🗺️";
  return null;
};

export const StoryCard = ({
  title,
  summary,
  imageUrl,
  category,
  url,
  sponsored = false,
  geoTier,
  geoLabel,
  meta,
}: StoryCardProps) => {
  const geoIcon = getGeoIcon(geoTier);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {imageUrl && (
        <div className="relative aspect-[3/2] overflow-hidden bg-slate-100">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              <img
                src={imageUrl}
                alt={title}
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </a>
          ) : (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
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

        {(meta?.time || meta?.source || geoIcon) && (
          <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-1">
            {geoIcon && geoLabel && (
              <span className="inline-flex items-center gap-0.5 text-slate-400">
                <span>{geoIcon}</span>
                <span className="text-[10px]">{geoLabel}</span>
              </span>
            )}
            {geoIcon && geoLabel && (meta?.source || meta?.time) && <span>•</span>}
            {meta?.source && <span>{meta.source}</span>}
            {meta?.source && meta?.time && <span>•</span>}
            {meta?.time && <span>{meta.time}</span>}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Read more
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span />
          )}
          {url && <ShareButtons title={title} url={url} />}
        </div>
      </div>
    </article>
  );
};
