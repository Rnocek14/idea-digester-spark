import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Winterfest + the U.S. National Snow Sculpting Championship.
 * Deliberately avoids printing this year's dates, hours, and prices —
 * those change annually and a stale number is worse than none. The page
 * teaches the weekend instead: what happens, where to stand, where to park.
 */
export default function LakeGenevaWinterfest() {
  return (
    <GuideShell
      title="Lake Geneva Winterfest"
      metaTitle="Lake Geneva Winterfest Guide — Snow Sculpting, Parking, What to Expect"
      metaDescription="A local's guide to Lake Geneva Winterfest and the U.S. National Snow Sculpting Championship: what happens each day, where to park, when the sculptures look best, and how to stay warm."
      path="/guides/lake-geneva-winterfest"
      datePublished="2026-07-30"
      intro={
        <>
          <p>
            Winterfest is the one weekend in February when downtown Lake Geneva feels
            like the Fourth of July with mittens on. Flat Iron Park fills with
            competition blocks, Broad Street backs up, and the lakefront draws
            thousands of people who came to watch snow become sculpture.
          </p>
          <p className="mt-4">
            At the center of it is the U.S. National Snow Sculpting Championship —
            state-champion teams carving oversized blocks by hand over several days,
            with no power tools and no color. This guide covers how the weekend
            actually works: when to arrive, where to park, what the kids will and
            won't sit still for, and how to see the finished work without standing
            in the thickest of the crowd.
          </p>
        </>
      }
      sections={[
        {
          id: "what-it-is",
          heading: "What Winterfest actually is",
          body: (
            <>
              <p>
                Two things happen at once. The championship is the anchor: teams
                representing their states carve giant blocks of packed snow in Flat
                Iron Park over several days, judged at the end of the week. Around
                it sits a festival — food vendors, warming spots, downtown shops
                running their busiest winter hours of the year, and a schedule of
                family events that shifts a little from year to year.
              </p>
              <p className="mt-4">
                The carving is the part worth planning around. Watching a block go
                from a white cube to a finished piece is more interesting than
                seeing the finished piece alone, and midweek carving days are far
                calmer than the weekend.
              </p>
            </>
          ),
        },
        {
          id: "when-to-go",
          heading: "Best day and time to go",
          body: (
            <>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Midweek carving days:</strong> the quietest way to see it.
                  Sculptors are working, parking is findable, and you can talk to
                  teams.
                </li>
                <li>
                  <strong>Judging day and the weekend:</strong> the sculptures are
                  finished and the crowd is at its peak. Arrive before mid-morning
                  or after mid-afternoon if you want to move.
                </li>
                <li>
                  <strong>After dark:</strong> the finished pieces are lit and the
                  crowd thins considerably. This is the underrated visit.
                </li>
                <li>
                  <strong>Warm spells:</strong> a thaw softens details fast. If the
                  forecast climbs above freezing, go earlier in the week rather
                  than later.
                </li>
              </ul>
              <p className="mt-4">
                Exact dates move each year. Check the{" "}
                <Link to="/events" className={LINK}>
                  Lake Geneva events calendar
                </Link>{" "}
                for the current schedule before you book anything.
              </p>
            </>
          ),
        },
        {
          id: "parking",
          heading: "Parking and getting around",
          body: (
            <>
              <p>
                Downtown lots fill early on the busy days, and the streets nearest
                Flat Iron Park are the first to go. A few things that help:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>
                  Park several blocks back and walk in. Winterfest is a walking
                  event — a five-minute walk from a side street beats twenty
                  minutes circling the lakefront.
                </li>
                <li>
                  Watch for posted winter parking restrictions on residential
                  streets; they are enforced during the festival.
                </li>
                <li>
                  Sidewalks and the lakefront path get packed and icy. Boots with
                  real tread matter more than a heavy coat.
                </li>
                <li>
                  Strollers struggle in packed snow. A sled or carrier is the
                  local move with small kids.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "with-kids",
          heading: "Doing it with kids",
          body: (
            <>
              <p>
                Kids love the sculptures for about twenty minutes and then want to
                be warm. Plan the visit around that. See the carving, then move
                indoors — downtown shops, a bakery, a long lunch — and come back
                after dark if the group still has energy.
              </p>
              <p className="mt-4">
                For a broader list of cold-weather options nearby, see{" "}
                <Link to="/guides/things-to-do-lake-geneva-with-kids" className={LINK}>
                  things to do with kids
                </Link>{" "}
                and{" "}
                <Link to="/guides/things-to-do-lake-geneva-in-winter" className={LINK}>
                  things to do in winter
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "staying-eating",
          heading: "Where to stay and eat that weekend",
          body: (
            <>
              <p>
                Winterfest weekend is the one winter weekend that behaves like
                July. Rooms go early and restaurants run full. Book lodging well
                ahead, and make dinner reservations rather than planning to walk
                in.
              </p>
              <p className="mt-4">
                Start with{" "}
                <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                  where to stay in Lake Geneva
                </Link>{" "}
                and the{" "}
                <Link to="/best-of/restaurants-lake-geneva" className={LINK}>
                  restaurant picks
                </Link>
                . If you would rather stay off the main drag, the{" "}
                <Link to="/guides/lake-geneva-vs-williams-bay" className={LINK}>
                  Williams Bay comparison
                </Link>{" "}
                is worth a read.
              </p>
              <GuideNewsletterCTA />
            </>
          ),
        },
        {
          id: "what-to-wear",
          heading: "What to wear",
          body: (
            <p>
              You will be standing still outdoors in February, which is colder than
              walking around in February. Layers, insulated and waterproof boots,
              hand warmers, and a hat that covers your ears. Check the{" "}
              <Link to="/lake-geneva-weather" className={LINK}>
                current Lake Geneva forecast
              </Link>{" "}
              the morning you go — wind off the lake is the variable that decides
              how long anyone lasts.
            </p>
          ),
        },
      ]}
      faqs={[
        {
          question: "When is Lake Geneva Winterfest?",
          answer:
            "Winterfest is held in downtown Lake Geneva in February, running several days around the U.S. National Snow Sculpting Championship. Exact dates shift each year, so confirm on the current events calendar before booking.",
        },
        {
          question: "Is Winterfest free to attend?",
          answer:
            "Walking through Flat Iron Park to see the snow sculptures is free. Individual festival activities, food, and some events may have their own cost.",
        },
        {
          question: "Where is the snow sculpting competition held?",
          answer:
            "The U.S. National Snow Sculpting Championship blocks are carved in Flat Iron Park along the Lake Geneva lakefront, a short walk from downtown.",
        },
        {
          question: "What is the best time to see the snow sculptures?",
          answer:
            "Midweek carving days are the quietest and let you watch the work in progress. For finished sculptures with a thinner crowd, go after dark when the pieces are lit.",
        },
        {
          question: "Where should I park for Winterfest?",
          answer:
            "Downtown lots near the lakefront fill early on peak days. Park several blocks back and walk in, and watch for posted winter parking restrictions on residential streets.",
        },
      ]}
      related={[
        {
          title: "Things to do in Lake Geneva in winter",
          path: "/guides/things-to-do-lake-geneva-in-winter",
          blurb: "The full cold-weather list beyond Winterfest weekend.",
        },
        {
          title: "Where to stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb: "Resorts, inns, and rentals — and how far each is from downtown.",
        },
        {
          title: "Lake Geneva events calendar",
          path: "/events",
          blurb: "Current dates for Winterfest and everything else on the calendar.",
        },
      ]}
      bottomExtra={<SoftRealEstateCTA />}
    />
  );
}
