import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { localBusinessJsonLd } from "@/lib/seo/jsonLd";

/** Business page for the "bruno's lake geneva" directory query. */
export default function BrunosLiquors() {
  return (
    <GuideShell
      title="Bruno's Liquors, Lake Geneva"
      metaTitle="Bruno's Liquors, Lake Geneva WI — Hours, Kegs & Location"
      metaDescription="Bruno's Liquors on Broad Street in Lake Geneva: wine, spirits and craft beer, keg orders, event beverage catering, hours, address and phone."
      path="/businesses/brunos-liquors"
      dateModified={new Date().toISOString().slice(0, 10)}
      extraJsonLd={[
        localBusinessJsonLd({
          type: "LiquorStore",
          name: "Bruno's Liquors",
          description:
            "Full-service liquor store in Lake Geneva, Wisconsin with wine, spirits and craft beer, a keg list, and beverage catering for weddings and events.",
          streetAddress: "524 Broad Street",
          telephone: "+1-262-248-6407",
          url: "http://www.brunosliquor.com/",
          path: "/businesses/brunos-liquors",
          openingHours: ["Mo-Su 09:00-21:00"],
        }),
      ]}
      intro={
        <>
          <p>
            Bruno's Liquors sits on Broad Street just south of the main downtown
            strip — about five blocks from the Riviera and two from
            Horticultural Hall, which is why it ends up being the stop before
            half the weddings and rehearsal dinners in town. It bills itself as
            Lake Geneva's largest liquor store, and the keg list backs that up.
          </p>
          <p className="text-sm text-slate-600">
            524 Broad St, Lake Geneva · 9am–9pm daily ·{" "}
            <a href="tel:+12622486407" className="text-blue-700 hover:underline">
              (262) 248-6407
            </a>{" "}
            ·{" "}
            <a
              href="http://www.brunosliquor.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              brunosliquor.com
            </a>
          </p>
        </>
      }
      sections={[
        {
          id: "what-it-is",
          heading: "What it is",
          body: (
            <>
              <p>
                A full-service liquor store: wine, spirits and craft beer, with
                a deeper-than-expected shelf of hard-to-find scotches and
                bourbons. It's the practical answer for anything a grocery-store
                aisle won't cover.
              </p>
              <p>
                Kegs are the other reason people come. Bruno's keeps a standing
                keg list and takes orders ahead, which matters in a town where a
                summer weekend can clean out the obvious choices.
              </p>
            </>
          ),
        },
        {
          id: "events",
          heading: "Kegs and event catering",
          body: (
            <p>
              Beyond retail, Bruno's does beverage catering for weddings,
              parties and corporate events around the Geneva Lakes area — the
              kind of arrangement where they help you figure out quantities
              instead of leaving you guessing. If you're planning something at
              the Riviera or one of the resorts, calling ahead is worth more
              than a walk-in.
            </p>
          ),
        },
        {
          id: "hours",
          heading: "Hours and getting there",
          body: (
            <p>
              Open 9am to 9pm, seven days a week. Broad Street parking is
              easier here than in the blocks closer to the water, which is a
              quiet argument for stopping on your way in rather than after
              you've parked downtown. Wisconsin retail alcohol sale hours end at
              9pm, so late arrivals are out of luck.
            </p>
          ),
        },
        {
          id: "nearby",
          heading: "What's nearby",
          body: (
            <p>
              You're two blocks from Horticultural Hall and a short walk from
              the lakefront. For the rest of the everyday-errands map, see the{" "}
              <Link to="/businesses" className="text-blue-700 hover:underline">
                local business pages
              </Link>
              , and for a weekend built around downtown, the{" "}
              <Link to="/guides/things-to-do-lake-geneva" className="text-blue-700 hover:underline">
                things-to-do guide
              </Link>
              .
            </p>
          ),
        },
      ]}
      faqs={[
        {
          question: "Where is Bruno's Liquors in Lake Geneva?",
          answer:
            "Bruno's Liquors is at 524 Broad Street in Lake Geneva, Wisconsin, about five blocks from the Riviera Ballroom and two blocks from Horticultural Hall.",
        },
        {
          question: "What are Bruno's Liquors hours?",
          answer:
            "Bruno's Liquors is open 9am to 9pm, seven days a week.",
        },
        {
          question: "Can you order a keg from Bruno's in Lake Geneva?",
          answer:
            "Yes. Bruno's keeps an extensive keg list and takes keg orders by phone at (262) 248-6407. They also handle beverage catering for weddings and events.",
        },
      ]}
      related={[
        {
          title: "Local businesses",
          path: "/businesses",
          blurb: "The shops, groceries and everyday places people actually ask about.",
        },
        {
          title: "Where to stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb: "Hotels, resorts and rentals, with what each is actually good for.",
        },
      ]}
    />
  );
}