import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { localBusinessJsonLd } from "@/lib/seo/jsonLd";

/** Business page for "piggly wiggly lake geneva" — the town's main grocery query. */
export default function StinebrinksPigglyWiggly() {
  return (
    <GuideShell
      title="Stinebrink's Piggly Wiggly, Lake Geneva"
      metaTitle="Piggly Wiggly Lake Geneva WI — Hours, Address & DMV Kiosk"
      metaDescription="Stinebrink's Piggly Wiggly at Geneva Square in Lake Geneva: grocery hours, the meat counter, the in-store Wisconsin DMV EZ-TAB kiosk, address and phone."
      path="/businesses/stinebrinks-piggly-wiggly"
      dateModified={new Date().toISOString().slice(0, 10)}
      extraJsonLd={[
        localBusinessJsonLd({
          type: "GroceryStore",
          name: "Stinebrink's Piggly Wiggly",
          description:
            "Family-owned full-service supermarket in Lake Geneva, Wisconsin, with a full meat counter and an authorized Wisconsin DMV EZ-TAB license plate renewal kiosk in store.",
          streetAddress: "100 East Geneva Square",
          telephone: "+1-262-248-8798",
          url: "https://www.shopthepig.com/",
          path: "/businesses/stinebrinks-piggly-wiggly",
        }),
      ]}
      intro={
        <>
          <p>
            Stinebrink's Piggly Wiggly at Geneva Square is the grocery store
            locals mean when they say "the Pig." It's family-run — the
            Stinebrinks have been at it in this area for more than fifty years —
            and it's on the eastern edge of the city, away from the downtown
            parking scrum.
          </p>
          <p className="text-sm text-slate-600">
            100 East Geneva Square, Lake Geneva ·{" "}
            <a href="tel:+12622488798" className="text-blue-700 hover:underline">
              (262) 248-8798
            </a>{" "}
            ·{" "}
            <a
              href="https://www.shopthepig.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              shopthepig.com
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
                A full-service supermarket — the primary weekly-shop grocery for
                a lot of Lake Geneva households, and the restock stop for anyone
                renting a house on the lake for a week. The meat counter is the
                part people name unprompted; if you're grilling for a crowd,
                call ahead rather than hoping the case has what you need on a
                July Friday.
              </p>
              <p>
                Hours generally run early morning to 9pm daily. Holidays shift,
                so check before Thanksgiving or Christmas Eve.
              </p>
            </>
          ),
        },
        {
          id: "dmv-kiosk",
          heading: "The DMV kiosk (the part visitors don't know)",
          body: (
            <p>
              This location hosts an authorized Wisconsin DMV EZ-TAB kiosk. You
              can renew your license plate registration inside the store and
              walk out with the sticker in hand — no appointment, no trip to a
              service center. For residents that alone makes it the most useful
              building in town on the wrong day of the month.
            </p>
          ),
        },
        {
          id: "getting-there",
          heading: "Getting there and parking",
          body: (
            <p>
              Geneva Square sits on the east side of the city off Highway 50,
              with a large surface lot — the easy answer if downtown parking is
              full. Coming from a rental on the south shore, it's the sensible
              first stop before you unpack.
            </p>
          ),
        },
        {
          id: "nearby",
          heading: "What's nearby",
          body: (
            <p>
              Geneva Square holds several other everyday errands in one lot.
              If you're new here, the{" "}
              <Link to="/guides/moving-to-lake-geneva" className="text-blue-700 hover:underline">
                moving to Lake Geneva guide
              </Link>{" "}
              covers the rest of the practical map, and the{" "}
              <Link to="/businesses" className="text-blue-700 hover:underline">
                local business pages
              </Link>{" "}
              collect the individual stops.
            </p>
          ),
        },
      ]}
      faqs={[
        {
          question: "Where is the Piggly Wiggly in Lake Geneva?",
          answer:
            "Stinebrink's Piggly Wiggly is at 100 East Geneva Square in Lake Geneva, Wisconsin, in the Geneva Square shopping center on the east side of the city.",
        },
        {
          question: "Can you renew license plates at the Lake Geneva Piggly Wiggly?",
          answer:
            "Yes. The store hosts an authorized Wisconsin DMV EZ-TAB kiosk, so you can renew your vehicle registration and get the sticker immediately in store.",
        },
        {
          question: "What are Piggly Wiggly Lake Geneva's hours?",
          answer:
            "Hours generally run from early morning until 9pm daily. Holiday hours vary, so call (262) 248-8798 to confirm around major holidays.",
        },
      ]}
      related={[
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "The practical guide — schools, costs, neighborhoods, everyday errands.",
        },
        {
          title: "Local businesses",
          path: "/businesses",
          blurb: "The shops, groceries and everyday places people actually ask about.",
        },
      ]}
    />
  );
}