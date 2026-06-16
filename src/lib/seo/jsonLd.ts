// JSON-LD helpers for guide pages.
// Keep schema minimal but valid — Google rejects partially-malformed schemas.

const SITE = "https://lakegenevabrief.com";

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
    url: `${SITE}${opts.path}`,
    mainEntityOfPage: `${SITE}${opts.path}`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    image: opts.image,
    publisher: {
      "@type": "Organization",
      name: "Lake Geneva Brief",
      url: SITE,
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
      item: `${SITE}${c.path}`,
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
    url: `${SITE}${opts.parentPath}`,
    numberOfItems: opts.stops.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: opts.stops.map((s, i) => {
      const attraction: Record<string, unknown> = {
        "@type": "TouristAttraction",
        name: s.name,
        url: `${SITE}${opts.parentPath}#stop-${s.slug}`,
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