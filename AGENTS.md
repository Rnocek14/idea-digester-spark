# Project rules

- Keep the official Shore Path leg distances in the pure `shorePathPlanning` module and reuse its total in the guide and homepage; this prevents contradictory route-length claims and makes the sourced distances testable.
- Keep only sitewide tags (site name, card type, verification, JSON-LD) in `src/routes/__root.tsx` and let each public page set its title, description and og tags through PageMeta; server-rendered HTML ships every rendered tag, so root defaults would duplicate and override page tags for crawlers.
- Give every public page its own file route under `src/routes/` and list guides in the sitemap generator; server rendering ships each route as crawlable HTML, and a test keeps guides and sitemap in sync.
