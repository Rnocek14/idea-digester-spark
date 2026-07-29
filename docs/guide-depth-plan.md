# Guide depth: where every evergreen page stands, and what's next

Last measured: 2026-07-29, against `src/pages/guides/*.tsx`. All prose guides deepened.

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

### First tier (2026-07)

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

### Second tier — also complete

| Guide | Before | After |
| --- | ---: | ---: |
| Public access guide | 764 | 3,816 |
| Winter | 680 | 3,236 |
| Summer | 618 | 3,084 |
| Where to stay | 919 | 3,025 |
| Why people love Lake Geneva | 412 | 2,863 |
| Things to do in Lake Geneva | 1,020 | 2,810 |
| This weekend | 700 | 2,612 |
| Lake Geneva FAQ | 1,106 | 2,589 |

Every prose guide now clears 1,500 words. Nothing on the list is thin.

Not included and deliberately so: the guides index, webcams, weather and
market report are data-backed surfaces, not prose targets. `LakeGenevaShorePathStop`
is a template that renders database content per stop — its depth lives in the
database.

## What the adversarial review caught

Each depth pass was paired with a reviewer told to *refute* it: grep every
added price, date and figure against `HEAD`, and strip anything not already
there. That is not ceremony — it caught real fabrications both rounds, and
they were the plausible-sounding kind that survive a casual read:

- A claim that a Wisconsin **annual state park sticker is honored at other
  parks**. Nothing supports reciprocity, and it invited exactly the cost
  arithmetic these pages refuse to print.
- **"Two of the four resorts aren't in the City of Lake Geneva"** — the two
  names were supported, the count was not, and was probably wrong.
- A claim the **Shore Path easement predates the lakefront homes**, which
  inverts our own Shore Path guide: the 1870s easement was granted *by* those
  owners, so it is contemporaneous.
- A cross-reference promising the Shore Path guide hedges the **Potawatomi
  origin story**. It hedges the 1870s date and never mentions the Potawatomi.
- Two **exclusivity superlatives** ("the only continuous route") with nothing
  behind them.
- **Winter ice presented as a recommended activity** with no condition caveat.

Take the general lesson: a single generate-then-ship pass will publish
confident, wrong, locally-specific claims. The refute pass is the control.

### Cross-guide contradictions

Independent passes over sibling pages produce pages that disagree, and readers
and search engines both notice. Fixed so far:

- Max lake depth: 144 ft (FAQ) vs 135 ft (weather guide). 135 is the DNR
  figure and the one consistent with the ~62 ft average.
- Drive times to Chicago/Milwaukee stated as "90 minutes to both" in three
  guides, contradicting the moving-to guide's ~80 mi / ~50 mi.
- Milwaukee given as a precise 55 minutes where three guides say 50–70.
- Big Foot Beach placed on the south shore; its own guide says southeast, and
  the same file assigns the south shore to Linn.
- "Ten minutes to Williams Bay or Fontana" — Williams Bay is ten, Fontana
  nearer twenty.
- Peak water temperature ~75°F vs 75–80°F.

**A cross-guide consistency sweep is now a required step**, not an optional
one, any time more than one guide is edited in a batch.

### Contested facts

Where sources genuinely disagree, name the source of record rather than
choosing silently. Lake acreage is the worked example: the FAQ asserted 5,400
acres, the DNR lists about 5,260. Both figures now appear with the DNR named.
A site whose pitch is being more trustworthy than the aggregators has to show
which number it trusts and why.

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
