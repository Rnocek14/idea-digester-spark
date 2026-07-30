// The static (non-database) route table for a city site, in ONE place.
//
// WHY THIS FILE EXISTS
// serve-sitemap and serve-llms both need to answer "which fixed URLs does THIS
// city actually have?". Before this file, serve-sitemap carried ~25 hardcoded
// lake-geneva-* paths and public/llms.txt carried a second, drifted copy of the
// same list. On city #2 both would have advertised Lake Geneva URLs on someone
// else's domain.
//
// THE SPLIT
//   UNIVERSAL_ROUTES  — pages whose content comes from the database, so they
//                       exist and are meaningful for every city in the fleet.
//   TEMPLATE_CITY_ROUTES — pages whose content is hand-written Lake Geneva
//                       editorial living in React components (all 24 guides,
//                       the market report, the webcam and weather pages). They
//                       exist ONLY for the template city.
//
// PER-CITY GUIDES ARE UNBUILT WORK. There is currently no mechanism — no table,
// no generator, no per-city component — that produces a guide for city #2.
// Until there is, a non-template city emits none of these routes. Do not "fix"
// this by emitting the slugs for every city: that would submit URLs that render
// Lake Geneva prose (or a 404) on another town's domain. See the sitemap
// section of docs/ for the fleet plan.

import type { CityConfig } from "./cityConfig.ts";

/**
 * The city_config row id that owns the hand-written guide content. This is the
 * template row every other city is cloned from — the same id getCityConfig()
 * falls back to. It is a config key, not a hardcoded city: a city's identity
 * still comes entirely from its row.
 */
export const TEMPLATE_CITY_ID = "default";

export type SiteRoute = {
  path: string;
  /** Link text in llms.txt. */
  title: string;
  /**
   * One line for llms.txt describing what the page IS. `{city}` and `{state}`
   * are substituted from city_config. NO facts here — no prices, hours, phone
   * numbers or counts. Describe the page, never its contents.
   */
  blurb: string;
  changefreq?: string;
  priority?: string;
  /** llms.txt grouping. */
  section: "core" | "guides" | "optional";
  /** Omit from the XML sitemap (forms, machine endpoints). Default: included. */
  sitemap?: false;
};

/**
 * Routes every city has. Each is rendered from database rows scoped by city_id,
 * so the page is correct for whichever city's domain it is served on — even
 * when that city's table is still empty.
 */
export const UNIVERSAL_ROUTES: SiteRoute[] = [
  {
    path: "/",
    title: "Home",
    blurb: "Local headlines, events and community updates for {city}.",
    changefreq: "hourly",
    priority: "1.0",
    section: "core",
  },
  {
    path: "/today",
    title: "Today",
    blurb: "The day's brief — what published today, on one page.",
    changefreq: "hourly",
    priority: "1.0",
    section: "core",
  },
  {
    path: "/events",
    title: "Events Calendar",
    blurb: "Upcoming events compiled from local calendars and venue listings.",
    changefreq: "daily",
    priority: "0.9",
    section: "core",
  },
  {
    path: "/incidents",
    title: "Incidents",
    blurb:
      "Current public-safety, weather, road and utility incidents. Every entry names the source of record it came from.",
    changefreq: "daily",
    priority: "0.7",
    section: "core",
  },
  {
    // PRECONDITION: this path is served by the serve-page edge function and
    // needs the host-level rewrite described in that function's header. With no
    // rewrite the SPA renders its not-found route, which is a soft 404.
    path: "/incidents/archive",
    title: "Incident Archive",
    blurb: "The historical incident record, paginated, oldest entries included.",
    changefreq: "daily",
    priority: "0.6",
    section: "core",
  },
  {
    path: "/eats",
    title: "Eats",
    blurb: "Restaurants and dining in and around {city}.",
    changefreq: "weekly",
    priority: "0.8",
    section: "core",
  },
  {
    path: "/nightlife",
    title: "Nightlife",
    blurb: "Live music, bars and evening listings.",
    changefreq: "daily",
    priority: "0.8",
    section: "core",
  },
  {
    path: "/jobs",
    title: "Jobs",
    blurb: "Job listings posted in and around {city}.",
    changefreq: "daily",
    priority: "0.8",
    section: "core",
  },
  {
    path: "/deals",
    title: "Deals",
    blurb: "Offers currently posted by area businesses.",
    changefreq: "weekly",
    priority: "0.7",
    section: "core",
  },
  {
    path: "/directory",
    title: "Business Directory",
    blurb: "Local businesses, shops and services.",
    changefreq: "weekly",
    priority: "0.8",
    section: "core",
  },
  {
    path: "/community/local-love",
    title: "Local Love",
    blurb: "Reader-submitted appreciation for local businesses and neighbors.",
    changefreq: "weekly",
    priority: "0.7",
    section: "core",
  },
  {
    path: "/community/voices",
    title: "Community Voices",
    blurb: "Reader-submitted perspectives from around {city}.",
    changefreq: "weekly",
    priority: "0.7",
    section: "core",
  },
  {
    path: "/about",
    title: "About",
    blurb: "Who publishes this, how the newsroom works, and how to reach it.",
    changefreq: "monthly",
    priority: "0.5",
    section: "optional",
  },
  {
    path: "/advertise",
    title: "Advertise",
    blurb: "Sponsorship and advertising options.",
    changefreq: "monthly",
    priority: "0.6",
    section: "optional",
  },
  {
    path: "/jobs/post",
    title: "Post a Job",
    blurb: "Employer-facing job posting form.",
    section: "optional",
    sitemap: false,
  },
];

/**
 * Hand-written Lake Geneva editorial. Served only for TEMPLATE_CITY_ID.
 *
 * Blurbs describe what each page covers. They deliberately assert no facts —
 * no distances, dates, fees or hours — because this text is emitted verbatim to
 * crawlers and language models, which will repeat it.
 */
export const TEMPLATE_CITY_ROUTES: SiteRoute[] = [
  {
    path: "/guides",
    title: "All Guides",
    blurb: "Index of the cornerstone guides — landmarks, things to do, moving, neighborhoods, reference.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-shore-path",
    title: "Lake Geneva Shore Path",
    blurb: "The public path around Geneva Lake, stop by stop.",
    changefreq: "weekly",
    priority: "0.95",
    section: "guides",
  },
  {
    path: "/guides/yerkes-observatory",
    title: "Yerkes Observatory",
    blurb: "The observatory in Williams Bay — history and what a visit involves.",
    changefreq: "monthly",
    priority: "0.95",
    section: "guides",
  },
  {
    path: "/guides/big-foot-beach-state-park",
    title: "Big Foot Beach State Park",
    blurb: "The state park on the lake — beach, campground, trails and parking.",
    changefreq: "monthly",
    priority: "0.95",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-public-access-guide",
    title: "Public Access to the Lake",
    blurb: "Public beaches, boat launches and shoreline entry points.",
    changefreq: "monthly",
    priority: "0.85",
    section: "guides",
  },
  {
    path: "/guides/where-to-stay-lake-geneva",
    title: "Where to Stay in Lake Geneva",
    blurb: "How the lodging around the lake differs, by area and type.",
    changefreq: "weekly",
    priority: "0.95",
    section: "guides",
  },
  {
    path: "/guides/things-to-do-lake-geneva",
    title: "Things to Do in Lake Geneva",
    blurb: "A running list of what is worth doing, kept current.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/things-to-do-lake-geneva-this-weekend",
    title: "This Weekend in Lake Geneva",
    blurb: "Friday-through-Sunday picks, refreshed weekly.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/things-to-do-lake-geneva-with-kids",
    title: "Lake Geneva with Kids",
    blurb: "Family-friendly activities around the lake.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/best-things-to-do-lake-geneva-in-summer",
    title: "Lake Geneva in Summer",
    blurb: "Peak-season picks.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/things-to-do-lake-geneva-in-winter",
    title: "Lake Geneva in Winter",
    blurb: "Off-season picks.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/moving-to-lake-geneva",
    title: "Moving to Lake Geneva",
    blurb: "An honest move-here guide — pace, costs, neighborhoods, schools.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-neighborhoods",
    title: "Lake Geneva Neighborhoods",
    blurb: "How the areas around the lake differ from one another.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-schools",
    title: "Lake Geneva Schools",
    blurb: "The public and private schools serving the lake area.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/cost-of-living-lake-geneva",
    title: "Cost of Living in Lake Geneva",
    blurb: "Housing, taxes and utilities, and what tends to surprise newcomers.",
    changefreq: "monthly",
    priority: "0.8",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-vs-williams-bay",
    title: "Lake Geneva vs Williams Bay",
    blurb: "A comparison of the two towns for visitors and movers.",
    changefreq: "monthly",
    priority: "0.8",
    section: "guides",
  },
  {
    path: "/guides/fontana-vs-lake-geneva",
    title: "Fontana vs Lake Geneva",
    blurb: "West end and east end of the lake, compared.",
    changefreq: "monthly",
    priority: "0.8",
    section: "guides",
  },
  {
    path: "/guides/why-people-love-lake-geneva",
    title: "Why People Love Lake Geneva",
    blurb: "What keeps people coming back, and moving here.",
    changefreq: "monthly",
    priority: "0.7",
    section: "guides",
  },
  {
    path: "/guides/streblow-boats-geneva-lake",
    title: "Streblow Boats",
    blurb: "The wooden boats built on Geneva Lake, and the family that builds them.",
    changefreq: "monthly",
    priority: "0.8",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-faq",
    title: "Lake Geneva FAQ",
    blurb: "The questions visitors and newcomers actually ask.",
    changefreq: "monthly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/eats/fish-fry",
    title: "Fish Fry Guide",
    blurb: "The Friday fish fry directory for the area.",
    changefreq: "weekly",
    priority: "0.8",
    section: "guides",
  },
  // Routes that exist on the live site and are already indexed. They were added to
  // main while this fleet refactor was in flight, and are listed here so replacing the
  // old hardcoded STATIC_ENTRIES does not silently drop live URLs out of the sitemap.
  {
    path: "/guides/lake-geneva-winterfest",
    title: "Lake Geneva Winterfest",
    blurb: "The National Snow Sculpting Championship and the winter festival around it.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-shore-path/register",
    title: "Shore Path register",
    blurb: "Log the sections of the path you have walked.",
    changefreq: "weekly",
    priority: "0.7",
    section: "guides",
  },
  {
    path: "/guides/lake-geneva-shore-path/passport",
    title: "Shore Path passport",
    blurb: "Track progress around the whole 21 miles.",
    changefreq: "monthly",
    priority: "0.7",
    section: "guides",
  },
  {
    path: "/best-of/lake-geneva",
    title: "Best of Lake Geneva",
    blurb: "The standing picks across the lake area.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/best-of/restaurants-lake-geneva",
    title: "Best Restaurants in Lake Geneva",
    blurb: "A ranked restaurant guide for the lake area.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/lake-geneva-webcams",
    title: "Lake Geneva Webcams",
    blurb: "Working live cameras pointed at the lake.",
    changefreq: "weekly",
    priority: "0.85",
    section: "guides",
  },
  {
    path: "/lake-geneva-weather",
    title: "Lake Geneva Weather",
    blurb: "Current conditions, marine forecast and seasonal outlook.",
    changefreq: "daily",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/market-report",
    title: "Lake Geneva Market Report",
    blurb: "Real estate market conditions around the lake.",
    changefreq: "monthly",
    priority: "0.9",
    section: "guides",
  },
  {
    path: "/selling-lake-geneva",
    title: "Selling in Lake Geneva",
    blurb: "A guide for homeowners weighing a sale on the lake.",
    changefreq: "weekly",
    priority: "0.9",
    section: "guides",
  },
];

/** True when this city owns the hand-written guide content. */
export function isTemplateCity(config: Pick<CityConfig, "id">): boolean {
  return config.id === TEMPLATE_CITY_ID;
}

/**
 * The static routes that genuinely exist for this city. A non-template city
 * gets the universal, database-backed pages and nothing else — see the note at
 * the top of this file about per-city guides being unbuilt.
 */
export function staticRoutesFor(config: Pick<CityConfig, "id">): SiteRoute[] {
  return isTemplateCity(config)
    ? [...UNIVERSAL_ROUTES, ...TEMPLATE_CITY_ROUTES]
    : [...UNIVERSAL_ROUTES];
}

/** Substitute the city placeholders in a blurb. */
export function fillBlurb(blurb: string, config: Pick<CityConfig, "city_name" | "state_code">): string {
  return blurb
    .replaceAll("{city}", config.city_name || "this city")
    .replaceAll("{state}", config.state_code || "");
}
