import { useState } from "react";
import { CheckCircle2, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { storyPath } from "@/lib/slug";

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
  priority?: boolean; // Hint that this is the LCP candidate
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

// Geo-tier label configuration - styled pills for visual clarity
const GEO_TIER_CONFIG = {
  1: { 
    label: 'Lake Geneva', 
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  2: { 
    label: 'Walworth', 
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  0: { 
    label: 'Wisconsin', 
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
  },
} as const;

const getGeoInfo = (tier: number | null | undefined, label?: string | null) => {
  if (tier === 1) return { ...GEO_TIER_CONFIG[1], customLabel: label };
  if (tier === 2) return { ...GEO_TIER_CONFIG[2], customLabel: label };
  if (tier === 0) return { ...GEO_TIER_CONFIG[0], customLabel: label };
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
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
    "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80", // government building
    "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80", // american flag on building
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
  priority = false,
  geoTier,
  geoLabel,
  sourceType,
  trustLabels,
  meta,
}: StoryCardProps) => {
  const geoInfo = getGeoInfo(geoTier, geoLabel);
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
      <div className={`relative overflow-hidden bg-stone-100 rounded-md ${featured ? 'aspect-[16/9] max-h-[320px]' : 'aspect-[2/1] max-h-[280px]'}`}>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            <img
              src={imgSrc}
              alt={title}
              width={1280}
              height={featured ? 720 : 640}
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
              loading={priority ? "eager" : "lazy"}
              // @ts-expect-error fetchpriority is a valid HTML attr; React types lag
              fetchpriority={priority ? "high" : undefined}
              decoding={priority ? "sync" : "async"}
              onError={handleImageError}
            />
          </a>
        ) : (
          <img
            src={imgSrc}
            alt={title}
            width={1280}
            height={featured ? 720 : 640}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
            loading={priority ? "eager" : "lazy"}
            // @ts-expect-error fetchpriority is a valid HTML attr; React types lag
            fetchpriority={priority ? "high" : undefined}
            decoding={priority ? "sync" : "async"}
            onError={handleImageError}
          />
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
            <h3
              className={`text-slate-900 group-hover:text-slate-600 transition-colors line-clamp-2 leading-[1.15] font-bold tracking-tight ${featured ? 'text-2xl sm:text-[28px]' : 'text-lg sm:text-xl'}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {title}
            </h3>
          </a>
        ) : (
          <h3
            className={`text-slate-900 line-clamp-2 leading-[1.15] font-bold tracking-tight ${featured ? 'text-2xl sm:text-[28px]' : 'text-lg sm:text-xl'}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {title}
          </h3>
        )}

        {summary && (
          <p className="mt-1.5 text-[14px] text-slate-600 line-clamp-2 leading-relaxed">
            {summary}
          </p>
        )}

        {(meta?.time || meta?.source || (geoInfo && geoTier !== 1)) && (
          <p className="mt-2 text-[12px] text-slate-500 flex items-center gap-x-1.5 flex-wrap">
            {/* Only show geo chip when it's an EXCEPTION (Walworth/Wisconsin), never default Lake Geneva */}
            {geoInfo && geoTier !== 1 && (
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${geoInfo.className}`}>
                {geoInfo.customLabel || geoInfo.label}
              </span>
            )}
            {meta?.source && <span>{meta.source}</span>}
            {meta?.source && meta?.time && <span className="text-slate-300">·</span>}
            {meta?.time && <span>{meta.time}</span>}
          </p>
        )}
        {id && (
          <p className="mt-1 text-[11px] text-slate-400">
            <Link
              to={storyPath(id, title)}
              className="hover:text-blue-700 hover:underline underline-offset-2"
              aria-label={`Permalink for "${title}"`}
            >
              Permalink
            </Link>
          </p>
        )}
      </div>
    </article>
  );
};
