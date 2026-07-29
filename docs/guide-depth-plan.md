# Guide depth: where every evergreen page stands, and what's next

Last measured: 2026-07-29, against `src/pages/guides/*.tsx`.

Evergreen guides are the only part of this site that compounds. News decays
in days; a guide that ranks keeps pulling strangers in for years, and they
are what a new city gets on day one before it has any news history at all.
That makes guide depth a platform concern, not a Lake Geneva concern.

## Why depth matters here specifically

A 600-word guide loses to a 2,000-word one on almost every informational
query, because the longer page answers more of the follow-up questions in
the same session. But length only helps when it's *answers*. Padding a
guide with restated claims is worse than leaving it short — it dilutes the
page and, for a local news brand, risks publishing something we can't stand
behind.

**The rule this project works under: thin pages get more structure, not more
claims.** Concretely, that means depth comes from

- decision frameworks (which of these four things are you actually planning?)
- procedure (how to get the current number yourself, and from whom)
- mechanism (*why* a thing is the way it is, when we genuinely know)
- honest scoping (what this page deliberately doesn't cover, and why)

and never from invented prices, hours, phone numbers, statistics, or
first-hand claims we didn't earn. Where a fact is the account handed down
locally rather than something we verified, the page says so.

## Word counts

Measured from visible prose in the source, not the rendered page (rendered
counts run ~1.5x higher once nav, related links and footer chrome are
included).

### Deepened (2026-07)

| Guide | Before | After |
| --- | ---: | ---: |
| Shore Path | 2,169 | 2,727 |
| Cost of living | ~600 | 2,303 |
| Streblow boats | ~600 | 2,164 |
| Moving to Lake Geneva | 1,055 | 2,108 |
| Lake Geneva vs. Williams Bay | ~600 | 2,060 |
| Fontana vs. Lake Geneva | ~600 | 2,028 |
| Schools | ~600 | 1,933 |
| Yerkes Observatory | 754 | 1,813 |
| Neighborhoods | 1,203 | 1,752 |
| Big Foot Beach State Park | 766 | 1,709 |
| Things to do with kids | 723 | 1,542 |

### Still thin — ranked by what to do next

Ranked by search value against current depth, highest first.

| Rank | Guide | Words | Why it's worth the effort |
| ---: | --- | ---: | --- |
| 1 | Things to do in Lake Geneva | 1,020 | The head term. Highest volume of any guide here, and the page is mid-depth against national listicles that already outrank it. Hardest to win, biggest payoff. |
| 2 | Where to stay | 919 | Highest commercial intent on the site. Needs care — the answer is lodging *types* and trade-offs (resort vs. downtown vs. rental), never prices or a ranked hotel list. |
| 3 | Lake Geneva FAQ | 1,106 | Already broad but shallow per answer. Cheapest real win: it's pure long-tail surface and every answer can link to the guide that covers it properly. |
| 4 | Public access guide | 764 | Genuinely distinctive and hard for a national site to copy — every public beach, launch, and shoreline access point. Low competition, real local value. |
| 5 | Summer | 618 | Seasonal head term. Needs to become a planning page rather than a list. |
| 6 | Winter | 680 | Same, and less competitive than summer. |
| 7 | This weekend | 700 | Inherently ephemeral — its depth should come from the events feed, not prose. Lower priority as an evergreen target. |
| 8 | Why people love Lake Geneva | 412 | Thinnest page, but the weakest commercial intent. Deepen last, or fold into another guide. |

Not on this list and deliberately so: the guides index, webcams, weather and
market report are data-backed surfaces, not prose targets. `LakeGenevaShorePathStop`
is a template that renders database content per stop — its depth lives in the
database.

## Fleet implications

When this templates to other cities, the guide set is the part that does not
come free. News ingestion is automated; guides are not. Two consequences
worth designing around:

1. **The guide *shapes* port, the content doesn't.** "Cost of living in X"
   works in every city; the mill rates, the lake, and the Streblow equivalent
   do not. A new city needs its own local-identity guides, and the shapes in
   this repo — decision framework, procedure, mechanism — are the reusable
   part.
2. **The no-invented-facts rule has to be enforced mechanically, not by
   memory.** A per-city guide pipeline that generates prose is the obvious
   next step and the most dangerous one. Any such pipeline needs the same
   gate the editorial tier engine already applies to news: no prices, no
   hours, no phone numbers, no statistics without a named source, and
   explicit hedging on anything handed down rather than verified.

## Verification

`npm run build` prerenders every guide route to static HTML, so what a
crawler sees is checkable directly:

```
sed 's/<script[^>]*>.*<\/script>//g; s/<[^>]*>/ /g' dist/guides/<slug>/index.html | wc -w
```

CI asserts the prerendered output has real content, exactly one `og:title`,
and FAQ schema. See `.github/workflows/tests.yml`.
