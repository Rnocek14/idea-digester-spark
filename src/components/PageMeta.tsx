import { Helmet } from "react-helmet-async";

import { getSiteOrigin } from "@/lib/cityId";

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article";
  ogImage?: string;
  keywords?: string[];
}

/**
 * JSON-LD goes inside a <script> element, whose content is raw text. A literal
 * closing script tag in any string value — a story headline, an incident
 * summary, a publicly submitted job description — would end the element early
 * and the rest of the block would be parsed as markup. Escaping the angle
 * brackets as JSON unicode escapes is invisible to any JSON-LD consumer (a
 * JSON parser decodes them straight back) and makes that impossible. The two
 * line separators are escaped for the same reason. Mirrors jsonLdScript() in
 * supabase/functions/_shared/renderPage.ts.
 */
function serializeJsonLd(node: unknown): string {
  return JSON.stringify(node)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function PageMeta({ title, description, path, jsonLd, ogType = "website", ogImage, keywords }: PageMetaProps) {
  const url = `${getSiteOrigin()}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 ? (
        <meta name="keywords" content={keywords.join(", ")} />
      ) : null}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{serializeJsonLd(ld)}</script>
      ))}
    </Helmet>
  );
}