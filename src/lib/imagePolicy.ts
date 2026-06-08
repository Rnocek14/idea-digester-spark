/**
 * Image policy for story cards.
 * - Drops TV-station weather screenshots, generic station logos, and other
 *   low-quality off-brand assets.
 * - When the image is rejected, callers should fall back to the curated
 *   civic/category fallback set (see getCategoryFallbackImage).
 */

// Hostnames whose images we never trust as story art (mostly TV stations
// whose feeds are dominated by weather radar screenshots and station logos).
const BLOCKED_IMAGE_HOSTS = [
  "cbs58.com",
  "fox6now.com",
  "tmj4.com",
  "wisn.com",
  "weather.com",
  "weather.gov",
  "channel3000.com",
  "wkow.com",
  "wmtv15news.com",
  "nbc15.com",
  "spectrumnews1.com",
  "wsaw.com",
];

// URL substrings that strongly indicate weather radar / forecast graphics.
const BLOCKED_URL_FRAGMENTS = [
  "/weather/",
  "weather-radar",
  "forecast",
  "radar",
  "doppler",
  "snow-map",
  "temperature-map",
];

export const isAllowedStoryImage = (
  imageUrl: string | null | undefined,
  category: string | null | undefined,
): boolean => {
  if (!imageUrl) return false;
  let host = "";
  let path = "";
  try {
    const u = new URL(imageUrl);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return false;
  }

  if (BLOCKED_IMAGE_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
    return false;
  }

  // Only screen for weather fragments on non-weather categories — weather
  // alerts legitimately use radar imagery if we ever surface them.
  const cat = (category || "").toLowerCase();
  if (cat !== "weather" && BLOCKED_URL_FRAGMENTS.some((f) => path.includes(f))) {
    return false;
  }
  return true;
};