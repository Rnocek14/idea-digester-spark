// Per-city theme/identity, loaded from city_config.theme with Lake Geneva as
// the built-in default so first paint never flashes or waits on the network.

export type CityTheme = {
  tagline: string;
  region_line: string;
  footer_kicker: string;
  editor_note: string;
  motif: "lake" | "river" | "coast" | "downtown" | "none";
  palette: Record<string, string>;
  signature: { feature_name: string; landmarks: string[] };
};

export type CityIdentity = {
  id: string;
  site_name: string;
  site_domain: string;
  city_name: string;
  theme: CityTheme;
};

export const DEFAULT_THEME: CityTheme = {
  tagline: "Local Edition",
  region_line: "Geneva Lake · Walworth County, Wisconsin",
  footer_kicker: "From the Shore Path",
  editor_note:
    "Curated from the shore path by Gina Nocek — a daily note for the people who call Geneva Lake home.",
  motif: "lake",
  palette: {
    "lake-light": "200 80% 82%",
    "lake-blue": "205 65% 68%",
    "lake-deep": "205 55% 38%",
    "lake-navy": "215 70% 35%",
    "shore-terracotta": "25 75% 42%",
    "lake-sand": "45 30% 96%",
  },
  signature: {
    feature_name: "Shore Path",
    landmarks: ["Yerkes Observatory", "Big Foot Beach", "Riviera Pier", "Streblow boats"],
  },
};

export const DEFAULT_IDENTITY: CityIdentity = {
  id: "default",
  site_name: "Lake Geneva Brief",
  site_domain: "lakegenevabrief.com",
  city_name: "Lake Geneva",
  theme: DEFAULT_THEME,
};

export function mergeIdentity(row: Partial<CityIdentity> & { theme?: Partial<CityTheme> } | null | undefined): CityIdentity {
  if (!row) return DEFAULT_IDENTITY;
  return {
    ...DEFAULT_IDENTITY,
    ...row,
    theme: {
      ...DEFAULT_THEME,
      ...(row.theme ?? {}),
      palette: { ...DEFAULT_THEME.palette, ...(row.theme?.palette ?? {}) },
      signature: { ...DEFAULT_THEME.signature, ...(row.theme?.signature ?? {}) },
    },
  };
}

/** Write the city palette onto :root so the Tailwind accent tokens follow the city. */
export function applyPaletteToRoot(palette: Record<string, string>): void {
  const root = document.documentElement;
  for (const [token, value] of Object.entries(palette)) {
    if (/^[a-z-]+$/.test(token) && /^[\d.\s%]+$/.test(value)) {
      root.style.setProperty(`--${token}`, value);
    }
  }
}
