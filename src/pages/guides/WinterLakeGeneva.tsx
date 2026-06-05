import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function WinterLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva in Winter"
      metaTitle="Things to Do in Lake Geneva in Winter — A Local's Guide"
      metaDescription="A local's guide to winter in Lake Geneva, Wisconsin — Winterfest, the National Snow-Sculpting Championship, ice fishing, cross-country skiing, and the quieter version of the shore path."
      path="/guides/things-to-do-lake-geneva-in-winter"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Lake Geneva in winter is a different town than the one most people
            visit. Quieter, slower, lit a little softer. The summer crowd is
            gone, the resort dining rooms have tables on a Saturday night, and
            the lake itself stops moving for a few months and becomes its own
            kind of attraction.
          </p>
          <p>
            This is the locals' season. Here's what's actually worth doing
            between November and March.
          </p>
        </>
      }
      sections={[
        {
          id: "winterfest",
          heading: "Winterfest and the snow-sculpting championship",
          body: (
            <>
              <p>
                Lake Geneva hosts the U.S. National Snow-Sculpting Championship
                every February — fifteen teams from around the country carve
                full-block sculptures in Riviera Park over several days, with
                public viewing the whole time. Around it, Winterfest fills the
                downtown with food, music, and a sledding hill on the lakefront.
              </p>
              <p>
                It is the busiest the town gets in winter. Book lodging
                early; the weekend of the championship sells out months
                ahead. The{" "}
                <Link to="/events" className="text-blue-700 hover:underline font-medium">
                  events calendar
                </Link>{" "}
                tracks current dates.
              </p>
            </>
          ),
        },
        {
          id: "ice",
          heading: "On the ice: fishing and walking",
          body: (
            <>
              <p>
                Once Geneva Lake freezes — typically mid-January in a normal
                year, later in a warm one — ice fishing becomes one of the
                quieter local rituals. Local outfitters rent gear and shanties;
                a half-day on the ice with someone who knows the lake is one
                of the better introductions to winter in Wisconsin.
              </p>
              <p>
                Walking on the ice is its own thing. <strong>Always check
                conditions first</strong> — local Facebook groups and bait
                shops are the honest source. Never assume; the lake changes
                week to week.
              </p>
            </>
          ),
        },
        {
          id: "ski",
          heading: "Skiing, sledding, and the shore path in snow",
          body: (
            <>
              <p>
                <strong>Mountain Top at the Grand Geneva</strong> is the
                hill — small, genuinely beginner-friendly, and well-maintained.
                Lessons run all season. It's the most-recommended local answer
                for a family that wants a real ski day without driving
                three hours north.
              </p>
              <p>
                <strong>Cross-country trails</strong> run through Big Foot
                Beach State Park and several parcels around the lake. The
                shore path stays open in winter where it's safely walkable —
                with traction, it's one of the prettier cold-weather walks
                in the Midwest.
              </p>
              <p>
                Sledding hills are scattered around town. The temporary
                lakefront hill during Winterfest is the obvious one; ask any
                local family about the neighborhood favorite and you'll get
                three answers.
              </p>
            </>
          ),
        },
        {
          id: "indoor",
          heading: "Indoor afternoons",
          body: (
            <>
              <p>
                Winter is when the resort dining rooms, the supper clubs, and
                the new tap rooms actually have space. A long lunch at a
                lakeside resort dining room with snow on the patio is one of
                the better quiet luxuries here.
              </p>
              <p>
                Tristan Crist Magic Theatre, the Geneva Lake Museum, and the
                Riviera ballroom (when there's an event) all hold up as rainy-
                or snowy-day options. Yerkes Observatory in Williams Bay runs
                winter tours.
              </p>
            </>
          ),
        },
        {
          id: "trips",
          heading: "Romantic and small-group trips",
          body: (
            <>
              <p>
                Lake Geneva in winter is genuinely a romantic weekend town.
                The lakefront hotels run packages, the resort spas are easier
                to book, and most restaurants stop pretending they're full.
                For a small group, a Saturday with a long supper-club dinner,
                a Sunday with brunch and a shore-path walk, and a night at
                one of the lakefront properties is the standard local
                recommendation.
              </p>
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
          blurb: "The full year-round guide — boats, the shore path, downtown, food, and what changes by season.",
        },
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "What winter actually feels like here when you live through it instead of visiting for a weekend.",
        },
      ]}
      faqs={[
        {
          question: "Is Lake Geneva worth visiting in winter?",
          answer:
            "Yes — especially during Winterfest and the National Snow-Sculpting Championship in February. The town is quieter, restaurants have space, and the lakefront takes on a different kind of beauty.",
        },
        {
          question: "Does Geneva Lake freeze over?",
          answer:
            "Most years, yes — usually mid-January through late February or early March. Ice depth and conditions vary year to year, so always check with local bait shops or Facebook groups before walking out.",
        },
        {
          question: "Where can you ski near Lake Geneva?",
          answer:
            "Mountain Top at the Grand Geneva is the local hill — small, beginner-friendly, with lessons and rentals. Cross-country trails run through Big Foot Beach State Park and several parcels around the lake.",
        },
      ]}
    />
  );
}