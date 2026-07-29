import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function LakeGenevaWithKids() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva With Kids: A Family Guide"
      metaTitle="Things to Do in Lake Geneva With Kids — A Family Guide"
      metaDescription="A family-tested guide to Lake Geneva, Wisconsin — beaches, boats, Yerkes Observatory, the magic theatre, ski lessons at Mountain Top, and where to eat when everyone's hungry."
      path="/guides/things-to-do-lake-geneva-with-kids"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Lake Geneva is, quietly, one of the easier small towns in the
            Midwest to spend a weekend with kids. The lake itself carries
            most of the day. The downtown is walkable. The drives between
            stops are short. There are real backup plans for rain.
          </p>
          <p>
            This is the family version of the local's playbook — what
            actually works with kids in tow, by age.
          </p>
          <p>
            Admission prices, boat-tour schedules and seasonal hours change,
            so this page doesn't reprint them — check each operator before
            you go. What it covers instead is the part that holds season to
            season: what suits which age, what the day actually costs you in
            time, and what to do when the weather turns.
          </p>
        </>
      }
      sections={[
        {
          id: "shape-of-the-day",
          heading: "The shape of a day that works",
          body: (
            <>
              <p>
                The single most useful thing to know about Lake Geneva with
                kids is that the drives are short. Nearly everything in this
                guide sits within about fifteen minutes of downtown, which
                means you can bail on a plan without losing the day. That's
                rarer than it sounds, and it's the reason a weekend here
                tends to go better than a weekend somewhere with more famous
                attractions spread further apart.
              </p>
              <p>
                The rhythm most families land on is water in the morning,
                something indoors or shaded in the early afternoon, and an
                early dinner. It's built around two constraints rather than
                any particular attraction: the beach parking that fills by
                mid-morning on hot weekends, and the fact that small children
                are done by about two o'clock whatever the itinerary says.
                Plan the day you'd want to abandon halfway through, and the
                afternoon takes care of itself.
              </p>
              <p>
                Two practical notes. Downtown is genuinely walkable, so
                parking once and staying on foot beats moving the car between
                stops — the walk from the lakefront to ice cream and back is
                part of what makes the day feel easy. And the busiest
                stretch of the year is roughly July through mid-August plus
                event weekends; the same trip in June or September is the
                same lake with a fraction of the queue.
              </p>
            </>
          ),
        },
        {
          id: "lake-day",
          heading: "A full lake day, every age",
          body: (
            <>
              <p>
                Beach time plus a boat tour plus an early dinner is a real
                day for most ages. Two honest beach choices:
              </p>
              <ul>
                <li>
                  <strong>Riviera Beach</strong> — downtown, walkable to
                  ice cream and the Riviera Docks for a boat tour after.
                </li>
                <li>
                  <strong>Edgewater Park</strong> in Williams Bay — bigger
                  swim area, easier parking, less crowded. The local family
                  default on a busy summer Saturday.
                </li>
              </ul>
              <p>
                <strong>Big Foot Beach State Park</strong> just south of
                town adds shaded picnic tables and trails behind it — the
                right answer for a full picnic day with younger kids.
              </p>
              <p>
                For boats, the U.S. Mailboat tour is the showstopper —
                kids love watching the jumpers leap onto piers at speed.
                Standard lake tours from the Riviera Docks are shorter and
                easier for restless ages.
              </p>
            </>
          ),
        },
        {
          id: "younger",
          heading: "Younger kids (toddlers through early elementary)",
          body: (
            <>
              <p>
                Anchor the day around water, snacks, and short bursts.
                Library Park has a playground steps from the lakefront.
                The downtown ice cream and chocolate shops are the predictable
                hit. The Tristan Crist Magic Theatre downtown has shows aimed
                at families.
              </p>
              <p>
                The Geneva Lake Museum is small but well-curated — worth an
                hour for kids who like to touch and look. The mailboat tour
                holds little-kid attention better than a standard cruise
                because something happens at every stop.
              </p>
            </>
          ),
        },
        {
          id: "tweens",
          heading: "Tweens and older",
          body: (
            <>
              <p>
                The shore path becomes interesting at this age. A 2–3 mile
                section is doable for most fit ten-year-olds and the
                "we're walking through people's backyards" part lands as a
                surprisingly cool fact.
              </p>
              <p>
                Renting a paddleboard or kayak by the hour, the climbing
                gym, and the Yerkes Observatory tour in Williams Bay all
                work well for tweens and teens. Tour-the-estates boat
                trips become genuinely interesting once kids can hold a
                history thread.
              </p>
            </>
          ),
        },
        {
          id: "rainy",
          heading: "Rainy day plans that actually hold up",
          body: (
            <>
              <p>
                Lake Geneva has more rainy-day options than you'd expect for
                a town this size. The reliable list:
              </p>
              <ul>
                <li>Tristan Crist Magic Theatre — downtown, hour-long shows.</li>
                <li>Geneva Lake Museum — small, well-curated, kid-friendly.</li>
                <li>Yerkes Observatory tour — Williams Bay, weather-proof, fascinating.</li>
                <li>Indoor pools at the Grand Geneva and Timber Ridge — day passes available.</li>
                <li>Bowling, escape rooms, and the magic theatre are all walkable from downtown.</li>
              </ul>
            </>
          ),
        },
        {
          id: "winter",
          heading: "Winter with kids",
          body: (
            <>
              <p>
                <strong>Mountain Top at the Grand Geneva</strong> is the
                local family ski answer — genuinely beginner-friendly,
                lessons, rentals, food at the bottom. The hill is small in
                the best way; first-timers get more runs in.
              </p>
              <p>
                Winterfest in February brings the National Snow-Sculpting
                Championship to downtown, plus a sledding hill on the
                lakefront and family programming through the week. It's
                the busiest the town gets in winter — book lodging early.
              </p>
            </>
          ),
        },
        {
          id: "eating",
          heading: "Eating with kids without compromising",
          body: (
            <>
              <p>
                Most lakeside restaurants are kid-friendly at lunch and a
                little less so at Saturday dinner. Honest moves:
              </p>
              <ul>
                <li>
                  Pier 290 (Williams Bay) — patio, lake views, kids' menu,
                  short wait for a midweek lunch.
                </li>
                <li>
                  Grand Geneva — multiple restaurants, fine for early
                  family dinners.
                </li>
                <li>
                  Pizza and burger spots downtown — solid quality, no
                  pressure, walkable from the beach.
                </li>
                <li>
                  Friday fish fry — Wisconsin tradition, more fun with
                  kids than people expect. See our running{" "}
                  <Link to="/eats/fish-fry" className="text-blue-700 hover:underline font-medium">
                    fish fry guide
                  </Link>
                  .
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
          title: "Things to Do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb: "The full evergreen guide for everyone, not just families.",
        },
        {
          title: "A Parent's Guide to Schools",
          path: "/guides/lake-geneva-schools",
          blurb: "If your family visit is also a relocation scouting trip, start here.",
        },
      ]}
      faqs={[
        {
          question: "Is Lake Geneva good for a family vacation?",
          answer:
            "Yes — the town is walkable, the beaches and boat tours carry most ages, and there are real rainy-day plans (magic theatre, museum, Yerkes Observatory, resort indoor pools).",
        },
        {
          question: "What's the best beach for kids in Lake Geneva?",
          answer:
            "Edgewater Park in Williams Bay is the local-family default — bigger swim area, easier parking, less crowded than Riviera Beach downtown. Big Foot Beach State Park is the shaded-picnic answer.",
        },
        {
          question: "Is there skiing for kids near Lake Geneva?",
          answer:
            "Yes — Mountain Top at the Grand Geneva runs lessons all winter. The hill is genuinely beginner-friendly and a good first-time ski destination for families.",
        },
        {
          question: "How many days do you need in Lake Geneva with kids?",
          answer:
            "Two days covers the lake properly — a beach-and-boat day plus a second day for whatever the first one didn't fit. A single day works if you keep it to the downtown lakefront and a boat tour. Because nearly everything sits within about fifteen minutes of downtown, a third day is about doing things at a slower pace rather than reaching further.",
        },
        {
          question: "What is there to do in Lake Geneva with kids when it rains?",
          answer:
            "The rainy-day rotation is the magic theatre, the museum, a Yerkes Observatory tour in Williams Bay, and resort indoor pools. The advantage here is that the drives are short, so switching to a rain plan mid-morning costs you fifteen minutes rather than the day.",
        },
        {
          question: "What's the best age for a Lake Geneva family trip?",
          answer:
            "It carries a wider range than most lake towns. Toddlers through early elementary do best with the shallow beach entries, short boat tours and picnic-and-trails days. Tweens and older get more out of the longer Mailboat tour, the Shore Path, and winter skiing at Mountain Top. The one age that needs the most planning is a mixed group — which is what the short drives are good for.",
        },
        {
          question: "Is the Mailboat tour good for young children?",
          answer:
            "The mail jumpers are the showstopper and kids reliably love watching them. The consideration is length rather than content: it's the longest of the lake tours, so for restless younger children a standard tour from the Riviera Docks is the safer choice and covers the same water.",
        },
        {
          question: "When is the best time to visit Lake Geneva with kids?",
          answer:
            "June and September give you the same lake with a fraction of the crowds — July through mid-August plus event weekends are the busiest stretch. Winter is a genuinely different trip built around skiing and indoor pools rather than the water.",
        },
        {
          question: "Is Lake Geneva walkable with a stroller?",
          answer:
            "Downtown is, and parking once and staying on foot is the easier plan. The Shore Path largely is not — expect stone steps, tree roots and narrow stretches outside the paved downtown section, so a carrier beats a stroller if you want to walk any distance along the water.",
        },
        {
          question: "Where should families park in downtown Lake Geneva?",
          answer:
            "Park once near the lakefront and walk. Beach lots fill by mid-morning on hot summer weekends, which is the main argument for an early start; moving the car between downtown stops costs more time than walking them.",
        },
      ]}
    />
  );
}