import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

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
        </>
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
                  <Link to="/market-report" className="text-blue-700 hover:underline font-medium">
                    monthly market report
                  </Link>{" "}
                  for current reads.
                </li>
              </ul>
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
            </>
          ),
        },
        {
          id: "utilities",
          heading: "Utilities and seasonal costs",
          body: (
            <>
              <p>
                Heating cost is the seasonal swing most newcomers
                underestimate. Winter natural-gas and electric bills
                run noticeably higher than the same square footage in
                a milder climate. Pier removal, plowing, lawn care,
                and lake-related maintenance (boats, lifts, seawalls)
                are the lakefront/lake-access carrying costs that
                rarely show up in a generic "cost of living" calculator.
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
            </>
          ),
        },
        {
          id: "commute",
          heading: "Commute and transportation",
          body: (
            <>
              <p>
                Lake Geneva is roughly 90 minutes from downtown
                Chicago and downtown Milwaukee. There's no commuter
                rail; most professional commuters drive or commute
                hybrid. Gas, vehicle wear, and winter driving costs
                are real line items for households that work in
                either metro.
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
                <Link to="/guides/moving-to-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  full relocation guide
                </Link>{" "}
                is the companion read.
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
      ]}
    />
  );
}