// JSON-LD helpers for guide pages.
// Keep schema minimal but valid — Google rejects partially-malformed schemas.

import { getSiteOrigin } from "@/lib/cityId";
import { DEFAULT_IDENTITY } from "@/lib/cityTheme";

// Resolved per request rather than hardcoded — see getSiteOrigin. A fixed host here
// would make every city in the fleet claim to be Lake Geneva.
const site = () => getSiteOrigin();

/**
 * The publishing organisation's name, for the author/publisher fields below.
 *
 * FLEET-SAFE, same contract as site(): no brand string is written here. A
 * literal would ride the shared bundle onto every city's domain and credit one
 * town's masthead as the publisher of another town's guides — the JSON-LD
 * equivalent of the canonical bug getSiteOrigin() exists to prevent. Callers
 * that have resolved the city pass its site_name; the default city row shipped
 * in cityTheme.ts is the fallback.
 */
const siteName = (name?: string | null) =>
  String(name ?? "").trim() || DEFAULT_IDENTITY.site_name;

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  /** The resolved city's site_name, when the caller has it. */
  siteName?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: `${site()}${opts.path}`,
    mainEntityOfPage: `${site()}${opts.path}`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    image: opts.image,
    // Google weighs authorship for local informational content, and an Article with no
    // author at all is a weaker entity than one with a named organization behind it.
    // This is an Organization rather than a Person deliberately: guides are written and
    // maintained by the desk, not by a byline, and inventing a person to satisfy a schema
    // field would be the same fabrication these pages spent a whole audit removing.
    author: {
      "@type": "Organization",
      name: siteName(opts.siteName),
      url: site(),
    },
    publisher: {
      "@type": "Organization",
      name: siteName(opts.siteName),
      url: site(),
    },
  };
}

export function breadcrumbJsonLd(crumbs: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${site()}${c.path}`,
    })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}

/**
 * ItemList of TouristAttractions for stop-by-stop guides (e.g. Shore Path).
 * Each stop becomes a TouristAttraction with name, description, and (when
 * available) GeoCoordinates. The list anchors at the parent guide URL so
 * crawlers attribute the collection to that page.
 */
export function stopsItemListJsonLd(opts: {
  parentPath: string;
  parentName: string;
  stops: Array<{
    slug: string;
    name: string;
    description?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    image?: string | null;
  }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.parentName,
    url: `${site()}${opts.parentPath}`,
    numberOfItems: opts.stops.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: opts.stops.map((s, i) => {
      const attraction: Record<string, unknown> = {
        "@type": "TouristAttraction",
        name: s.name,
        url: `${site()}${opts.parentPath}#stop-${s.slug}`,
      };
      if (s.description) attraction.description = s.description;
      if (s.image) attraction.image = s.image;
      if (typeof s.latitude === "number" && typeof s.longitude === "number") {
        attraction.geo = {
          "@type": "GeoCoordinates",
          latitude: s.latitude,
          longitude: s.longitude,
        };
      }
      return {
        "@type": "ListItem",
        position: i + 1,
        item: attraction,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// JobPosting
//
// Google Jobs is the one distribution surface on this site that does not
// depend on ranking against an incumbent: a valid JobPosting block is eligible
// for the jobs experience on its own merits. The rules below are Google's, not
// preferences — a block missing title, description, datePosted,
// hiringOrganization or jobLocation is rejected outright, and a block that
// asserts something the row does not contain is worse than no block at all.
//
// Every optional property here is emitted ONLY when the row genuinely carries
// the data. Nothing is inferred, defaulted, or filled in with a placeholder.
// ---------------------------------------------------------------------------

/** The subset of a job_listings row this schema is allowed to read. */
export type JobPostingSource = {
  id: string;
  title: string;
  description: string;
  business_name: string;
  created_at?: string | null;
  expires_at?: string | null;
  job_type?: string | null;
  location_text?: string | null;
  pay_min?: number | null;
  pay_max?: number | null;
  pay_type?: string | null;
};

/** The resolved city, as city_config describes it. */
export type JobPostingPlace = {
  city_name?: string | null;
  state_code?: string | null;
  site_domain?: string | null;
};

/**
 * job_type is a free-text column fed by a <Select>, so only the values that
 * map cleanly onto schema.org's enumeration are emitted. Anything unrecognised
 * yields no employmentType at all rather than a guess.
 */
const EMPLOYMENT_TYPES: Record<string, string> = {
  "full-time": "FULL_TIME",
  full_time: "FULL_TIME",
  fulltime: "FULL_TIME",
  "part-time": "PART_TIME",
  part_time: "PART_TIME",
  parttime: "PART_TIME",
  contract: "CONTRACTOR",
  contractor: "CONTRACTOR",
  seasonal: "TEMPORARY",
  temporary: "TEMPORARY",
  temp: "TEMPORARY",
  internship: "INTERN",
  intern: "INTERN",
  volunteer: "VOLUNTEER",
  "per-diem": "PER_DIEM",
};

/** pay_type -> schema.org unitText. Unmapped means no baseSalary is emitted. */
const PAY_UNITS: Record<string, string> = {
  hourly: "HOUR",
  hour: "HOUR",
  salary: "YEAR",
  yearly: "YEAR",
  annual: "YEAR",
  weekly: "WEEK",
  monthly: "MONTH",
  daily: "DAY",
};

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Plain text for a JSON-LD string value.
 *
 * job_listings rows are SUBMITTED BY THE PUBLIC through /post-job, so every
 * string here is attacker-controlled. These nodes are serialised with
 * JSON.stringify and dropped inside a <script type="application/ld+json">
 * element, whose contents are raw text: a literal "</script>" in a job title
 * or description would end the element early and everything after it would be
 * parsed as markup. JSON escaping does not help — "<" is a legal JSON
 * character. So markup is stripped and any stray angle bracket is removed
 * before the value can reach the serialiser. Newlines survive; a job
 * description is read by a human on the Google Jobs card.
 */
function text(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * One JobPosting node for one listing, or null when the row cannot satisfy
 * Google's required fields. Returning null is the correct outcome: a partial
 * JobPosting is an invalid one, and an invalid one taints the whole page.
 */
export function jobPostingJsonLd(
  job: JobPostingSource,
  city: JobPostingPlace = {}
): Record<string, unknown> | null {
  const id = text(job.id);
  const title = text(job.title);
  const description = text(job.description);
  const employer = text(job.business_name);
  const datePosted = isoOrNull(job.created_at);
  const locality = text(city.city_name);
  const region = text(city.state_code);
  const place = text(job.location_text);

  // jobLocation needs somewhere real to point. The city on the config row is
  // the only address this schema can honestly assert — job_listings has no
  // street address column — so without it there is no valid posting.
  if (!id || !title || !description || !employer || !datePosted || !locality) return null;

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    addressLocality: locality,
  };
  // state_code is what makes the locality unambiguous; the country follows
  // from it (city_config carries a US state code and nothing else).
  if (region) {
    address.addressRegion = region;
    address.addressCountry = "US";
  }

  const jobLocation: Record<string, unknown> = { "@type": "Place", address };
  // The employer's own wording for where the work happens ("Downtown",
  // "Grand Geneva"). Kept as a name, never promoted to a street address.
  if (place) jobLocation.name = place;

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted,
    hiringOrganization: {
      "@type": "Organization",
      name: employer,
    },
    jobLocation,
    identifier: {
      "@type": "PropertyValue",
      name: employer,
      value: id,
    },
    url: `${getSiteOrigin(city.site_domain)}/jobs#job-${id}`,
  };

  const validThrough = isoOrNull(job.expires_at);
  if (validThrough) node.validThrough = validThrough;

  const employmentType = EMPLOYMENT_TYPES[text(job.job_type).toLowerCase()];
  if (employmentType) node.employmentType = employmentType;

  // baseSalary is emitted only from the numeric pay columns, and only when
  // pay_type says what those numbers mean. pay_display is free text ("DOE",
  // "$16-20/hr") and is never parsed — guessing at a number from prose is
  // exactly the kind of invented fact this codebase does not publish.
  const unitText = PAY_UNITS[text(job.pay_type).toLowerCase()];
  const min = typeof job.pay_min === "number" && job.pay_min > 0 ? job.pay_min : null;
  const max = typeof job.pay_max === "number" && job.pay_max > 0 ? job.pay_max : null;
  if (unitText && (min || max)) {
    const value: Record<string, unknown> = { "@type": "QuantitativeValue", unitText };
    if (min && max && max > min) {
      value.minValue = min;
      value.maxValue = max;
    } else {
      value.value = min ?? max;
    }
    node.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value,
    };
  }

  return node;
}

/** Schema for every listing that can carry one. Unqualified rows are dropped. */
export function jobPostingsJsonLd(
  jobs: JobPostingSource[],
  city: JobPostingPlace = {}
): Array<Record<string, unknown>> {
  return jobs
    .map((job) => jobPostingJsonLd(job, city))
    .filter((node): node is Record<string, unknown> => node !== null);
}

export type LocalBusinessSource = {
  /** schema.org type — e.g. "GroceryStore", "LiquorStore", "IceCreamShop". */
  type?: string;
  name: string;
  description?: string;
  streetAddress: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  telephone?: string;
  /** The business's own website, not this site's page. */
  url?: string;
  /** Our page about the business. */
  path?: string;
  /** Human-readable hours, e.g. "Mo-Su 09:00-21:00". Only pass verified values. */
  openingHours?: string[];
};

/**
 * LocalBusiness schema for a single business page. Only verified fields are
 * emitted — unverified hours or phone numbers are simply omitted rather than
 * guessed, since a wrong number in schema is worse than no schema.
 */
export function localBusinessJsonLd(b: LocalBusinessSource): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": b.type || "LocalBusiness",
    name: b.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.streetAddress,
      addressLocality: b.addressLocality || "Lake Geneva",
      addressRegion: b.addressRegion || "WI",
      postalCode: b.postalCode || "53147",
      addressCountry: "US",
    },
  };
  if (b.description) node.description = b.description;
  if (b.telephone) node.telephone = b.telephone;
  if (b.url) node.url = b.url;
  if (b.openingHours && b.openingHours.length > 0) node.openingHours = b.openingHours;
  return node;
}
