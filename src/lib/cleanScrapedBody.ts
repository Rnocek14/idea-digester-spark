/**
 * Strip scraper artifacts out of a story body before it reaches a reader.
 *
 * Stories arrive as Firecrawl markdown. When the AI voice-rewrite step runs,
 * readers see rewritten prose and none of this matters. That step has been
 * failing since 2026-08-01 (the AI provider returns 429), so every story
 * published since then renders its RAW scrape — which begins, verbatim:
 *
 *   [Skip to main content](https://lakegenevanews.net/news/local/collection_…
 *
 * That string is the first thing a reader sees on the page AND the first
 * thing a search engine sees, because the meta description is sliced from the
 * same field. Cleaning it is not cosmetic: it is the difference between a
 * story page and a page that looks broken.
 *
 * Deliberately narrow. It removes navigation chrome and markdown plumbing —
 * artifacts nobody chose to publish. It does NOT shorten, summarize, or
 * rewrite: how much of a source's article to show is an editorial decision,
 * not something a display helper should quietly make.
 */

// Link/heading text that is site furniture rather than article content.
const NAV_TEXT =
  /^(skip to (main )?content|menu|close|search|subscribe|log ?in|sign ?in|sign ?up|register|home|share|share this|print|comments?|newsletters?|advertisement|sponsored|related stories|most popular|facebook|twitter|instagram|linkedin|email|copy link|back to top)$/i;

export function cleanScrapedBody(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);

  // 1. Images carry no meaning once out of their layout: ![alt](url)
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // 2. Links become their text; navigation links disappear entirely.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, (_m, text: string) =>
    NAV_TEXT.test(text.trim()) ? "" : text,
  );

  // 3. Bare URLs left behind by the scraper.
  s = s.replace(/^\s*https?:\/\/\S+\s*$/gm, "");

  // 4. Lines that are nothing but furniture.
  s = s
    .split("\n")
    .filter((line) => !NAV_TEXT.test(line.trim().replace(/^#+\s*/, "")))
    .join("\n");

  // 5. Collapse the whitespace the removals leave behind.
  return s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Single-line excerpt for meta descriptions and cards. */
export function scrapedExcerpt(raw: string | null | undefined, max = 180): string {
  const clean = cleanScrapedBody(raw).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Cut on a word boundary so a description never ends mid-word.
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
