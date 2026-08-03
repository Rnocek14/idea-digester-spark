import { GuideShell } from "@/components/guides/GuideShell";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

/**
 * Evergreen URL: /market-report. Update the snapshot block monthly
 * (or whenever fresh numbers land). Keep the URL stable so authority
 * compounds — never version the path.
 */
export default function LakeGenevaMarketReport() {
  return (
    <GuideShell
      title="Lake Geneva Real Estate Market Report"
      metaTitle="Lake Geneva Real Estate Market Report — Updated Monthly"
      metaDescription="A monthly snapshot of the Lake Geneva, Wisconsin real estate market — median price, days on market, inventory, lakefront vs inland, and what's actually happening on the shoreline."
      path="/market-report"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            This is the local market read most relocating families and
            second-home buyers ask for — the one that tries to answer
            "what's the Lake Geneva market actually doing right now?"
            without the spin.
          </p>
          <p>
            The page is updated monthly. The URL never changes. If you
            bookmark this, you'll always see the most current snapshot.
          </p>
        </>
      }
      introExtra={
        <div className="not-prose rounded-md border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            This month's snapshot
          </p>
          <p className="text-slate-700 text-base leading-relaxed">
            Numbers come from the Zillow Home Value Index (public research
            data, zip-level) and refresh automatically each month; the
            listings count carries between refreshes. For the live, address-level view of
            what's listed and what's pending, the running picture is best
            seen alongside Gina Nocek's working notes on the{" "}
            <Link to="/selling-lake-geneva" className="text-blue-700 hover:underline font-medium">
              selling guide page
            </Link>
            .
          </p>
        </div>
      }
      sections={[
        {
          id: "snapshot",
          heading: "The market at a glance",
          body: (
            <>
              <p>
                The Lake Geneva-area market typically splits into three
                very different sub-markets that don't move in lockstep:
              </p>
              <ul>
                <li>
                  <strong>Lakefront</strong> — limited supply, deep
                  demand, price per linear foot of shoreline matters
                  more than square footage. The most resistant to
                  national rate cycles.
                </li>
                <li>
                  <strong>Lake-access and water-view</strong> — the
                  middle market. Tracks national rate sentiment more
                  closely than lakefront.
                </li>
                <li>
                  <strong>Inland (City of Lake Geneva, Genoa City,
                  rural Walworth)</strong> — the most "normal" market
                  here. Day-to-day life buyers, families, year-rounders.
                </li>
              </ul>
              <p>
                When the headlines say "Lake Geneva market," they
                usually mean one of these three and not the others.
              </p>
            </>
          ),
        },
        {
          id: "lakefront",
          heading: "Lakefront: a separate market",
          body: (
            <>
              <p>
                Geneva Lake's lakefront is a closed system — the lake is
                only so big, and very few properties trade in any given
                year. The honest summary: inventory stays tight, the
                ceiling continues to rise on the south and west shores,
                and well-maintained estate-scale properties remain the
                fastest-moving segment when one comes available.
              </p>
              <p>
                Pricing here is less about square footage and more about
                shoreline frontage, lot exposure, pier rights, and the
                condition of the seawall. National rate moves matter
                less to this segment than they do to a typical
                metropolitan suburb.
              </p>
            </>
          ),
        },
        {
          id: "lake-access",
          heading: "Lake-access and water-view homes",
          body: (
            <>
              <p>
                Lake-access homes — properties tied to deeded pier
                rights or to a homeowner-association beach — are the
                middle market most second-home buyers are actually
                shopping. They track interest rates more closely than
                lakefront and tend to sit longer when rates climb,
                faster when they ease.
              </p>
              <p>
                The water-view market — homes with a real view but no
                deeded access — sits between this segment and a
                normal residential market.
              </p>
            </>
          ),
        },
        {
          id: "inland",
          heading: "Inland: the everyday market",
          body: (
            <>
              <p>
                The City of Lake Geneva, Genoa City, and the surrounding
                townships make up the year-round housing market most
                relocating families end up in. Days on market, median
                price, and inventory here behave much more like other
                small Wisconsin cities — rate-sensitive, seasonal in
                rhythm, and tied to school-year decision points.
              </p>
            </>
          ),
        },
        {
          id: "neighborhoods",
          heading: "What's moving where",
          body: (
            <>
              <p>
                Recent patterns we keep seeing:
              </p>
              <ul>
                <li>
                  Williams Bay continues to draw families specifically
                  for the K-12 district and the quieter shoreline.
                </li>
                <li>
                  Fontana attracts second-home buyers who want a less
                  trafficked downtown than Lake Geneva proper.
                </li>
                <li>
                  The City of Lake Geneva remains the most active
                  year-round inventory, especially walkable
                  neighborhoods near downtown and Library Park.
                </li>
                <li>
                  Linn Township properties with even modest water
                  access keep clearing quickly.
                </li>
              </ul>
              <p>
                For neighborhood-by-neighborhood detail, the{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className="text-blue-700 hover:underline font-medium">
                  neighborhoods guide
                </Link>{" "}
                is the longer read.
              </p>
            </>
          ),
        },
        {
          id: "what-to-watch",
          heading: "What to watch this month",
          body: (
            <>
              <p>
                Three indicators that tend to move first in this market:
              </p>
              <ul>
                <li>
                  Months of supply on the inland (non-lake) market —
                  the truest read on local demand.
                </li>
                <li>
                  Time-on-market for lake-access properties in the
                  middle tier — the early sign of a rate-driven shift.
                </li>
                <li>
                  Number of off-market lakefront transactions — a
                  meaningful share of lakefront sales here never hit
                  the public MLS at all.
                </li>
              </ul>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
          <SoftRealEstateCTA variant="market" />
        </>
      }
      related={[
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "The full relocation guide — what year-round life here actually feels like.",
        },
        {
          title: "Cost of Living in Lake Geneva",
          path: "/guides/cost-of-living-lake-geneva",
          blurb: "Housing, taxes, utilities, and the everyday numbers behind a move here.",
        },
      ]}
      faqs={[
        {
          question: "How often is this report updated?",
          answer:
            "Monthly. The URL stays the same; only the snapshot data changes. Bookmark this page and you'll always see the current month's read.",
        },
        {
          question: "Where does the data come from?",
          answer:
            "Walworth County MLS, public Wisconsin DPI and county records, and on-the-ground observation from Gina Nocek's working transactions. Off-market lakefront sales are noted when known but not always reflected in MLS-only summaries.",
        },
        {
          question: "Is the Lake Geneva lakefront market different from the rest?",
          answer:
            "Yes — meaningfully so. Lakefront tracks shoreline supply more than national rate cycles. Lake-access and inland markets behave more like typical Wisconsin housing, with normal rate sensitivity and seasonal rhythm.",
        },
      ]}
    />
  );
}