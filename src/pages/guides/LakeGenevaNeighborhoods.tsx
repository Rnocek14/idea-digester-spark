import type { ReactNode } from "react";
import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Side-by-side comparison of the five options covered below. Every cell is a
 * compression of a sentence already written in the town sections — nothing
 * here introduces a fact the page doesn't otherwise support.
 */
const COMPARISON: {
  where: string;
  feel: string;
  walkability: string;
  lakeAccess: string;
  schools: string;
  tradeOff: string;
}[] = [
  {
    where: "Lake Geneva (city)",
    feel: "Busiest; heavy summer traffic",
    walkability: "Highest on the lake",
    lakeAccess: "Excellent — beach, parks, piers",
    schools: "LG–Genoa City Union HS + K–8 feeders",
    tradeOff: "Top prices and taxes; loud in July",
  },
  {
    where: "Fontana-on-Geneva-Lake",
    feel: "Calm, except regatta weekends",
    walkability: "Limited — drive for errands",
    lakeAccess: "Outstanding — beach, piers, swim area",
    schools: "Fontana J8 (K–8), then Big Foot HS",
    tradeOff: "Little within walking distance",
  },
  {
    where: "Williams Bay",
    feel: "Quiet year-round",
    walkability: "Tiny but real downtown",
    lakeAccess: "Excellent — Edgewater Park",
    schools: "Williams Bay (K–12), start to finish",
    tradeOff: "Amenities are genuinely limited",
  },
  {
    where: "Genoa City",
    feel: "Inland, rural, no visitor season",
    walkability: "No walkable downtown",
    lakeAccess: "None — not a lakefront town",
    schools: "Genoa City Joint 2 (K–8) + LG–GC Union HS",
    tradeOff: "In the area, not of the lake",
  },
  {
    where: "The townships (Linn, Geneva, Walworth)",
    feel: "Private and rural; larger lots",
    walkability: "None — longer drives",
    lakeAccess: "Varies by parcel; south shore closest",
    schools: "Depends entirely on the address",
    tradeOff: "Snow, internet, well/septic are yours",
  },
];

export default function LakeGenevaNeighborhoods() {
  return (
    <GuideShell
      title="Lake Geneva Neighborhoods: A Local's Guide"
      metaTitle="Lake Geneva Neighborhoods Guide — Fontana, Williams Bay & More (2026)"
      metaDescription="A neighborhood-by-neighborhood guide to Geneva Lake: Lake Geneva, Fontana, Williams Bay and Genoa City. Feel, pace, schools, lake access, and who tends to live where."
      path="/guides/lake-geneva-neighborhoods"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p className="mb-4">
            "Lake Geneva" is shorthand for a lot of things. There's the city of
            Lake Geneva on the lake's northeast corner. There's Geneva Lake
            itself, the body of water. And there are several small towns
            wrapped around it that each have very different rhythms — Fontana
            on the west end, Williams Bay on the north shore, Genoa City inland
            to the south, and a handful of townships filling in the gaps.
          </p>
          <p>
            For buyers, the differences are bigger than they look on a map.
            Williams Bay feels nothing like downtown Lake Geneva on a Saturday
            in July. Fontana attracts a different long-time community than the
            city does. The townships are quieter again. This guide walks
            through each, in the same voice The Brief uses every morning —
            honest, neighborly, and not selling you anything.
          </p>
        </>
      }
      sections={[
        {
          id: "orientation",
          heading: "Orientation: where each town sits on the lake",
          body: (
            <>
              <p className="mb-4">
                Geneva Lake is small enough that every town on it is a short
                drive from every other, and different enough that the drive
                still matters.
              </p>
              <dl className="space-y-3">
                <Fact term="Lake Geneva (city) — northeast corner">
                  The largest downtown, and the door most visitors come
                  through.
                </Fact>
                <Fact term="Williams Bay — north shore">
                  Halfway between the other two. Dining and shopping are an
                  8–12 minute drive either direction.
                </Fact>
                <Fact term="Fontana-on-Geneva-Lake — west end">
                  The far end of the water from the city, with its own downtown
                  and its own identity.
                </Fact>
                <Fact term="Genoa City — inland, south">
                  Off the lake entirely, straddling the Wisconsin–Illinois line.
                </Fact>
                <Fact term="The townships — everywhere between">
                  Linn on the south shore, Geneva to the north, Walworth to the
                  west.
                </Fact>
              </dl>
              <p className="mt-4">
                Nearly every trade-off below traces back to that map. Williams
                Bay tolerates a thin downtown because everything else is close.
                Genoa City costs less because it isn't on the water.
              </p>
            </>
          ),
        },
        {
          id: "lake-geneva-city",
          heading: "Lake Geneva (the city)",
          body: (
            <>
              <p>
                The biggest of the lakeshore towns, with the most walkable
                downtown, the most restaurants, and by far the heaviest summer
                visitor traffic. The lakefront from Library Park to the Riviera
                Docks is the postcard view of the region.
              </p>
              <dl className="mt-4 space-y-3">
                <Fact term="Who tends to live here">
                  A mix of full-time residents who value walkability,
                  second-home owners who want to step out their door and into a
                  town, and a steady current of retirees and remote workers who
                  like that real services (groceries, pharmacy, medical,
                  restaurants) are within minutes.
                </Fact>
                <Fact term="Trade-offs">
                  Highest per-square-foot prices and taxes among the lakeshore
                  options, and the most pronounced summer-weekend energy. If you
                  work from home on Saturday in July, you will hear it. The flip
                  side is that the town's cultural life — the festivals,
                  Winterfest, holiday markets — also happens here first.
                </Fact>
                <Fact term="Lake access">
                  Excellent. Riviera Beach, Library Park, multiple public piers,
                  and direct shore-path entry. Boat slips downtown are
                  competitive and not cheap.
                </Fact>
                <Fact term="Schools">
                  Lake Geneva–Genoa City Union High School District (high
                  school) with several K–8 feeders. District boundaries do not
                  match city limits —{" "}
                  <Link to="/guides/lake-geneva-schools" className={LINK}>
                    verify the exact feeder
                  </Link>{" "}
                  before buying.
                </Fact>
              </dl>
            </>
          ),
        },
        {
          id: "fontana",
          heading: "Fontana-on-Geneva-Lake",
          body: (
            <>
              <p>
                Fontana sits on the west end of the lake — a smaller, calmer
                downtown, a long-running yacht club tradition, and a tight-knit
                community of full-time and seasonal residents. The Abbey
                Resort anchors the harbor; the village itself is more residential
                than commercial.
              </p>
              <dl className="mt-4 space-y-3">
                <Fact term="Who tends to live here">
                  Longtime lake families, a strong sailing community, and buyers
                  who want serious lake access without the downtown-Lake-Geneva
                  intensity. Fontana has a distinct identity from Lake Geneva
                  and locals are quick to draw the distinction.
                </Fact>
                <Fact term="Trade-offs">
                  Fewer restaurants and shops within walking distance — you'll
                  drive for routine errands. Beautifully quiet outside of
                  regatta weekends.
                </Fact>
                <Fact term="Lake access">
                  Outstanding. The west-end beach, public piers, and the Fontana
                  Beach swim area are among the best public lake access on
                  Geneva Lake.
                </Fact>
                <Fact term="Schools">
                  Fontana J8 (K–8 elementary) then on to Big Foot High School.
                  Fontana J8 is small and well-regarded.
                </Fact>
              </dl>
            </>
          ),
        },
        {
          id: "williams-bay",
          heading: "Williams Bay",
          body: (
            <>
              <p>
                The north shore village, halfway between Lake Geneva and
                Fontana. Williams Bay has its own personality —{" "}
                <Link to="/guides/yerkes-observatory" className={LINK}>
                  Yerkes Observatory
                </Link>
                , Edgewater Park, a tiny but real downtown, and a K–12 school
                district that draws families specifically for that reason.
              </p>
              <dl className="mt-4 space-y-3">
                <Fact term="Who tends to live here">
                  Families who want a small public school, residents who like
                  quieter weekends, and a growing cohort of remote-work
                  professionals who appreciate that the village stays calm
                  year-round.
                </Fact>
                <Fact term="Trade-offs">
                  Downtown amenities are limited. For more dining or shopping
                  you're driving 8–12 minutes either direction.
                </Fact>
                <Fact term="Lake access">
                  Excellent. Edgewater Park is arguably the most
                  family-friendly public beach on the lake.
                </Fact>
                <Fact term="Schools">
                  Williams Bay School District (K–12), one of the smallest
                  public districts in the region. Often a primary reason
                  families choose the village.
                </Fact>
              </dl>
            </>
          ),
        },
        {
          id: "genoa-city",
          heading: "Genoa City and the southern townships",
          body: (
            <>
              <p>
                Genoa City sits inland to the south, technically straddling the
                Wisconsin–Illinois line. It's not a lakefront town — that's the
                point. Buyers who want more land, lower prices, and a quick
                drive to the Illinois border (or to Lake Geneva itself) end up
                here.
              </p>
              <dl className="mt-4 space-y-3">
                <Fact term="Who tends to live here">
                  Families and remote workers who want acreage at a price that
                  doesn't exist on the lake, plus residents who work in the I-94
                  corridor.
                </Fact>
                <Fact term="Trade-offs">
                  No walkable downtown to speak of, no lakefront. You're in the
                  area but not of the lake.
                </Fact>
                <Fact term="Lake access">
                  None, and that's the trade buyers here make deliberately.
                  Getting on the water means driving to it — the{" "}
                  <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                    public access guide
                  </Link>{" "}
                  covers the beaches, piers, and launches open to residents
                  without a lakefront address.
                </Fact>
                <Fact term="Schools">
                  Lake Geneva–Genoa City Union High School District (high
                  school) with Genoa City Joint 2 K–8.
                </Fact>
              </dl>
            </>
          ),
        },
        {
          id: "townships",
          heading: "The townships (Linn, Geneva, Walworth)",
          body: (
            <>
              <p>
                Outside the village and city limits, the surrounding townships
                (Town of Linn on the south shore, Town of Geneva to the north,
                Town of Walworth on the west) hold most of the larger lots,
                wooded parcels, and rural addresses. South-shore township
                addresses are particularly desirable for buyers who want
                proximity to the water without the village density.
              </p>
              <dl className="mt-4 space-y-3">
                <Fact term="Who tends to live here">
                  Buyers who want more privacy, more land, or a specific
                  architectural style not available in the villages. Also a
                  strong contingent of long-time families on
                  multi-generational properties.
                </Fact>
                <Fact term="Trade-offs">
                  Longer drives for everything, no walkable amenities, and a
                  real conversation to have about snow removal, internet, and
                  well/septic before buying.
                </Fact>
                <Fact term="Lake access">
                  Varies by parcel. South-shore addresses sit closest to the
                  water, but proximity on a map is not a right to reach it —
                  confirm in writing what a specific property conveys.
                </Fact>
                <Fact term="Schools">
                  Depends entirely on the address. Town of Linn feeds Reek (K–8)
                  then Williams Bay options; Town of Geneva ties into the Lake
                  Geneva system;{" "}
                  <Link to="/guides/lake-geneva-schools" className={LINK}>
                    verify the feeder
                  </Link>{" "}
                  before you fall in love with a parcel.
                </Fact>
              </dl>
            </>
          ),
        },
        {
          id: "side-by-side",
          heading: "The five options side by side",
          body: (
            <>
              <p className="mb-4">
                The same information, compressed. The last column is the one
                where buyers get surprised.
              </p>
              <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <caption className="sr-only">
                    Geneva Lake towns compared on five attributes.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {["Where", "Feel & pace", "Walkability", "Lake access", "School district", "Main trade-off"].map(
                        (h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr
                        key={row.where}
                        className="border-b border-slate-200 align-top last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left font-semibold text-slate-900"
                        >
                          {row.where}
                        </th>
                        <td className="px-3 py-3 text-slate-700">{row.feel}</td>
                        <td className="px-3 py-3 text-slate-700">{row.walkability}</td>
                        <td className="px-3 py-3 text-slate-700">{row.lakeAccess}</td>
                        <td className="px-3 py-3 text-slate-700">{row.schools}</td>
                        <td className="px-3 py-3 text-slate-700">{row.tradeOff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                District boundaries don't follow town lines. Confirm the schools
                that serve a specific parcel.
              </p>
            </>
          ),
        },
        {
          id: "comparing",
          heading: "How buyers usually compare",
          body: (
            <>
              <p className="mb-4">
                The most common short-lists we hear:{" "}
                <Link to="/guides/fontana-vs-lake-geneva" className={LINK}>
                  Lake Geneva vs. Fontana
                </Link>{" "}
                (downtown energy vs. quieter west-end community),{" "}
                <Link to="/guides/lake-geneva-vs-williams-bay" className={LINK}>
                  Lake Geneva vs. Williams Bay
                </Link>{" "}
                (walkable downtown vs. smaller school and calmer pace), and{" "}
                <strong>village vs. township</strong> (services and walkability
                vs. land and privacy). The first two have their own side-by-side
                write-ups. The third nobody can settle for you: it comes down to
                how much driving you'll absorb on an ordinary Tuesday.
              </p>
              <p>
                There isn't a wrong answer — there's a fit. A household that
                wants to walk to dinner won't be happy on ten acres no matter
                how good the price was, and the reverse is just as true. Both
                are available here, twenty minutes apart.
              </p>
            </>
          ),
        },
        {
          id: "cost",
          heading: "Cost, taxes, and the market",
          body: (
            <>
              <p className="mb-4">
                Price separates these towns more sharply than anything else
                here, and it moves. Lake Geneva carries the highest
                per-square-foot prices and taxes among the lakeshore options;
                Genoa City and the townships are where buyers go for land
                instead of an address. Those relationships are stable. The
                numbers behind them are not, which is why this page doesn't
                print any.
              </p>
              <p>
                For the year-round picture — taxes, utilities, what it costs to
                live here rather than visit — see the{" "}
                <Link to="/guides/cost-of-living-lake-geneva" className={LINK}>
                  cost of living guide
                </Link>
                . For what's moving right now, the{" "}
                <Link to="/market-report" className={LINK}>
                  monthly market report
                </Link>{" "}
                is the current read.
              </p>
            </>
          ),
        },
        {
          id: "visit",
          heading: "How to visit before you choose",
          body: (
            <>
              <p className="mb-4">
                The buyers who are happiest five years in are usually the ones
                who spent a real weekend in each option before committing,
                including a winter visit.
              </p>
              <p className="mb-4">
                A summer weekend tells you how loud a town gets at its peak — go
                on a Saturday in July, not a Wednesday in May. A winter visit
                tells you what you're buying the other nine months: what stays
                open, and whether the quiet reads as peace or isolation. That's
                the visit people skip. The{" "}
                <Link to="/guides/things-to-do-lake-geneva-in-winter" className={LINK}>
                  winter guide
                </Link>{" "}
                covers the off-season version of the area; the{" "}
                <Link to="/guides/things-to-do-lake-geneva-this-weekend" className={LINK}>
                  weekend guide
                </Link>{" "}
                is a reasonable warm-weather itinerary.
              </p>
              <p>
                While you're here, do the unglamorous things. Drive the commute
                at the hour you'd actually drive it. Ask a township seller about
                internet, snow removal, and the well and septic. And{" "}
                <Link to="/guides/lake-geneva-schools" className={LINK}>
                  confirm the school feeder
                </Link>{" "}
                for the parcel, not the town it's mailed to. If you're weighing
                the whole move, the{" "}
                <Link to="/guides/moving-to-lake-geneva" className={LINK}>
                  moving guide
                </Link>{" "}
                is the wider version of this conversation.
              </p>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
          <GuideNewsletterCTA />
          <SoftRealEstateCTA variant="market" />
        </>
      }
      related={[
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb:
            "The honest year-round picture: commute, cost, seasons, and the trade-offs that don't show up in listings.",
        },
        {
          title: "Lake Geneva Schools",
          path: "/guides/lake-geneva-schools",
          blurb: "Every district serving the area, and why boundaries don't follow town lines.",
        },
        {
          title: "Cost of Living in Lake Geneva",
          path: "/guides/cost-of-living-lake-geneva",
          blurb: "What it costs to live here rather than visit.",
        },
        {
          title: "Things to Do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb:
            "Spend a real weekend before you decide where to live — the local's start-here list.",
        },
      ]}
      faqs={[
        {
          question: "What is the difference between Lake Geneva and Geneva Lake?",
          answer:
            "Lake Geneva is the city, on the northeast corner of the shoreline. Geneva Lake is the body of water itself. Locals use the two precisely and visitors rarely do — so when someone says they live on Geneva Lake, they mean the water, not the city.",
        },
        {
          question: "What is the difference between Lake Geneva and Fontana?",
          answer:
            "Lake Geneva is the larger city on the east end, with the most walkable downtown and the heaviest summer visitor traffic. Fontana is a smaller village on the west end with a strong sailing tradition, fewer downtown amenities, and a calmer year-round feel. Both have excellent lake access but very different paces.",
        },
        {
          question: "Which lakeshore town is quietest year-round?",
          answer:
            "Williams Bay, for most people — the village stays calm even in summer, which is much of why families and remote workers choose it. Fontana is beautifully quiet outside regatta weekends. If you don't need a lakefront town at all, Genoa City and the townships are quieter still.",
        },
        {
          question: "Is Williams Bay a good place to live?",
          answer:
            "Yes — particularly for families who want a small K–12 public school district and a quiet year-round pace. Williams Bay has its own small downtown, Yerkes Observatory, and Edgewater Park, one of the most family-friendly public beaches on the lake.",
        },
        {
          question: "Do school district boundaries match town lines around Lake Geneva?",
          answer:
            "No. Boundaries do not follow city, village, or township lines, and rural addresses in particular can feed a district you would not guess from the mailing address. Verify the exact feeder school for a specific property before making an offer.",
        },
        {
          question: "Which Lake Geneva neighborhood has the best schools?",
          answer:
            "There isn't a single answer — it depends on what you value. Williams Bay's K–12 district is the smallest in the area and very well-regarded. Fontana J8 (K–8) followed by Big Foot High School is the option west-end families choose. The Lake Geneva–Genoa City Union High School District covers most other addresses. Always verify the exact feeder for a specific property.",
        },
        {
          question: "What should I check before buying a township property?",
          answer:
            "Internet service, snow removal, and the condition of the well and septic. Township parcels sit outside village services, so each is worth confirming in writing rather than assuming. Confirm the school feeder too — for township addresses it depends entirely on the parcel.",
        },
        {
          question: "Are township properties around Lake Geneva worth considering?",
          answer:
            "If you want land, privacy, or a non-village setting — yes. South-shore township addresses are especially desirable. The trade-offs are real: longer drives, no walkable services, and a real conversation about internet, snow removal, and well/septic before closing.",
        },
      ]}
    />
  );
}

/**
 * One attribute of a town — rendered as a real term/definition pair so the
 * comparison is machine-readable, not just bolded run-in text.
 */
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-slate-900">{term}</dt>
      <dd className="mt-0.5 text-slate-700 leading-relaxed">{children}</dd>
    </div>
  );
}
