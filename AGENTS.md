# Project rules

- Keep the official Shore Path leg distances in the pure `shorePathPlanning` module and reuse its total in the guide and homepage; this prevents contradictory route-length claims and makes the sourced distances testable.
- Keep homepage social defaults in a root-level Helmet in `src/routes/__root.tsx` and per-page tags in PageMeta; pages are server-rendered, so non-JavaScript crawlers read both and the innermost page tags win.
- Give every public page its own file route under `src/routes/` and list guides in the sitemap generator; server rendering ships each route as crawlable HTML, and a test keeps guides and sitemap in sync.
