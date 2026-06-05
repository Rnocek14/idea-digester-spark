import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function ThingsToDoLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva, Wisconsin"
      metaTitle="Things to Do in Lake Geneva, WI — A Local's Guide (Updated 2026)"
      metaDescription="A local's guide to Lake Geneva, Wisconsin: the lake, the shore path, the downtown, food and drink, family-friendly stops, and what's actually worth your weekend."
      path="/guides/things-to-do-lake-geneva"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Lake Geneva is small. You can drive the lake in under an hour, walk
            the downtown in fifteen minutes, and still find new corners after a
            decade of summers here. This guide is the one The Brief editors
            would hand a visiting friend — what to actually do, when to go, and
            how to skip the bits that mostly serve buses.
          </p>
          <p>
            The town built itself around three things: the water, the shore
            path, and a long history of Chicago weekenders. Everything else —
            the restaurants, the resorts, the seasonal festivals — grew up
            around those.
          </p>
        </>
      }
      introExtra={
        <div className="not-prose rounded-md border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Looking for what's on this week?
          </p>
          <p className="text-slate-700 text-base">
            The{" "}
            <Link to="/events" className="text-blue-700 hover:underline font-medium">
              live events calendar
            </Link>{" "}
            is updated daily — concerts, festivals, farmers markets, kids' programming,
            everything we can verify. This guide is the evergreen "where do I even start"
            companion to that calendar.
          </p>
        </div>
      }
      sections={[
        {
          id: "the-lake",
          heading: "Start with the lake",
          body: (
            <>
              <p>
                Almost every visit eventually finds its way to the water. The
                most honest first stop is the public lakefront in Library Park —
                grab a coffee, sit on a bench, watch the mailboat go out. That
                hour tells you more about Lake Geneva than any brochure.
              </p>
              <p>
                <strong>The Geneva Lake Shore Path</strong> is the signature
                walk: 21 miles around the entire lake, threading through
                backyards of historic estates because of a public-access
                tradition dating to the Potawatomi. Most people do a 2–4 mile
                section. The stretch from Library Park toward Black Point is the
                classic intro.
              </p>
              <p>
                <strong>Boat tours and the U.S. Mailboat</strong> run from the
                Riviera Docks. The mailboat is a Lake Geneva original — the
                jumpers actually deliver mail by leaping onto piers at speed. If
                you only do one boat thing, do this.
              </p>
              <p>
                <strong>Renting your own boat</strong> is easier than people
                think. Several rental outfits operate out of the Riviera and
                Gage Marine; book mornings in summer or you'll wait.
              </p>
            </>
          ),
        },
        {
          id: "downtown",
          heading: "Walk the downtown",
          body: (
            <>
              <p>
                Downtown Lake Geneva is small enough to wander without a plan.
                The Riviera Building anchors the lakefront — the upstairs
                ballroom is one of the prettiest rooms in the state and worth a
                peek even between events.
              </p>
              <p>
                Main Street and Broad Street are where most of the independent
                shops live. The booksellers, the chocolate shops, a couple of
                long-running outdoor outfitters, and a rotating cast of newer
                boutiques. It's better in shoulder season — May, September,
                early October — when the sidewalks aren't shoulder-to-shoulder.
              </p>
              <p>
                For a quieter version, drive ten minutes to{" "}
                <strong>Williams Bay or Fontana</strong>. Smaller downtowns,
                same lake, half the crowd. Williams Bay's Edgewater Park has
                some of the best public beach access on the lake.
              </p>
            </>
          ),
        },
        {
          id: "food-drink",
          heading: "Food and drink, honestly",
          body: (
            <>
              <p>
                The dining scene runs the full range — supper clubs, lakeside
                patios, a couple of serious restaurants, and the inevitable
                tourist traps. The Brief's{" "}
                <Link to="/eats" className="text-blue-700 hover:underline font-medium">
                  dining coverage
                </Link>{" "}
                tracks what's open and what's worth it; this section is the
                evergreen frame.
              </p>
              <p>
                <strong>Friday fish fry</strong> is a Wisconsin contract. If
                you're here on a Friday, do one. We keep a running{" "}
                <Link to="/eats/fish-fry" className="text-blue-700 hover:underline font-medium">
                  fish fry guide
                </Link>{" "}
                with the current rotation.
              </p>
              <p>
                For lakeside meals, the resort dining rooms (Grand Geneva, The
                Abbey in Fontana, Pier 290 in Williams Bay) all have reliable
                kitchens and water views. For something less polished, the
                supper clubs north of town do exactly what supper clubs do, and
                do it well.
              </p>
              <p>
                Coffee scene is small but real: a couple of independent roasters
                downtown, more on the Williams Bay side. Breweries and tap
                rooms have grown noticeably in the last few years.
              </p>
            </>
          ),
        },
        {
          id: "with-kids",
          heading: "If you're here with kids",
          body: (
            <>
              <p>
                The lake itself does most of the heavy lifting. Beach time at
                Riviera Beach (downtown) or Edgewater Park (Williams Bay) plus a
                boat ride is a full day for most ages.
              </p>
              <p>
                Beyond the water: <strong>Yerkes Observatory</strong> in
                Williams Bay reopened after a multi-year restoration and runs
                family tours; <strong>Big Foot Beach State Park</strong> has
                shaded picnic areas and a more manageable swim area;{" "}
                <strong>Tristan Crist Magic Theatre</strong> downtown is a
                surprising rainy-day save; and the <strong>Geneva Lake
                Museum</strong> is small but well-curated for kids who want to
                understand the place.
              </p>
              <p>
                In winter, the Grand Geneva ski hill (Mountain Top) is genuinely
                beginner-friendly, and Winterfest brings the National
                Snow-Sculpting Championship to downtown for a week each
                February.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "What changes by season",
          body: (
            <>
              <p>
                <strong>Summer (June–August)</strong> is the obvious answer and
                also the busiest. Book lodging early, expect parking pressure
                downtown on weekends, and consider basing in Fontana or
                Williams Bay if you want quieter mornings.
              </p>
              <p>
                <strong>Fall (September–October)</strong> is, quietly, the best
                season. The crowds drop, the lake stays warm into late
                September, and the shore path through October is one of the
                better walks in the Midwest.
              </p>
              <p>
                <strong>Winter</strong> is real winter — ice fishing,
                cross-country trails, Winterfest in February. The town doesn't
                shut down; it just gets quieter and warmer-feeling.
              </p>
              <p>
                <strong>Spring</strong> is short and underrated. Late April
                through mid-June, before the summer crush, is the moment locals
                seem to enjoy the lake most.
              </p>
            </>
          ),
        },
        {
          id: "skip",
          heading: "A few honest skips",
          body: (
            <>
              <p>
                Not every well-marketed thing is worth your time. The Brief
                tries not to publish negative reviews of small local
                businesses, but a few general notes:
              </p>
              <ul>
                <li>
                  If you only have one day, skip the inland chain restaurants —
                  you can eat those anywhere.
                </li>
                <li>
                  The "haunted history" walking tours are fine if you like that
                  category; the Geneva Lake Museum tells the actual history
                  better.
                </li>
                <li>
                  Avoid trying to do downtown parking on a Saturday afternoon in
                  July. Park once, walk everywhere.
                </li>
              </ul>
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
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb:
            "What it's actually like to live here year-round — the rhythms, the trade-offs, and what surprises people.",
        },
        {
          title: "Lake Geneva Neighborhoods",
          path: "/guides/lake-geneva-neighborhoods",
          blurb:
            "Lake Geneva, Fontana, Williams Bay, Genoa City — what each shoreline town actually feels like.",
        },
      ]}
      faqs={[
        {
          question: "How many days do you need in Lake Geneva?",
          answer:
            "Two full days covers the essentials — a boat trip, a stretch of the shore path, a downtown afternoon, and a real dinner. Three days lets you slow down and venture to Fontana or Williams Bay.",
        },
        {
          question: "Is Lake Geneva worth visiting in the off-season?",
          answer:
            "Yes — fall and late spring are the locals' favorite seasons. Smaller crowds, the same lake, and lodging that costs less. Winter has its own appeal if you're into ice fishing, cross-country skiing, or Winterfest.",
        },
        {
          question: "Can you swim in Geneva Lake?",
          answer:
            "Yes. Public swim beaches include Riviera Beach in downtown Lake Geneva, Big Foot Beach State Park just south of town, and Edgewater Park in Williams Bay. The water is cleaner than most Midwest lakes thanks to a long-running watershed protection effort.",
        },
        {
          question: "What's the best way to see the lake?",
          answer:
            "Two options most locals recommend: the U.S. Mailboat tour from the Riviera Docks, or a section of the 21-mile shore path on foot. Renting your own boat is the third option and easier to arrange than people expect.",
        },
      ]}
    />
  );
}