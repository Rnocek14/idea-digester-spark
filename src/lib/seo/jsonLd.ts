// JSON-LD helpers for guide pages.
// Keep schema minimal but valid — Google rejects partially-malformed schemas.

import { getSiteOrigin } from "@/lib/cityId";

// Resolved per request rather than hardcoded — see getSiteOrigin. A fixed host here
// would make every city in the fleet claim to be Lake Geneva.
const site = () => getSiteOrigin();

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
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
      name: "Lake Geneva Brief",
      url: site(),
    },
    publisher: {
      "@type": "Organization",
      name: "Lake Geneva Brief",
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