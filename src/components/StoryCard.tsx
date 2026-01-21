import { useState } from "react";
import { ExternalLink, CheckCircle2, Newspaper } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";

type TrustLabel = 'verified' | 'data_journalism' | 'sourced' | 'sponsored';

type StoryCardProps = {
  id?: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  url: string | null;
  sponsored?: boolean;
  featured?: boolean; // New: for lead story styling
  geoTier?: number | null;
  geoLabel?: string | null;
  sourceType?: 'sourced' | 'data_journalism' | 'original_reporting' | 'sponsored' | 'user_submitted' | null;
  trustLabels?: TrustLabel[] | null;
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
    "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80", // stormy sky
    "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80", // dramatic clouds
    "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80", // fog
    "https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80", // lightning
    "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=80", // winter snow
    "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80", // snowy trees
    "https://images.unsplash.com/photo-1445966275305-9806327ea2b5?w=800&q=80", // rain drops
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

// Better hash function using djb2 algorithm for more uniform distribution
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
};

const getFallbackImage = (category: string | null, title: string, id?: string): string => {
  const cat = category?.toLowerCase() || 'default';
  const images = CATEGORY_FALLBACKS[cat] || CATEGORY_FALLBACKS.default;
  // Use ID if available (more unique), otherwise fall back to title
  const hashInput = id || title;
  const hash = hashString(hashInput);
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
  featured = false,
  geoTier,
  geoLabel,
  sourceType,
  trustLabels,
  meta,
}: StoryCardProps) => {
  const geoIcon = getGeoIcon(geoTier);
  const fallbackImage = getFallbackImage(category, title, id);
  const [imgSrc, setImgSrc] = useState(imageUrl || fallbackImage);
  
  const handleImageError = () => {
    if (imgSrc !== fallbackImage) {
      setImgSrc(fallbackImage);
    }
  };

  // Determine trust badge to show (single, most important one)
  const isVerified = trustLabels?.includes('verified');
  const isDataJournalism = sourceType === 'data_journalism' || trustLabels?.includes('data_journalism');
  
  // Remove card border, add subtle image radius for warmth
  return (
    <article className="group flex h-full flex-col overflow-hidden bg-white">
      <div className={`relative overflow-hidden bg-slate-100 rounded ${featured ? 'aspect-[16/9]' : 'aspect-[2/1]'}`}>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            <img
              src={imgSrc}
              alt={title}
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              onError={handleImageError}
            />
          </a>
        ) : (
          <img
            src={imgSrc}
            alt={title}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={handleImageError}
          />
        )}
        {category && (
          <span className="absolute bottom-2 left-2 rounded-sm bg-white/90 px-1.5 py-0.5 text-[9px] font-mono text-slate-700 pointer-events-none uppercase tracking-wider">
            {category.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          {sponsored && (
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700">
              Sponsored
            </span>
          )}
          {/* Don't show Verified next to Sponsored to avoid implied endorsement */}
          {isVerified && !sponsored && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </span>
          )}
          {isDataJournalism && !isVerified && !sponsored && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
              <Newspaper className="h-3 w-3" />
              Based on Lake Geneva Eats data
            </span>
          )}
        </div>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <h3 className={`text-slate-900 group-hover:text-slate-600 transition-colors line-clamp-2 leading-snug font-bold ${featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
              {title}
            </h3>
          </a>
        ) : (
          <h3 className={`text-slate-900 line-clamp-2 leading-snug font-bold ${featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
            {title}
          </h3>
        )}

        {summary && (
          <p className="mt-1 text-[13px] text-slate-600 line-clamp-2 leading-relaxed">
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
