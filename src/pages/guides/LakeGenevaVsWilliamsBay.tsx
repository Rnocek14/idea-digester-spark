import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";
const UPDATED = "2026-07-29";

/**
 * Head-to-head resident-intent guide. Every row in COMPARISON restates a
 * claim made in the prose below it — the table is a summary, never a place
 * where a new fact gets introduced.
 */
const COMPARISON: { axis: string; lakeGeneva: string; williamsBay: string }[] = [
  {
    axis: "Position on the lake",
    lakeGeneva: "East end of Geneva Lake",
    williamsBay: "North side, in the bay it's named for",
  },
  {
    axis: "Downtown",
    lakeGeneva: "The larger of the two — most of the shopping and nightlife",
    williamsBay: "Smaller and tighter, a few blocks rather than a grid",
  },
  {
    axis: "Visitor traffic",
    lakeGeneva: "Higher — resort traffic and most of the boat tours",
    williamsBay: "Lower — less foot traffic, more neighborhood feel",
  },
  {
    axis: "K-8",
    lakeGeneva: "Lake Geneva-Genoa City J1 K-8 district",
    williamsBay: "Its own district, K-12 on one campus",
  },
  {
    axis: "High school",
    lakeGeneva: "Badger High School — larger, multi-feeder, comprehensive",
    williamsBay: "Its own, on the same small K-12 campus",
  },
  {
    axis: "Main public beach",
    lakeGeneva: "Riviera Beach — walkable to downtown, most crowded on the lake in July and August",
    williamsBay: "Edgewater Park — bigger swim area, easier parking, less crowded",
  },
  {
    axis: "Dining depth",
    lakeGeneva: "More options, more nightlife, more choice",
    williamsBay: "Fewer but higher-signal — a handful of standouts",
  },
  {
    axis: "Inland housing",
    lakeGeneva: "The baseline for the shoreline market",
    williamsBay: "A small premium, often attributed to the school district",
  },
];

const DECISION_ORDER: {
  question: string;
  why: string;
  linkLabel: string;
  anchor: string;
}[] = [
  {
    question: "Which school district do you want?",
    why: "The only axis here that's hard to undo once you've bought, and the one families cite most often when they pick Williams Bay on purpose. Answer it first and it eliminates half the map.",
    linkLabel: "Schools",
    anchor: "#schools",
  },
  {
    question: "Do you want to walk to things, or drive to them?",
    why: "Lake Geneva's downtown is the one you can live inside of. Williams Bay's is the one you drive to in four minutes and park at without thinking about it.",
    linkLabel: "Dining, shopping, and walkability",
    anchor: "#dining-shopping",
  },
  {
    question: "How often do you actually want to be at the water?",
    why: "Once a season, the crowded convenient beach is fine. Three times a week with kids and towels, the easy-parking beach quietly wins.",
    linkLabel: "Beaches and lake access",
    anchor: "#beaches",
  },
  {
    question: "What's your tolerance for a busy summer?",
    why: "Both towns get a summer. Only one of them gets it at full volume, on your street, for two months.",
    linkLabel: "How the difference changes by season",
    anchor: "#seasons",
  },
];

export default function LakeGenevaVsWilliamsBay() {
  return (
    <GuideShell
      title="Lake Geneva vs Williams Bay: A Local's Comparison"
      metaTitle="Lake Geneva vs Williams Bay — A Local's Side-by-Side Comparison"
      metaDescription="A practical comparison of Lake Geneva and Williams Bay, Wisconsin — schools, downtowns, beaches, lake access, housing, and which side of Geneva Lake fits which kind of family."
      path="/guides/lake-geneva-vs-williams-bay"
      datePublished={TODAY}
      dateModified={UPDATED}
      intro={
        <>
          <p className="mb-4">
            Lake Geneva and Williams Bay sit on the same water, ten
            minutes apart by car, and feel like two different towns.
            Lake Geneva is at the east end of Geneva Lake, where the
            downtown runs right up to the shoreline and the boats leave
            from. Williams Bay is on the north side, set back into the
            bay it takes its name from. Same lake, different address on
            it.
          </p>
          <p className="mb-4">
            Families relocating to the shoreline almost always end up
            comparing these two, and the comparison is closer than it
            looks from outside. Same water, same weather, same seasonal
            rhythm, same Shore Path running past both. What actually
            differs is narrow — which downtown you step into, which
            district your kids enroll in, and how much of your summer
            happens inside somebody else's vacation.
          </p>
          <p>
            This is the honest side-by-side, in the order most families
            end up needing it.
          </p>
        </>
      }
      sections={[
        {
          id: "at-a-glance",
          heading: "The comparison at a glance",
          body: (
            <>
              <p className="mb-4">
                Everything in this table is unpacked in the sections
                below. If you only read one thing on this page, read
                this — then jump to the two or three rows that actually
                move your decision.
              </p>
              <div
                className="not-prose overflow-x-auto rounded-sm border border-slate-200 bg-white"
                role="region"
                aria-label="Comparison table, scrollable"
                tabIndex={0}
              >
                <table className="w-full min-w-[620px] text-sm border-collapse">
                  <caption className="sr-only">
                    Lake Geneva and Williams Bay compared across position
                    on the lake, downtown, visitor traffic, schools,
                    beaches, dining, and housing.
                  </caption>
                  <thead>
                    <tr className="bg-stone-100 border-b border-slate-200">
                      <th
                        scope="col"
                        className="w-[22%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        Axis
                      </th>
                      <th
                        scope="col"
                        className="w-[39%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        Lake Geneva
                      </th>
                      <th
                        scope="col"
                        className="w-[39%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        Williams Bay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr
                        key={row.axis}
                        className="border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-stone-50"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left align-top font-semibold text-slate-900"
                        >
                          {row.axis}
                        </th>
                        <td className="px-3 py-3 align-top text-slate-700 leading-snug">
                          {row.lakeGeneva}
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700 leading-snug">
                          {row.williamsBay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 italic mt-3">
                A summary of the sections below — nothing appears here
                that isn't explained in the prose.
              </p>
            </>
          ),
        },
        {
          id: "vibe",
          heading: "Feel and pace",
          body: (
            <>
              <p className="mb-4">
                <strong>Lake Geneva</strong> is the bigger, busier of
                the two — the larger downtown, the resort traffic,
                most of the boat tours, the bulk of the dining and
                shopping. Higher energy, more visitor turnover. Sitting
                at the east end also makes it the arrival point — it's
                where most people coming for a single day end up, which
                shapes everything from sidewalk density to summer
                parking.
              </p>
              <p className="mb-4">
                <strong>Williams Bay</strong> is quieter on purpose.
                Smaller downtown, less foot traffic, a more
                neighborhood feel. The lakefront here is a community
                park, not a tourist anchor — the difference you notice
                is that the people at the water on a Tuesday evening
                mostly live within a few blocks of it.
              </p>
              <p>
                Neither is sleepy and neither is chaotic. The honest
                framing is that Lake Geneva has a downtown you live
                inside of, and Williams Bay has a downtown you live
                near. Which one sounds better to you is most of the
                answer to this whole page.
              </p>
            </>
          ),
        },
        {
          id: "schools",
          heading: "Schools",
          body: (
            <>
              <p className="mb-4">
                The schools are different and meaningfully so.
                <strong> Williams Bay</strong> runs its own K-12
                district on a single small campus near the lake.
                <strong> Lake Geneva</strong> students are in the
                Lake Geneva-Genoa City J1 K-8 district and feed into
                Badger High School (a larger, multi-feeder
                comprehensive high school).
              </p>
              <p className="mb-4">
                The structural difference matters more than any
                ranking. A single K-12 campus means the same building
                complex, the same staff, and largely the same cohort of
                families from kindergarten through graduation — smaller
                classes, easier access to varsity spots and lead roles,
                fewer kids to get lost among. A larger multi-feeder
                high school means more course options, more programs,
                more teams, and a bigger world for a kid who wants one.
              </p>
              <p>
                Families specifically choosing Williams Bay almost
                always cite the school as part of the reason. See
                the{" "}
                <Link to="/guides/lake-geneva-schools" className="text-blue-700 hover:underline font-medium">
                  schools guide
                </Link>{" "}
                for the full picture, including boundaries and how the
                feeder pattern actually works.
              </p>
            </>
          ),
        },
        {
          id: "beaches",
          heading: "Beaches and lake access",
          body: (
            <>
              <p className="mb-4">
                <strong>Riviera Beach</strong> in Lake Geneva is the
                convenient beach — walkable to downtown and the
                docks. It's also the most crowded beach on the lake
                in July and August.
              </p>
              <p className="mb-4">
                <strong>Edgewater Park</strong> in Williams Bay is
                the local-family default — bigger swim area, easier
                parking, less crowded. For day-to-day lake access,
                Williams Bay wins.
              </p>
              <p className="mb-4">
                The distinction that matters is frequency. If you go to
                the beach a handful of times a summer, the crowded
                walkable one is genuinely better — you park once
                downtown, swim, and eat without moving the car. If you
                go three times a week with kids, chairs, and a cooler,
                the beach you can pull up to and unload at is the one
                you'll actually use. Beach hours, fees, and seasonal
                pass rules change from year to year at both — check the
                current posting before you count on it.
              </p>
              <p>
                Neither town has a monopoly on the water. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline font-medium">
                  Shore Path
                </Link>{" "}
                runs past both, and the{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className="text-blue-700 hover:underline font-medium">
                  public access guide
                </Link>{" "}
                lays out every legal way onto the lake regardless of
                which side you live on.
              </p>
            </>
          ),
        },
        {
          id: "dining-shopping",
          heading: "Dining, shopping, and walkability",
          body: (
            <>
              <p className="mb-4">
                Lake Geneva has more options — more restaurants, more
                shops, more nightlife. Williams Bay has a tighter,
                higher-signal version of the same — a few standouts
                (Pier 290 is the obvious one), less choice, less
                hassle.
              </p>
              <p className="mb-4">
                Walkability is where the two genuinely diverge. In Lake
                Geneva, a downtown or near-downtown address means dinner,
                coffee, the lakefront, and the beach are all on foot. In
                Williams Bay, the same errands are a short drive that
                you stop noticing after a month. The trade runs both
                ways: the walkable downtown is also the one where a
                summer Saturday means circling for a parking space,
                while the town you drive into is the one where you park
                out front.
              </p>
              <p>
                If you want to walk to dinner six nights a week,
                Lake Geneva. If you want a quieter Sunday morning
                with a coffee and a view of the lake, Williams Bay.
                Either way, the{" "}
                <Link to="/eats" className="text-blue-700 hover:underline font-medium">
                  restaurant directory
                </Link>{" "}
                covers both sides of the lake — hours shift with the
                season, so check before you drive.
              </p>
            </>
          ),
        },
        {
          id: "housing",
          heading: "Housing and price",
          body: (
            <>
              <p className="mb-4">
                Both towns share the same broader lakefront market
                dynamics — limited supply, deep demand, real
                premiums for water access. Inland housing in Williams
                Bay tends to carry a small premium over the
                equivalent block in Lake Geneva, often attributable
                to the school district. The{" "}
                <Link to="/market-report" className="text-blue-700 hover:underline font-medium">
                  monthly market report
                </Link>{" "}
                tracks current reads.
              </p>
              <p className="mb-4">
                Worth being precise about what that premium is and
                isn't. It shows up on comparable inland blocks — the
                ordinary non-lakefront housing most families actually
                buy. On the water, both towns answer to the same
                scarcity, and the price is set by the frontage rather
                than the town line behind it. The district premium is a
                real factor inland and close to irrelevant lakefront.
              </p>
              <p>
                Purchase price is also only part of it — the{" "}
                <Link to="/guides/cost-of-living-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  cost of living guide
                </Link>{" "}
                covers what the shoreline runs month to month, and{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className="text-blue-700 hover:underline font-medium">
                  the neighborhoods guide
                </Link>{" "}
                puts both towns next to Fontana and Linn.
              </p>
            </>
          ),
        },
        {
          id: "logistics",
          heading: "Day-to-day logistics: ten minutes is the whole story",
          body: (
            <>
              <p className="mb-4">
                Ten minutes is short enough that most of this
                comparison is about preference rather than access.
                Living in Williams Bay and eating dinner in Lake
                Geneva is a completely ordinary Thursday. Living in
                Lake Geneva and taking the kids to the Williams Bay
                beach because the parking is easier is an ordinary
                Saturday. Nobody is giving anything up.
              </p>
              <p>
                That reframes the decision usefully. You are not
                choosing which town's restaurants, beach, or lakefront
                you get to use — you get both, and most residents do.
                You are choosing which one you step out your front
                door into: which downtown is the default when you
                don't feel like driving, which beach you go to on a
                whim rather than a plan, and whose summer traffic is
                on your street. Which means the "wrong" choice here is
                a mild inconvenience rather than a mistake — with one
                exception. The school district is the only item on
                this page you can't fix with a ten-minute drive.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "How the difference changes by season",
          body: (
            <>
              <p className="mb-4">
                The gap between these two towns is not constant. It's
                widest in July and narrowest in January, and the reason
                is simple: the thing that separates them is visitor
                turnover, and visitor turnover is seasonal.
              </p>
              <p className="mb-4">
                In summer, Lake Geneva is running at full volume —
                resort traffic, boat tours, the busiest beach on the
                lake, a downtown absorbing far more people than live
                in it. Williams Bay in the same weeks is busier than
                its winter self but nothing like its neighbor. That's
                the two months when the choice between them feels
                enormous.
              </p>
              <p>
                Off-season, the two converge. The quieter town changes
                less between seasons almost by definition — it had
                less turnover to lose — while the busier one settles
                back into something that reads a lot like a
                neighborhood. If you tour both in February and conclude
                they're similar, you're not wrong; you just haven't
                seen them in August. Check the{" "}
                <Link to="/events" className="text-blue-700 hover:underline font-medium">
                  events calendar
                </Link>{" "}
                if you want a sense of the annual rhythm before you
                commit.
              </p>
            </>
          ),
        },
        {
          id: "landmarks",
          heading: "What each town is known for",
          body: (
            <>
              <p className="mb-4">
                Lake Geneva's landmarks are downtown-facing and public
                — the lakefront, the beach, the boats, the Riviera at
                the center of it, all within walking distance of each
                other. They're the reason the town draws the crowd it
                does.
              </p>
              <p>
                Williams Bay's defining landmark is{" "}
                <Link to="/guides/yerkes-observatory" className="text-blue-700 hover:underline font-medium">
                  Yerkes Observatory
                </Link>{" "}
                — the historic observatory above the lake, and the
                thing most people outside the area know the village
                for. It draws visitors, but by ticketed tour rather
                than foot traffic, which is a fair summary of the
                difference between the two towns. Tour schedules and
                availability change seasonally, so book ahead rather
                than dropping in.
              </p>
            </>
          ),
        },
        {
          id: "decide",
          heading: "Which question to answer first",
          body: (
            <>
              <p className="mb-4">
                Most families get stuck because they weigh all of this
                at once. Answer these four in order instead — each
                links to the section that covers it.
              </p>
              <ol className="not-prose space-y-3">
                {DECISION_ORDER.map((item, i) => (
                  <li
                    key={item.question}
                    className="flex gap-3 rounded-sm border border-slate-200 bg-white p-4"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {item.question}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                        {item.why}
                      </p>
                      <a
                        href={item.anchor}
                        className="mt-1.5 inline-block text-xs font-medium text-blue-700 hover:underline"
                      >
                        {item.linkLabel} →
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4">
                If the first question doesn't decide it, the fourth
                usually does — and the ones in between are preference,
                not constraint.
              </p>
            </>
          ),
        },
        {
          id: "fit",
          heading: "Which fits which family",
          body: (
            <>
              <p className="mb-4">
                The pattern we see most often:
              </p>
              <ul className="not-prose space-y-2 mb-4">
                <li className="rounded-sm border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700">
                  <strong className="text-slate-900">Choose Lake Geneva</strong> if you want
                  walkable nightlife, a busier downtown, and the
                  Badger High School pipeline.
                </li>
                <li className="rounded-sm border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700">
                  <strong className="text-slate-900">Choose Williams Bay</strong> if you want
                  the small K-12 district, less foot traffic, and a
                  quieter year-round shoreline.
                </li>
                <li className="rounded-sm border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700">
                  <strong className="text-slate-900">It can also be both</strong> — many
                  families end up living in one and spending plenty
                  of weekends in the other.
                </li>
              </ul>
              <p>
                And if neither quite lands, the comparison usually
                widens rather than narrows —{" "}
                <Link to="/guides/fontana-vs-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  Fontana
                </Link>{" "}
                is the next town most families put on the list, and{" "}
                <Link to="/guides/moving-to-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  the moving guide
                </Link>{" "}
                covers the parts of relocating here that aren't
                specific to any one town.
              </p>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
          <GuideNewsletterCTA />
          <SoftRealEstateCTA variant="neighborhoods" />
        </>
      }
      related={[
        {
          title: "Fontana vs Lake Geneva",
          path: "/guides/fontana-vs-lake-geneva",
          blurb: "The other common shoreline comparison families end up making.",
        },
        {
          title: "Lake Geneva Neighborhoods",
          path: "/guides/lake-geneva-neighborhoods",
          blurb: "Every shoreline town side-by-side — Lake Geneva, Williams Bay, Fontana, Linn.",
        },
        {
          title: "Lake Geneva Schools",
          path: "/guides/lake-geneva-schools",
          blurb: "Districts, boundaries, and feeder patterns — the axis that decides this comparison most often.",
        },
        {
          title: "Cost of Living",
          path: "/guides/cost-of-living-lake-geneva",
          blurb: "What the shoreline actually costs month to month, beyond the purchase price.",
        },
        {
          title: "Yerkes Observatory",
          path: "/guides/yerkes-observatory",
          blurb: "Williams Bay's defining landmark, and how to actually visit it.",
        },
        {
          title: "The Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The public shoreline walk that connects both towns and everything between them.",
        },
      ]}
      faqs={[
        {
          question: "Is Williams Bay or Lake Geneva better for families?",
          answer:
            "Williams Bay is often the answer for families specifically choosing for the K-12 district and a quieter day-to-day. Lake Geneva is the answer for families who want a walkable downtown and the Badger High School pipeline.",
        },
        {
          question: "Are Lake Geneva and Williams Bay on the same lake?",
          answer:
            "Yes — both sit on Geneva Lake. Lake Geneva is on the east end, Williams Bay on the north side, about a 10-minute drive between them.",
        },
        {
          question: "How far apart are Lake Geneva and Williams Bay?",
          answer:
            "About a 10-minute drive. Lake Geneva sits at the east end of Geneva Lake and Williams Bay on the north side, so the two are close enough that most residents use both towns regularly.",
        },
        {
          question: "Which town has the better beach?",
          answer:
            "It depends how often you go. Riviera Beach in Lake Geneva is the convenient one — walkable to downtown and the docks, and the most crowded beach on the lake in July and August. Edgewater Park in Williams Bay is the local-family default, with a bigger swim area, easier parking, and fewer people. For day-to-day lake access, Williams Bay wins.",
        },
        {
          question: "Does Williams Bay have its own high school?",
          answer:
            "Yes. Williams Bay runs its own district covering kindergarten through 12th grade on a single small campus near the lake, so students stay in the same district for all thirteen years.",
        },
        {
          question: "Do Williams Bay students attend Badger High School?",
          answer:
            "No. Badger High School is the Lake Geneva-side high school — a larger, multi-feeder comprehensive school that Lake Geneva-Genoa City J1 K-8 students feed into. Williams Bay students attend their own district's high school on the village campus.",
        },
        {
          question: "Is Williams Bay more expensive than Lake Geneva?",
          answer:
            "Inland housing in Williams Bay tends to carry a small premium over the equivalent block in Lake Geneva, often attributed to the school district. On the lakefront itself, both towns are governed by the same limited supply and deep demand, so the difference largely disappears.",
        },
        {
          question: "Which town is quieter?",
          answer:
            "Williams Bay. It has the smaller downtown, less foot traffic, and a lakefront that functions as a community park rather than a tourist anchor. The gap is widest in July and August and narrows considerably in the off-season.",
        },
        {
          question: "Can you live in one town and use the other's beaches and restaurants?",
          answer:
            "Yes, and most residents do. Ten minutes between the two means dinner in Lake Geneva from a Williams Bay address, or the Edgewater Park beach from a Lake Geneva address, is an ordinary weekday errand. The choice is really about which town you step out your front door into, not which one you have access to.",
        },
      ]}
    />
  );
}
