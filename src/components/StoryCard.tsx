import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";
type StoryCardProps = {
  id?: string;
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
    case "weather": return "🌧️";
    case "civic": return "🏛️";
    default: return "📍";
  }
};

const getGeoIcon = (tier: number | null | undefined) => {
  if (tier === 1) return "🏙️";
  if (tier === 2) return "🗺️";
  return null;
};

// Category-specific fallback images - multiple options per category for variety
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  weather: [
    "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80",
    "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80",
    "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80",
  ],
  news: [
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80",
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80",
    "https://images.unsplash.com/photo-1478100913575-461e1e7c4e99?w=800&q=80",
  ],
  events: [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80",
  ],
  dining: [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
  ],
  community: [
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80",
    "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
  ],
  schools: [
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
    "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&q=80",
  ],
  real_estate: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  ],
  civic: [
    "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=80",
    "https://images.unsplash.com/photo-1523292562811-8fa7962a78c8?w=800&q=80",
    "https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
  ],
};

// Simple hash function for consistent fingerprint-based selection
const hashString = (str: string): number => {
  return str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
};

const getFallbackImage = (category: string | null, title: string): string => {
  const cat = category?.toLowerCase() || 'default';
  const images = CATEGORY_FALLBACKS[cat] || CATEGORY_FALLBACKS.default;
  const hash = hashString(title);
  return images[hash % images.length];
};

export const StoryCard = ({
  id,
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
  const fallbackImage = getFallbackImage(category, title);
  const [imgSrc, setImgSrc] = useState(imageUrl || fallbackImage);
  
  const handleImageError = () => {
    if (imgSrc !== fallbackImage) {
      setImgSrc(fallbackImage);
    }
  };
  
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[3/2] overflow-hidden bg-slate-100">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            <img
              src={imgSrc}
              alt={title}
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              onError={handleImageError}
            />
          </a>
        ) : (
          <img
            src={imgSrc}
            alt={title}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onError={handleImageError}
          />
        )}
        {category && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur pointer-events-none">
            {getCategoryEmoji(category)}{" "}
            <span className="capitalize">{category.replace('_', ' ')}</span>
          </span>
        )}
      </div>

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
