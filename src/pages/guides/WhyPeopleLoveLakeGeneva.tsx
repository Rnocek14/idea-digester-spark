import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

/**
 * Editorial/community flagship — NOT an SEO play. This is the page
 * to send someone who asks "what is Lake Geneva actually like?"
 * Lean on resident voices, Local Love mentions, and small concrete
 * details over keyword-optimized prose.
 */
export default function WhyPeopleLoveLakeGeneva() {
  return (
    <GuideShell
      title="Why People Love Lake Geneva"
      metaTitle="Why People Love Lake Geneva — A Resident's Read"
      metaDescription="A community-sourced answer to a question we get often: what is Lake Geneva actually like? Voices, neighborhood snapshots, and the small details that keep people here."
      path="/guides/why-people-love-lake-geneva"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            People ask this in two ways. Visitors ask "what should I
            love about Lake Geneva?" — looking for a checklist.
            Residents and would-be residents ask "what is it actually
            like here?" — looking for the honest version.
          </p>
          <p>
            This page is the second answer. Less guide, more
            community. The bits long-time locals say when no one's
            selling anything.
          </p>
        </>
      }
      sections={[
        {
          id: "lake",
          heading: "The lake is the thing, but not the only thing",
          body: (
            <>
              <p>
                Every resident's answer starts with the lake. Geneva
                Lake is unusually clean for a Midwest lake — a
                long-running watershed protection effort, a deep
                basin, and a public-access tradition older than the
                state — and you feel it whether you're on the water,
                on the 21-mile shore path, or sitting on a bench in
                Library Park.
              </p>
              <p>
                But it's not why people stay. People stay because
                the town around the lake stayed small enough that
                you still see the same faces — the booksellers
                downtown, the coffee shop owners, the people who run
                the supper club north of town.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "Four real seasons, each with their own ritual",
          body: (
            <>
              <p>
                Summer is the season the town is famous for. Locals
                quietly admit fall is the best — warmer lake than
                people expect, smaller crowds, shore path lit up in
                October light. Winter is real winter — ice fishing,
                Mountain Top at the Grand Geneva, Winterfest in
                February. Spring is short and underrated.
              </p>
              <p>
                The thing that makes Lake Geneva feel different
                from a one-season tourist town is that there's a
                genuine local rhythm in all four. The Brief's{" "}
                <Link to="/events" className="text-blue-700 hover:underline font-medium">
                  events calendar
                </Link>{" "}
                catches the public side of it.
              </p>
            </>
          ),
        },
        {
          id: "neighbors",
          heading: "Neighbors, voices, and the everyday",
          body: (
            <>
              <p>
                The honest version of "why people love it here" lives
                in the community pages more than in any guide. The{" "}
                <Link to="/community/local-love" className="text-blue-700 hover:underline font-medium">
                  Local Love page
                </Link>{" "}
                is the running list of small businesses and people
                residents nominate. The{" "}
                <Link to="/community/voices" className="text-blue-700 hover:underline font-medium">
                  Community Voices page
                </Link>{" "}
                collects the longer reflections — locals on what
                changed, what stayed, what they hope for.
              </p>
              <p>
                If you only have time to read one of those, the
                Voices page does more of the work of answering this
                question than this guide can.
              </p>
            </>
          ),
        },
        {
          id: "scale",
          heading: "The scale is the secret",
          body: (
            <>
              <p>
                Lake Geneva is small enough to walk and small enough
                that you keep running into the same neighbors, but
                large enough that there's actually something on most
                weekends. That balance is rare. People who move here
                from Chicago or Milwaukee mention it within the
                first six months, usually phrased as "I didn't
                realize how much I missed this."
              </p>
            </>
          ),
        },
        {
          id: "honest",
          heading: "The honest part",
          body: (
            <>
              <p>
                Lake Geneva is not for everyone. Summer weekends are
                busy. Winter is genuinely cold. Property taxes are
                Wisconsin property taxes. There is no commuter rail.
                The dining scene is good, not Chicago.
              </p>
              <p>
                The people who love it most are the people who like
                the trade-off — slower pace, real seasons, neighbors
                you know by name, and the lake doing the heavy
                lifting on the days when you need it to.
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
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "The full relocation guide — what year-round life here actually feels like.",
        },
        {
          title: "Community Voices",
          path: "/community/voices",
          blurb: "Longer reflections from residents — the source material this page draws from.",
        },
      ]}
    />
  );
}