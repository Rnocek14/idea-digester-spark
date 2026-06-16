import { GuideShell } from "@/components/guides/GuideShell";

/**
 * Cornerstone SEO target: "yerkes observatory" (~6.6K/mo, KDI 42).
 * Williams Bay landmark — world's largest refracting telescope, recently
 * reopened to the public. We rank for the visitor-intent slice: hours,
 * tours, what to expect, history, parking.
 */
export default function YerkesObservatory() {
  return (
    <GuideShell
      title="Yerkes Observatory — Visiting Williams Bay's Historic Telescope"
      metaTitle="Yerkes Observatory (2026): Tours, Hours, History, Visiting Guide"
      metaDescription="A neighbor's guide to visiting Yerkes Observatory in Williams Bay, Wisconsin — tour hours, what to see, the world's largest refracting telescope, history, parking, and tips."
      path="/guides/yerkes-observatory"
      dateModified={new Date().toISOString().slice(0, 10)}
      intro={
        <>
          <p>
            Yerkes Observatory in Williams Bay is the kind of place that
            sneaks up on first-time visitors. From the outside it looks like
            a grand 1897 mansion sitting above Geneva Lake; step inside the
            great dome and you're standing under the largest successful
            refracting telescope ever built — a 40-inch lens that Edwin
            Hubble once looked through. After decades as a working University
            of Chicago research site, Yerkes reopened to the public in 2022
            under the nonprofit Yerkes Future Foundation, and tours are now
            the main way to see it.
          </p>
          <p>
            Here's what we tell friends visiting Lake Geneva who ask whether
            it's worth the drive over to Williams Bay. Short answer: yes,
            but book ahead — tours sell out, especially summer weekends.
          </p>
        </>
      }
      sections={[
        {
          id: "tours-hours",
          heading: "Tours and hours",
          body: (
            <>
              <p>
                Yerkes is open to the public by guided tour and grounds
                access only — you can't wander into the dome unannounced.
                Tickets are booked online through the Yerkes Future
                Foundation. The current schedule typically runs Wednesday
                through Sunday, with daytime architecture and telescope
                tours plus occasional evening observing sessions when
                weather cooperates.
              </p>
              <ul>
                <li>
                  <a
                    href="https://www.yerkesobservatory.org/visit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    Official ticket page — Yerkes Future Foundation
                  </a>
                </li>
                <li>Address: 373 W Geneva St, Williams Bay, WI 53191</li>
                <li>
                  Tip: book the 40-inch refractor tour rather than the
                  grounds-only ticket if you want to actually stand under
                  the great dome.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "what-youll-see",
          heading: "What you'll see on a tour",
          body: (
            <>
              <p>
                The 40-inch refractor is the headliner. The lens at the
                top of the tube is the largest of its kind that's ever
                actually worked for astronomy — bigger refractors were
                attempted but failed under their own weight. The whole
                floor of the dome is a giant elevator that rises to meet
                the eyepiece, which still impresses kids and adults the
                same way it did in 1897.
              </p>
              <p>
                The smaller domes house a 41-inch reflector and a 24-inch
                reflector still used for outreach observing. The building
                itself is worth the trip — terracotta zodiac reliefs, owl
                gargoyles, and a marble entry hall that feels closer to a
                Gilded Age library than a science facility.
              </p>
            </>
          ),
        },
        {
          id: "history",
          heading: "A short history",
          body: (
            <p>
              Yerkes was funded by Chicago streetcar magnate Charles T.
              Yerkes and built by the University of Chicago. It opened in
              1897 and quickly became the most important observatory in
              the world — George Ellery Hale, Edwin Hubble, Carl Sagan,
              Subrahmanyan Chandrasekhar, and Gerard Kuiper all worked
              here. The University ceased operations in 2018, donated the
              property to the Yerkes Future Foundation in 2020, and the
              site reopened to the public after restoration in 2022.
            </p>
          ),
        },
        {
          id: "visiting-tips",
          heading: "Practical visiting tips",
          body: (
            <ul>
              <li>
                <strong>Parking:</strong> free lot on site, fills up fast
                during summer tour blocks.
              </li>
              <li>
                <strong>Accessibility:</strong> the main floor and great
                dome are accessible; some upper observation areas involve
                stairs.
              </li>
              <li>
                <strong>Kids:</strong> tours work well for roughly age 7+.
                The dome elevator is the universal hit.
              </li>
              <li>
                <strong>Photography:</strong> allowed; tripods at the
                guide's discretion.
              </li>
              <li>
                <strong>Pair it with:</strong> lunch in Williams Bay, a
                walk on the Shore Path past Kishwauketoe Nature
                Conservancy, or a stop at Daddy Maxwell's diner.
              </li>
            </ul>
          ),
        },
      ]}
      faqs={[
        {
          question: "Is Yerkes Observatory open to the public?",
          answer:
            "Yes — by guided tour and grounds ticket only, booked in advance through the Yerkes Future Foundation. Walk-ins are not guaranteed entry.",
        },
        {
          question: "How much do Yerkes Observatory tours cost?",
          answer:
            "Ticket prices vary by tour type. Grounds-only tickets are the most affordable; 40-inch refractor and architecture tours cost more. Check the official ticket page for current pricing.",
        },
        {
          question: "Can you look through the telescope?",
          answer:
            "Daytime tours show you the 40-inch refractor and explain how it works, but actual observing happens during scheduled evening programs, weather permitting.",
        },
        {
          question: "How long does a Yerkes tour take?",
          answer:
            "Plan on about 60–90 minutes for a typical guided tour, longer if you combine it with the grounds and exhibits.",
        },
        {
          question: "Where is Yerkes Observatory?",
          answer:
            "373 W Geneva St, Williams Bay, WI — about 10 minutes west of downtown Lake Geneva, on the north shore of Geneva Lake.",
        },
      ]}
      related={[
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "The 21-mile public walking path circles the entire lake — and passes right by Yerkes.",
        },
        {
          title: "Lake Geneva vs. Williams Bay",
          path: "/guides/lake-geneva-vs-williams-bay",
          blurb:
            "How the two lake towns differ — pace, schools, real estate, and what each is known for.",
        },
        {
          title: "Things to do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb: "Our running list of what's actually worth doing around the lake.",
        },
      ]}
    />
  );
}