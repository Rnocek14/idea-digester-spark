import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";

/**
 * The U.S. Mailboat — cornerstone guide.
 *
 * Why this page exists: the mailboat was mentioned across five guides on this
 * site and owned by none of them, while being the single most distinctive thing
 * that happens on Geneva Lake. It is also the rare high-search lake topic with
 * no commercial competitor trying to outrank us — the Cruise Line sells tickets,
 * it does not write the explainer.
 *
 * EDITORIAL CONSTRAINT for anyone extending this. Every date, number and name
 * below is attributable to a source in the Sources section. Where sources
 * disagree — and they do, on how many stops the route has — the page says so
 * rather than picking the tidiest number. Do not add prices, departure times, or
 * season dates: those change annually and the whole page loses its authority the
 * first year one goes stale. Send readers to the operator for anything bookable.
 */

const SOURCES: { publisher: string; url: string; supports: string }[] = [
  {
    publisher: "U.S. Mailboat (usmailboat.com)",
    url: "https://usmailboat.com/history/",
    supports: "The 1916 start, Tilford Stuyvesant and the original Walworth, the 1965 Walworth II",
  },
  {
    publisher: "Wikipedia — Mail jumping",
    url: "https://en.wikipedia.org/wiki/Mail_jumping",
    supports:
      "What mail jumping is; Lake Geneva as the only US route delivered this way from a passenger boat; the first woman jumper in 1974",
  },
  {
    publisher: "Lake Geneva Cruise Line",
    url: "https://www.cruiselakegeneva.com/public-tours/us-mailboat/",
    supports: "The tour itself, its length, and that it runs from the Riviera Docks",
  },
  {
    publisher: "CNBC",
    url: "https://www.cnbc.com/2023/08/20/the-coolest-summer-job-these-teens-jump-off-a-moving-boat-to-deliver-mail-in-wisconsin.html",
    supports: "The jumpers as a summer job for local teenagers, and the tryout process",
  },
  {
    publisher: "Madison.com",
    url: "https://madison.com/news/local/geneva-lake-mail-and-tour-boat-serves-and-promotes-for/article_2786d5a3-772b-5281-a354-cad63a936de2.html",
    supports: "A century of continuous operation; the route's daily rhythm",
  },
];

export default function LakeGenevaMailboat() {
  return (
    <GuideShell
      title="The U.S. Mailboat: Lake Geneva's Mail Jumpers, Explained"
      metaTitle="Lake Geneva Mailboat & Mail Jumpers — How It Works | Lake Geneva Brief"
      metaDescription="Geneva Lake is the only place in America where mail is still delivered by someone leaping from a moving boat. How the route works, who the jumpers are, and what to know before you go."
      path="/guides/lake-geneva-mailboat"
      datePublished="2026-07-31"
      dateModified="2026-08-03"
      intro={
        <>
          <p>
            Every summer morning on Geneva Lake, a boat pulls alongside a pier
            without stopping, a teenager jumps off it, shoves mail in a box,
            grabs whatever is going out, and jumps back on while the boat is
            still moving. If they misjudge it, they go in the lake — and people
            pay to watch, partly for that reason.
          </p>
          <p>
            This is not a re-enactment. It is a working postal route, and Geneva
            Lake is the only place in the United States where mail is delivered
            this way from a passenger-carrying boat. It has run since 1916.
          </p>
        </>
      }
      sections={[
        {
          id: "how-it-works",
          heading: "How the route actually works",
          body: (
            <>
              <p>
                The boat does not stop. That is the whole thing. It comes in
                close to a pier, slows but keeps way on, and the jumper steps off
                the moving bow onto the dock, works the mailbox, and catches the
                boat again at the stern as it slides past. A run takes a few
                seconds.
              </p>
              <p>
                Delivery starts mid-morning and the route takes most of the
                middle of the day. Jumpers make dozens of these stops in a
                single run — sources put the number of deliveries at roughly 60
                to 75, and this desk has not been able to reconcile the two
                figures, so treat it as "dozens, not a handful" rather than a
                precise count.
              </p>
              <p>
                The mail is real. These are lakefront addresses whose piers are
                genuinely easier to reach from the water than from the road, which
                is exactly why the route started: in 1916 the roads around the
                lake were bad enough that a boat was the sensible way to deliver.
              </p>
            </>
          ),
        },
        {
          id: "jumpers",
          heading: "Who the jumpers are",
          body: (
            <>
              <p>
                Local teenagers. It is a summer job, and a competitive one —
                candidates try out by doing the jump, because there is no way to
                interview for it. The work is athletic and unforgiving: a pier
                is a fixed object, the boat is not, and the gap between them is
                water.
              </p>
              <p>
                Only men did it until 1974, when the first woman was hired. The
                job has been open to both since.
              </p>
              <p>
                Falling in is part of the folklore rather than a disaster, and
                any jumper who has done a season has stories. It is worth
                remembering while you watch that the person doing it is
                seventeen and being paid a summer wage, not a stunt performer.
              </p>
            </>
          ),
        },
        {
          id: "history",
          heading: "1916, and the two Walworths",
          body: (
            <>
              <p>
                Tilford Stuyvesant launched the original <em>Walworth</em> in
                1916 and it became the U.S. Mailboat. That boat was scrapped in
                1965, and the <em>Walworth II</em> launched the same year to
                replace it. The second boat has now been doing the route for
                considerably longer than the first one did.
              </p>
              <p>
                The route has run for more than a century — through the
                disappearance of most of the reasons it existed. The roads got
                better. The lake got a ring of paved streets. The mail could
                perfectly well go by van. It goes by boat because the route
                survived long enough to become the thing itself.
              </p>
            </>
          ),
        },
        {
          id: "seeing-it",
          heading: "Seeing it yourself",
          body: (
            <>
              <p>
                The Lake Geneva Cruise Line runs the mailboat as a public tour
                from the Riviera Docks downtown, and you ride along on the actual
                delivery run rather than a re-creation of it. It is a long
                cruise — the better part of a morning — because the route is a
                working route and it takes as long as it takes.
              </p>
              <p>
                Three things worth knowing before you book. It is genuinely long
                for small children, and there is no getting off partway. The
                jumping is the draw but most of the trip is the lake and the
                narration, so go for the whole thing rather than the stunt. And
                it runs in the warm months only.
              </p>
              <p>
                <strong>We deliberately do not publish times or prices here.</strong>{" "}
                They change every season, and a guide that quietly goes stale is
                worse than no guide. Book through{" "}
                <a
                  href="https://www.cruiselakegeneva.com/public-tours/us-mailboat/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline font-medium"
                >
                  the Cruise Line
                </a>{" "}
                and take the schedule from them.
              </p>
            </>
          ),
        },
        {
          id: "from-shore",
          heading: "Watching from shore, for free",
          body: (
            <>
              <p>
                You do not have to be on the boat. The route runs the shoreline,
                and the{" "}
                <Link
                  to="/guides/lake-geneva-shore-path"
                  className="text-blue-700 hover:underline font-medium"
                >
                  Shore Path
                </Link>{" "}
                runs it too — so a morning walk in the right season will put you
                within sight of the boat working its way around. You will not
                know exactly when it reaches you, which is part of the pleasure.
              </p>
              <p>
                If you try this, the Shore Path etiquette applies in full: the
                piers the jumpers are landing on are private property, and so are
                the lawns you would be standing on to get a better angle. Watch
                from the path.
              </p>
            </>
          ),
        },
        {
          id: "sources",
          heading: "Where this came from",
          body: (
            <>
              <p className="mb-3">
                Every date and figure above traces to one of these. Where they
                disagree — the number of stops on the route — the page says so
                rather than choosing.
              </p>
              <ul className="space-y-2">
                {SOURCES.map((s) => (
                  <li key={s.url} className="text-sm leading-snug">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-blue-700 hover:underline font-medium"
                    >
                      {s.publisher}
                    </a>
                    <span className="text-slate-500"> — {s.supports}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500 mt-3">
                Schedules, prices and the current season come from the operator,
                not from us, and are deliberately absent above.
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "Is the Lake Geneva mailboat a real mail delivery?",
          answer:
            "Yes. It is a working U.S. postal route serving lakefront addresses whose piers are easier to reach by water than by road, and it has run since 1916. The tour rides along on the actual delivery run.",
        },
        {
          question: "Do the mail jumpers really jump off a moving boat?",
          answer:
            "Yes. The boat slows but does not stop. The jumper steps off onto the pier, swaps the mail, and catches the boat again at the stern as it passes. Falling in happens and is part of the job's folklore.",
        },
        {
          question: "Where else in the US does mail jumping happen?",
          answer:
            "Nowhere else. Geneva Lake is the only place in the United States where mail is delivered this way from a passenger-carrying boat.",
        },
        {
          question: "Who are the mail jumpers?",
          answer:
            "Local teenagers, hired for the summer through tryouts that involve actually doing the jump. Only men did the job until 1974, when the first woman was hired; it has been open to both since.",
        },
        {
          question: "How long is the Lake Geneva mailboat tour?",
          answer:
            "It takes the better part of a morning, because it follows the real delivery route rather than a shortened version. It is long for small children and there is no getting off partway. Check the current schedule with the Lake Geneva Cruise Line.",
        },
        {
          question: "Can I watch the mailboat without paying for a tour?",
          answer:
            "Yes. The route follows the shoreline, so the Shore Path puts you within sight of it on a summer morning. Stay on the path — the piers the jumpers land on, and the lawns beside them, are private property.",
        },
      ]}
      related={[
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The 21-mile public path the mailboat route runs alongside, stop by stop.",
        },
        {
          title: "Getting on the water",
          path: "/guides/lake-geneva-boat-rentals",
          blurb: "Rentals, tours and launches — plus the lake rules that catch visitors out.",
        },
        {
          title: "Streblow boats",
          path: "/guides/streblow-boats-geneva-lake",
          blurb: "The mahogany runabouts built on this lake since the 1940s.",
        },
      ]}
      bottomExtra={<GuideNewsletterCTA />}
    />
  );
}
