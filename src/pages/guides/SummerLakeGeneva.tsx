import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function SummerLakeGeneva() {
  return (
    <GuideShell
      title="Best Things to Do in Lake Geneva in Summer"
      metaTitle="Best Things to Do in Lake Geneva in Summer — A Local's Guide"
      metaDescription="A local's summer guide to Lake Geneva, Wisconsin — boating, the shore path, beaches, lakeside dining, festivals, and how to enjoy the season without fighting the crowds."
      path="/guides/best-things-to-do-lake-geneva-in-summer"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Summer is the season Lake Geneva is built for, and it's also the
            most crowded. The trick is not avoiding the crowds — it's
            arranging the day so you're somewhere else when they arrive. A
            morning on the lake, a Williams Bay lunch, a late-afternoon shore
            path walk, dinner at the quiet end of the lake.
          </p>
          <p>
            This is the local's playbook for a summer weekend (or week) here.
          </p>
        </>
      }
      sections={[
        {
          id: "lake",
          heading: "On the water",
          body: (
            <>
              <p>
                The lake is the point. Three honest options:
              </p>
              <ul>
                <li>
                  <strong>The U.S. Mailboat tour</strong> — the signature Lake
                  Geneva experience. Jumpers actually deliver mail at speed.
                  Book ahead in July and August.
                </li>
                <li>
                  <strong>A standard lake tour</strong> from the Riviera Docks —
                  shorter, simpler, the painless way to see the estates.
                </li>
                <li>
                  <strong>Rent your own boat</strong> from the Riviera or Gage
                  Marine. Easier than people think; call by Thursday for a
                  weekend slot.
                </li>
              </ul>
              <p>
                Paddleboards and kayaks rent by the hour at several lakefront
                spots. Calm mornings before 10am are the locals' window.
              </p>
            </>
          ),
        },
        {
          id: "beaches",
          heading: "The honest beach answer",
          body: (
            <>
              <p>
                <strong>Riviera Beach</strong> in downtown Lake Geneva is the
                convenient choice and the most crowded. Arrive by 10am on a
                July weekend or expect to circle for parking.
              </p>
              <p>
                <strong>Edgewater Park</strong> in Williams Bay is the
                locals' Saturday answer — bigger swim area, easier parking,
                less foot traffic.
              </p>
              <p>
                <strong>Big Foot Beach State Park</strong> just south of town
                is the picnic-with-shade answer — calmer water, shadier
                tables, and the trails behind it for a walk after.
              </p>
            </>
          ),
        },
        {
          id: "shore-path",
          heading: "The shore path in summer",
          body: (
            <>
              <p>
                The 21-mile Geneva Lake Shore Path is one of the few places
                public-access tradition lets you walk through the backyards
                of historic estates legally. Summer mornings before the
                heat — 7 to 10am — are the right window.
              </p>
              <p>
                Most people do a 2–4 mile section. Library Park toward Black
                Point is the introductory stretch; the Fontana-to-Williams
                Bay stretch is the locals' favorite for a longer walk.
              </p>
            </>
          ),
        },
        {
          id: "festivals",
          heading: "Festivals and recurring events",
          body: (
            <>
              <p>
                Summer is festival season. Specific dates change year to year;
                the{" "}
                <Link to="/events" className="text-blue-700 hover:underline font-medium">
                  events calendar
                </Link>{" "}
                tracks what's current. The annual fixtures most worth
                planning around: the July 4th fireworks over the lake (one of
                the better small-town shows in the Midwest), Venetian
                Festival in August, the Sunday farmers market, and outdoor
                concert series at the Riviera and at several resorts.
              </p>
            </>
          ),
        },
        {
          id: "dining",
          heading: "Lakeside dining without the wait",
          body: (
            <>
              <p>
                The lakeside dining rooms — Pier 290 in Williams Bay, the
                Grand Geneva, The Abbey in Fontana — all take reservations
                and all fill up in summer. Book by Wednesday for a weekend.
              </p>
              <p>
                If you didn't book, the supper clubs north of town are the
                reliable answer. The Brief's{" "}
                <Link to="/eats" className="text-blue-700 hover:underline font-medium">
                  dining coverage
                </Link>{" "}
                tracks what's open and what's worth it week to week.
              </p>
            </>
          ),
        },
        {
          id: "crowds",
          heading: "Beating the summer crowd",
          body: (
            <>
              <p>
                Three habits that change a summer weekend here:
              </p>
              <ul>
                <li>
                  <strong>Base in Williams Bay or Fontana</strong>, not in
                  downtown Lake Geneva. Same lake, half the foot traffic.
                </li>
                <li>
                  <strong>Anchor mornings on the water</strong> — 7–10am is
                  the locals' window for boating, paddling, and the shore
                  path.
                </li>
                <li>
                  <strong>Save downtown for evenings.</strong> Saturday
                  afternoon downtown in July is the busiest hour of the year.
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
          title: "Things to Do in Lake Geneva This Weekend",
          path: "/guides/things-to-do-lake-geneva-this-weekend",
          blurb: "The weekend-specific playbook — Friday night, the full Saturday, slowing down Sunday.",
        },
        {
          title: "Things to Do With Kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb: "The family-friendly version of the summer guide.",
        },
      ]}
      faqs={[
        {
          question: "When is the best time to visit Lake Geneva in summer?",
          answer:
            "Late June through mid-August is peak. Locals quietly prefer the first half of June and the last week of August — the lake is warm, the days are long, and the crowds are lighter.",
        },
        {
          question: "Is the lake good for swimming in summer?",
          answer:
            "Yes — Geneva Lake is unusually clean for a Midwest lake thanks to a long-running watershed effort. Public swim beaches include Riviera Beach, Edgewater Park in Williams Bay, and Big Foot Beach State Park.",
        },
        {
          question: "What's the biggest summer event in Lake Geneva?",
          answer:
            "Venetian Festival in August is the headline annual event — fireworks, lighted boat parade, music, food. Independence Day fireworks over the lake are the other big draw.",
        },
      ]}
    />
  );
}