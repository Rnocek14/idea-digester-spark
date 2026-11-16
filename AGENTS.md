# Project rules

- Keep the official Shore Path leg distances in the pure `shorePathPlanning` module and reuse its total in the guide and homepage; this prevents contradictory route-length claims and makes the sourced distances testable.
- Keep homepage social fallbacks in index.html and remove superseded tags in prerendered HTML; non-JavaScript crawlers need defaults without duplicate route metadata.
- Include static business detail pages in the prerender route list so their verified content and metadata can ship as crawlable HTML.