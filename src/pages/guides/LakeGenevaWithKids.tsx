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
        </>
      }
      sections={[
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
      ]}
    />
  );
}