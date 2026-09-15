// What should happen to a queued social post right now?
//
// Pulled out of `process-post-queue` so the decision is testable on its own:
// the surrounding function talks to the Twitter API, the database and the clock
// all in one loop, and the branch that decided Facebook and Instagram posts
// were "simulated" — written, then discarded — sat inside it unexercised.

export type SocialPlatform = "x" | "facebook" | "instagram" | "website";

export type PlatformToggles = {
  x: boolean;
  facebook: boolean;
  instagram: boolean;
};

export type PostRoute =
  /** An API is configured for this platform: post it now. */
  | { action: "api"; platform: SocialPlatform }
  /**
   * No API access, but the platform is switched on — park it for a human.
   * The post stays in the queue and shows up on the Post Today screen.
   */
  | { action: "manual"; platform: SocialPlatform; reason: string }
  /** The operator switched this platform off; leave the row alone. */
  | { action: "skip"; platform: SocialPlatform; reason: string };

/**
 * Platforms we can publish to without a human. Today that is X alone; adding
 * Meta means adding it here and giving `apiConfigured` a real answer for it.
 */
const API_CAPABLE: ReadonlySet<SocialPlatform> = new Set<SocialPlatform>(["x"]);

export function routePost(params: {
  platform: string;
  toggles: PlatformToggles;
  /** Whether working credentials exist for this platform right now. */
  apiConfigured: boolean;
}): PostRoute {
  const platform = params.platform as SocialPlatform;

  if (!isPlatformEnabled(platform, params.toggles)) {
    return {
      action: "skip",
      platform,
      reason: `${platform} is switched off in system_settings`,
    };
  }

  if (API_CAPABLE.has(platform) && params.apiConfigured) {
    return { action: "api", platform };
  }

  if (API_CAPABLE.has(platform)) {
    // An API-capable platform with no working credentials. Publishing it by
    // hand still beats dropping it.
    return {
      action: "manual",
      platform,
      reason: `${platform} credentials are not configured`,
    };
  }

  return {
    action: "manual",
    platform,
    reason: `no API access for ${platform} yet`,
  };
}

function isPlatformEnabled(platform: SocialPlatform, toggles: PlatformToggles): boolean {
  switch (platform) {
    case "x":
      return toggles.x;
    case "facebook":
      return toggles.facebook;
    case "instagram":
      return toggles.instagram;
    default:
      // "website" and anything unrecognised are not social sends; never queue
      // an unknown platform for a human who would not know where to post it.
      return false;
  }
}

/** Where the operator goes to publish a post of this kind by hand. */
export function composerUrl(platform: SocialPlatform): string | null {
  switch (platform) {
    case "facebook":
      return "https://www.facebook.com/";
    case "instagram":
      return "https://www.instagram.com/";
    case "x":
      return "https://x.com/compose/post";
    default:
      return null;
  }
}
