import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Three household profiles, side by side. Every cell is a compression of a
 * sentence written elsewhere on this page — no figures, no new claims.
 */
const PROFILES: {
  household: string;
  tier: string;
  carrying: string;
  taxQuestion: string;
}[] = [
  {
    household: "Inland year-rounder",
    tier: "Inland City of Lake Geneva or Genoa City; pricing tracks the broader county",
    carrying:
      "Heating and electric, water/sewer or well and septic, plowing, lawn care, insurance, commute fuel and wear",
    taxQuestion:
      "Which municipality is the parcel in? The city and Genoa City are separate taxing bodies with separate rates",
  },
  {
    household: "Lake-access year-rounder",
    tier: "An otherwise modest home carrying a premium for deeded pier rights or HOA beach access",
    carrying:
      "All of the above, plus association dues, pier removal and reinstall, and boat and lift upkeep",
    taxQuestion:
      "Same municipal question — plus what the association assesses on top of it, and whether it can special-assess",
  },
  {
    household: "Lakefront or second-home buyer",
    tier: "A separate market entirely; priced on shoreline rather than square footage",
    carrying:
      "All of the above, plus seawall and shoreline work, boat storage, and the largest heating footprint of the three",
    taxQuestion:
      "What the assessment does after your purchase — lakefront assessments can shift meaningfully after a recent sale",
  },
];

/**
 * The blank budget skeleton. Structure only: every item here is already named
 * or directly implied by the prose sections. Deliberately no numbers.
 */
const LINE_ITEMS: { group: string; items: string[] }[] = [
  {
    group: "The ones you already know about",
    items: [
      "Mortgage or rent",
      "Property tax at the rate for that specific municipality — not a county average",
      "Homeowners insurance",
      "Heating, quoted across a full winter rather than a shoulder month",
      "Electric",
      "Water and sewer inside a village or city; well and septic service outside one",
    ],
  },
  {
    group: "The seasonal ones",
    items: [
      "Snow plowing — priced by driveway, not by house",
      "Lawn care, plus spring opening and fall cleanup",
      "Commute fuel and vehicle wear, if anyone drives toward Chicago or Milwaukee",
      "The winter-driving allowance: tires, salt damage, slower and harder miles",
    ],
  },
  {
    group: "The lake ones, if you have water access",
    items: [
      "Pier removal in the fall and reinstall in the spring, quoted as an annual service",
      "Boat lift — purchase, install, removal, storage",
      "Boat maintenance and storage, and a slip if you need one",
      "Seawall and shoreline inspection and repair",
      "HOA or beach-association dues — and what the association can special-assess",
    ],
  },
];

export default function CostOfLivingLakeGeneva() {
  return (
    <GuideShell
      title="Cost of Living in Lake Geneva, Wisconsin"
      metaTitle="Cost of Living in Lake Geneva, WI — A Local's Breakdown"
      metaDescription="A practical breakdown of the cost of living in Lake Geneva, Wisconsin — housing, property taxes, utilities, groceries, and how the lakefront premium changes the math."
      path="/guides/cost-of-living-lake-geneva"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Cost of living in Lake Geneva splits along the same line
            everything else here does: the lake premium and everything
            else. The City of Lake Geneva inland is in line with a normal
            small Wisconsin city. Anything with deeded water access is a
            different conversation.
          </p>
          <p>
            This is the honest breakdown for someone seriously
            researching a move.
          </p>
          <p>
            You will notice there are no dollar figures on this page. Mill
            rates, utility rates and pier-service pricing all move, and a
            stale number is worse than no number at all. What follows
            instead is the structure — which line items exist here that
            don't exist in a landlocked suburb, which of them attach to
            which kind of household, and exactly where to go to get the
            current figures for a specific address.
          </p>
        </>
      }
      introExtra={
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
            The short version, up top
          </p>
          <ul className="space-y-3 text-slate-700 leading-relaxed">
            <li>
              <strong className="text-slate-900">Inland is ordinary.</strong>{" "}
              Buying inland in the City of Lake Geneva or Genoa City,
              without chasing water access, puts you where most small
              Wisconsin cities land — solid value measured against the
              Chicago and Milwaukee metros.
            </li>
            <li>
              <strong className="text-slate-900">The lake is a second budget.</strong>{" "}
              Deeded access or lakefront adds a purchase premium and then a
              recurring one: pier removal and reinstall, lifts, seawalls,
              boat upkeep. None of it shows up in a national cost-of-living
              calculator.
            </li>
            <li>
              <strong className="text-slate-900">Your tax rate is an address, not a town.</strong>{" "}
              Lake Geneva, Williams Bay, Fontana, Linn and Genoa City each
              set their own mill rate. Pull the current one for the specific
              parcel before you underwrite anything.
            </li>
          </ul>
        </div>
      }
      sections={[
        {
          id: "housing",
          heading: "Housing: the dominant variable",
          body: (
            <>
              <p>
                Housing is where Lake Geneva diverges from a typical
                Walworth County town. Three honest tiers to know:
              </p>
              <ul>
                <li>
                  <strong>Inland City of Lake Geneva / Genoa City</strong>
                  — comparable to other small Wisconsin cities. Median
                  single-family pricing tracks the broader county.
                </li>
                <li>
                  <strong>Lake-access homes</strong> — deeded pier rights
                  or HOA beach access add a meaningful premium even when
                  the home itself is modest.
                </li>
                <li>
                  <strong>Lakefront</strong> — a separate market.
                  Pricing is shoreline-driven, not square-footage-driven.
                  See the{" "}
                  <Link to="/market-report" className={LINK}>
                    monthly market report
                  </Link>{" "}
                  for current reads.
                </li>
              </ul>
              <p>
                The practical consequence is that "cost of living in Lake
                Geneva" isn't one number — it's three. A household weighing
                an inland ranch in Genoa City against a lake-access cottage
                on the north shore isn't comparing two versions of the same
                budget; it's comparing two different budgets that happen to
                share a grocery store. Settle which tier you're actually
                shopping in before you compare anything else. The{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className={LINK}>
                  neighborhood guide
                </Link>{" "}
                is the place to work that out, and{" "}
                <Link to="/guides/lake-geneva-vs-williams-bay" className={LINK}>
                  Lake Geneva vs. Williams Bay
                </Link>{" "}
                covers the inland-premium question buyers ask most often.
              </p>
            </>
          ),
        },
        {
          id: "profiles",
          heading: "Three households, three different budgets",
          body: (
            <>
              <p className="mb-4">
                Same lake, same schools, same supermarket — and three sets of
                books. This is the page compressed into the form most people
                actually need it in.
              </p>
              <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <caption className="sr-only">
                    Three Lake Geneva household profiles compared on housing
                    tier, carrying costs, and the property tax question that
                    matters for each.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {[
                        "Household",
                        "Housing tier",
                        "Carrying costs that apply",
                        "The tax question that matters",
                      ].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROFILES.map((row) => (
                      <tr
                        key={row.household}
                        className="border-b border-slate-200 align-top last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left font-semibold text-slate-900"
                        >
                          {row.household}
                        </th>
                        <td className="px-3 py-3 text-slate-700">{row.tier}</td>
                        <td className="px-3 py-3 text-slate-700">{row.carrying}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.taxQuestion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Every cell restates something stated elsewhere on this page.
                Nothing here is a quoted price.
              </p>
              <p>
                Second-home buyers are their own case again, because the
                carrying costs run all twelve months while the house is used
                for a fraction of them.{" "}
                <Link to="/guides/fontana-vs-lake-geneva" className={LINK}>
                  Fontana vs. Lake Geneva
                </Link>{" "}
                gets further into that profile.
              </p>
            </>
          ),
        },
        {
          id: "taxes",
          heading: "Property and state taxes",
          body: (
            <>
              <p>
                Wisconsin's effective property tax rate is among the
                higher in the country, and Walworth County is in line
                with that. Mill rates vary by municipality — Lake
                Geneva, Williams Bay, Fontana, Linn, and Genoa City are
                all separate. Always pull the current rate from the
                county before underwriting a move.
              </p>
              <p>
                Wisconsin state income tax brackets apply. There is no
                separate Walworth County income tax. Lakefront
                assessments deserve their own careful look — they can
                shift meaningfully after a recent sale.
              </p>
              <p>
                Two things make the property tax harder to eyeball than it
                looks. The first is that a Wisconsin tax bill is assembled
                from several overlapping levies rather than set by any one
                body, which is why the rate attaches to a parcel and not to a
                town name. The second is that school district boundaries
                don't reliably follow municipal lines around this lake — so
                the district you buy into and the rate you'll pay are
                effectively the same decision, made once, at the closing
                table. If schools are driving the search, read the{" "}
                <Link to="/guides/lake-geneva-schools" className={LINK}>
                  schools guide
                </Link>{" "}
                alongside this one and settle both questions on the same map.
              </p>
              <p>
                And treat what the current owner pays as history rather than
                forecast, particularly on the water. The assessment is a
                separate question from the rate, and it's the one that moves
                after a transaction.
              </p>
            </>
          ),
        },
        {
          id: "line-items",
          heading: "Line items to price out before you commit",
          body: (
            <>
              <p className="mb-4">
                A blank budget skeleton — no figures, because they're yours to
                fill in for a specific address. Most of these are knowable
                before you close. The ones people skip are almost always in
                the third group.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {LINE_ITEMS.map((g) => (
                  <div
                    key={g.group}
                    className="rounded-sm border border-slate-200 bg-white p-4"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
                      {g.group}
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-700 list-none pl-0">
                      {g.items.map((it) => (
                        <li key={it} className="leading-snug pl-3 -indent-3">
                          — {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                The reason the list is grouped this way: the first column is
                what a national cost-of-living calculator models, the second
                is what it models badly, and the third is what it doesn't
                model at all. If you're buying water access, the third column
                is the part of the budget you're building from scratch.
              </p>
            </>
          ),
        },
        {
          id: "underestimated",
          heading: "The costs newcomers underestimate",
          body: (
            <>
              <p>
                Three costs account for most of the gap between what
                well-prepared buyers expect and what they end up paying. They
                sit in different parts of a normal budget, which is exactly
                why they get missed — so here they are together.
              </p>
              <h3>The heating swing</h3>
              <p>
                Winter natural-gas and electric bills run noticeably higher
                than the same square footage in a milder climate, and the
                cost is seasonal rather than steady. A household that budgets
                off an October bill will be short in January. Ask a seller
                for a full twelve months of utility history rather than an
                annual average — the average hides the two months that hurt.
              </p>
              <h3>The lake's recurring bill</h3>
              <p>
                Pier removal in the fall, reinstall in the spring, a boat
                lift, seawall upkeep, and the boat itself are not one-time
                purchases. They're an annual service relationship, and they
                arrive every year whether or not the house changes hands.
                This is the set that never appears in a generic cost-of-living
                calculator, which is precisely why it surprises people who did
                their homework everywhere else.
              </p>
              <h3>Winter driving</h3>
              <p>
                If someone in the household works toward Chicago or Milwaukee,
                that's roughly 90 minutes each way to the Loop or 50 to 70 to
                Milwaukee, with no commuter rail to fall back on. That makes fuel and vehicle
                wear a fixed line item rather than a variable one — and it
                makes winter, when the same drive is slower and harder on a
                car, the season the budget gets tested.
              </p>
            </>
          ),
        },
        {
          id: "utilities",
          heading: "Utilities and seasonal services",
          body: (
            <>
              <p>
                Utilities here are less a question of rate shopping than of
                knowing which meters you'll have. Natural gas and electric
                carry the winter swing described above. What varies more from
                address to address is what's underneath the house: whether a
                parcel is on municipal water and sewer or on a private well
                and septic system. One is a recurring charge you can read off
                a bill. The other is periodic service plus an eventual
                replacement you should be reserving for from the first year,
                and it is the difference most often missed when comparing a
                home inside a village to one outside it.
              </p>
              <p>
                Plowing is the other line item that tracks the property rather
                than the house. It's priced by driveway: a long drive outside
                a village costs more to keep clear all winter than a short one
                in town, regardless of what the two homes sold for. Lawn care
                behaves the same way. Both are worth quoting for the specific
                address rather than assuming a town-wide going rate.
              </p>
              <p>
                The lake maintenance items — pier removal and reinstall,
                lifts, seawalls, boat upkeep — belong in this part of the
                budget too, even though no utility sends the bill. They recur
                on a schedule, they're quoted annually, and they're the piece
                a generic "cost of living" calculator has no way to model.
              </p>
            </>
          ),
        },
        {
          id: "groceries-dining",
          heading: "Groceries, dining, and day-to-day",
          body: (
            <>
              <p>
                Groceries and day-to-day costs in Lake Geneva are
                roughly in line with the regional Wisconsin average,
                with a small tourist-town premium on a few categories
                downtown. Dining splits between locals' supper-club
                pricing and resort/lakeside pricing — the latter is
                meaningfully higher.
              </p>
              <p>
                A practical tip: many locals do bigger grocery runs in
                Delavan, Burlington, or further out for selection more
                than for price.
              </p>
              <p>
                Worth being precise about the premium, because it's narrower
                than its reputation: it's concentrated on a handful of
                downtown categories in season and on the resort end of the
                dining spectrum. It does not follow you to the supermarket.
                For a household that eats at home most nights, groceries are
                close to a non-issue in this comparison. For a household
                planning to eat downtown on July weekends, it isn't — and
                that's a lifestyle choice to budget deliberately rather than
                a cost of living here.
              </p>
            </>
          ),
        },
        {
          id: "commute",
          heading: "Commute and transportation",
          body: (
            <>
              <p>
                Lake Geneva sits roughly 80 miles from downtown Chicago
                and about 50 from downtown Milwaukee — call it 90 minutes
                to the Loop on a good day and 50 to 70 minutes to
                Milwaukee. There's no commuter rail; commuters drive or
                work hybrid. Gas, vehicle wear, and winter driving costs
                are real line items for households that work in
                either metro.
              </p>
              <p>
                Do this arithmetic honestly, because it's the line item most
                likely to change the answer. A five-day in-office commute to
                either metro is a five-day-a-week cost in fuel, wear and
                hours. A hybrid schedule is a different budget entirely, and
                it's a common arrangement among households that work in
                either metro. Decide which one you're actually signing up for before
                you compare housing prices: a lower mortgage that comes with
                ten more hours a week in a car is not obviously a saving.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "The seasonal cadence of spending",
          body: (
            <>
              <p>
                Household costs here don't arrive evenly across the year.
                Averaging works fine in most places; here it hides three
                distinct spikes, and they don't overlap.
              </p>
              <ul>
                <li>
                  <strong>Winter-loaded</strong> — heating and plowing, the
                  two largest seasonal line items, land in the same months.
                  This is the stretch a first-year budget most often
                  underestimates.
                </li>
                <li>
                  <strong>Spring and fall-loaded</strong> — pier reinstall in
                  spring and removal in fall, lawn opening and cleanup, and
                  seawall or shoreline work, which tends to get scheduled in
                  the shoulder seasons. Two bills a year that a monthly
                  average will quietly smooth away.
                </li>
                <li>
                  <strong>Summer-loaded</strong> — the downtown dining
                  premium, boat operation, and everything else that's only in
                  use while the lake is.
                </li>
              </ul>
              <p>
                The practical version: a household that sets aside a flat
                monthly reserve will be fine. A household budgeting off a
                single month's bills will be wrong twice a year, in both
                directions.
              </p>
            </>
          ),
        },
        {
          id: "get-numbers",
          heading: "How to get the actual numbers yourself",
          body: (
            <>
              <p>
                This page deliberately doesn't print figures. Here is how to
                get accurate ones for the address you're actually considering
                — all of it more reliable than any number a guide could
                publish.
              </p>
              <ol>
                <li>
                  <strong>Pull the mill rate for the specific municipality.</strong>{" "}
                  Lake Geneva, Williams Bay, Fontana, Linn and Genoa City are
                  separate taxing bodies; a rate quoted for one tells you
                  nothing certain about another. Walworth County and the
                  municipal clerk are the sources of record — not a listing
                  sheet and not a national real-estate portal.
                </li>
                <li>
                  <strong>Ask what the assessment did after the last sale.</strong>{" "}
                  It matters most on lakefront, where assessments can shift
                  meaningfully after a recent transaction. What the current
                  owner pays is not necessarily what you'll pay.
                </li>
                <li>
                  <strong>Request twelve months of utility history from the seller.</strong>{" "}
                  A full year of statements, not a summary. You're looking for
                  the January number, not the average.
                </li>
                <li>
                  <strong>Get plowing, lawn care and pier service quoted separately, as annual figures.</strong>{" "}
                  These are the three costs most often folded into a vague
                  "maintenance" estimate, and the three most often wrong. Ask
                  providers directly, before you close.
                </li>
                <li>
                  <strong>Ask an association what it can assess, not just what it charges.</strong>{" "}
                  If there's an HOA or beach association, the dues are the
                  published number. The ability to levy a special assessment
                  is the one that decides your worst year.
                </li>
                <li>
                  <strong>Put the state-level figures in context.</strong>{" "}
                  Wisconsin's effective property tax rate runs among the
                  higher in the country and Walworth County is in line with
                  that; the Wisconsin Department of Revenue is where the
                  statewide comparisons come from. Wisconsin income tax
                  brackets apply, and there's no separate Walworth County
                  income tax layered on top.
                </li>
              </ol>
              <p>
                None of this takes more than a few phone calls and one records
                request. It is the difference between a budget and a guess.
              </p>
            </>
          ),
        },
        {
          id: "summary",
          heading: "The short version",
          body: (
            <>
              <p>
                If you're moving inland and not pursuing lake access,
                the cost of living here is in line with most small
                Wisconsin cities — solid value relative to the
                Chicago and Milwaukee metros.
              </p>
              <p>
                If you're moving for the lake, the housing premium
                and the lake-related carrying costs are the two
                numbers most people meaningfully underestimate. The{" "}
                <Link to="/guides/moving-to-lake-geneva" className={LINK}>
                  full relocation guide
                </Link>{" "}
                is the companion read.
              </p>
              <p>
                And if you're still choosing between towns rather than between
                houses, the two comparisons buyers run most often —{" "}
                <Link to="/guides/lake-geneva-vs-williams-bay" className={LINK}>
                  Lake Geneva vs. Williams Bay
                </Link>{" "}
                and{" "}
                <Link to="/guides/fontana-vs-lake-geneva" className={LINK}>
                  Fontana vs. Lake Geneva
                </Link>{" "}
                — cover the ground this page deliberately leaves to them.
              </p>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
          <GuideNewsletterCTA />
          <SoftRealEstateCTA variant="housing" />
        </>
      }
      related={[
        {
          title: "Lake Geneva Real Estate Market Report",
          path: "/market-report",
          blurb: "The monthly snapshot — median price, days on market, lakefront vs inland.",
        },
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "What year-round life here actually feels like.",
        },
        {
          title: "Lake Geneva Schools",
          path: "/guides/lake-geneva-schools",
          blurb: "District boundaries don't follow town lines — and they decide your mill rate.",
        },
        {
          title: "Lake Geneva Neighborhoods",
          path: "/guides/lake-geneva-neighborhoods",
          blurb: "Which town you're actually shopping in, before you compare budgets.",
        },
        {
          title: "Lake Geneva vs. Williams Bay",
          path: "/guides/lake-geneva-vs-williams-bay",
          blurb: "The inland-premium comparison buyers run most often.",
        },
        {
          title: "Fontana vs. Lake Geneva",
          path: "/guides/fontana-vs-lake-geneva",
          blurb: "The west end, and the second-home cost profile in more detail.",
        },
      ]}
      faqs={[
        {
          question: "Is Lake Geneva, Wisconsin expensive to live in?",
          answer:
            "It depends entirely on lake access. Inland Lake Geneva is roughly in line with other small Wisconsin cities. Lake-access and lakefront housing carry meaningful premiums and ongoing carrying costs that don't show up in standard cost-of-living calculators.",
        },
        {
          question: "What are property taxes like in Lake Geneva?",
          answer:
            "Wisconsin's effective property tax rate is among the higher in the country, and Walworth County is in line with that. Mill rates vary by municipality (Lake Geneva, Williams Bay, Fontana, Linn, Genoa City). Always pull the current rate from the county before a move.",
        },
        {
          question: "Which municipality's property tax rate will I actually pay?",
          answer:
            "The one your parcel sits in. Lake Geneva, Williams Bay, Fontana, Linn and Genoa City each set their own mill rate, and school district boundaries don't reliably follow municipal lines here — so the district you buy into and the rate you pay are effectively one decision. Confirm both for a specific address rather than for a town name.",
        },
        {
          question: "Does Walworth County have a county income tax?",
          answer:
            "No. Wisconsin state income tax brackets apply, but there is no separate Walworth County income tax layered on top of them.",
        },
        {
          question: "Why do lakefront property taxes change after a sale?",
          answer:
            "Assessments can shift meaningfully after a recent sale, and lakefront is where that shift tends to be largest. What the current owner pays is not a reliable guide to what a new buyer will pay — ask what the assessment did after the last transaction before you underwrite the purchase.",
        },
        {
          question: "Is heating expensive in Lake Geneva?",
          answer:
            "Winter natural-gas and electric bills run noticeably higher than the same square footage in a milder climate, and it's the seasonal swing newcomers most often underestimate. Ask a seller for twelve months of utility history rather than an annual average — the average hides the months that hurt.",
        },
        {
          question: "How far is Lake Geneva from Chicago?",
          answer:
            "About 80 miles from downtown Chicago — plan 90 minutes door-to-door on a good day — and about 50 miles from downtown Milwaukee, which is generally a 50-to-70-minute drive. For a commuting household that makes fuel and vehicle wear a fixed budget line rather than an afterthought.",
        },
        {
          question: "Is there a train from Lake Geneva to Chicago?",
          answer:
            "There's no commuter rail serving Lake Geneva. Households that work in either metro drive, and many work a hybrid schedule rather than a five-day in-office week — which is why fuel and vehicle wear belong in the budget as a fixed line item.",
        },
        {
          question: "Are groceries expensive in Lake Geneva?",
          answer:
            "Groceries are roughly in line with the regional Wisconsin average, with a small tourist-town premium on a few downtown categories. Dining splits between locals' supper-club pricing and resort or lakeside pricing, which is meaningfully higher. Many locals make bigger grocery runs in Delavan or Burlington — for selection more than for price.",
        },
        {
          question: "What are the hidden costs of lake access?",
          answer:
            "Pier removal in the fall and reinstall in the spring, boat lifts, seawall and shoreline maintenance, boat upkeep and storage, and HOA or beach-association dues. None of these appear in a generic cost-of-living calculator, which is why they're the costs that surprise otherwise well-prepared buyers.",
        },
      ]}
    />
  );
}
