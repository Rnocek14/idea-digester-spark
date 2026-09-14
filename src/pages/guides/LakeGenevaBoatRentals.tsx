import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";

/**
 * Getting on the water — cornerstone guide.
 *
 * EDITORIAL POSITION, and the reason this page is shaped the way it is.
 *
 * "Lake Geneva boat rentals" is a commercial query owned by the liveries
 * themselves, who have booking engines and the thing the searcher wants. A news
 * site cannot win that fight and should not try. What no rental company will
 * ever publish is the awkward part: the certificate that stops you at the dock,
 * the counterclockwise rule nobody expects, the costs that are not on the rate
 * card, and which afternoons on this lake are genuinely unpleasant.
 *
 * So this page names no operator and ranks nobody. That is deliberate and it is
 * also the commercial safeguard: this site sells sponsorships and runs a
 * directory, and a "best boat rentals" page where advertisers happen to appear
 * would undo the sourcing discipline the rest of the guides depend on. If a
 * recommendations page is ever wanted, it needs a published disclosure rule
 * first — decided before it is written, not after somebody asks.
 *
 * Do not add prices, hours or season dates. Rules get cited; commerce gets a
 * pointer to the directory.
 */

const SOURCES: { publisher: string; url: string; supports: string }[] = [
  {
    publisher: "Wisconsin DNR — Before you operate",
    url: "https://dnr.wisconsin.gov/permits/registrations/boat/BeforeYouOperate.html",
    supports:
      "The boater safety certificate requirement for anyone born on or after 1 January 1989, and the requirement to carry proof",
  },
  {
    publisher: "Wisconsin DNR — Safety education",
    url: "https://dnr.wisconsin.gov/Education/OutdoorSkills/safetyEducation",
    supports: "Where DNR-approved boater safety courses are offered",
  },
  {
    publisher: "Joint Uniform Lake Law Ordinance, Geneva Lake (via WDNR)",
    url: "https://apps.dnr.wi.gov/swims/Documents/DownloadDocument?id=18657046",
    supports:
      "The slow-no-wake traffic lane — 200 feet from shore, 100 feet from any pier or structure — and the counterclockwise rotation rule",
  },
  {
    publisher: "Geneva Lake Water Safety Patrol",
    url: "http://www.genevalakepolice.com/resource-doc/LAKE%20ORD%20Flyer%202018.pdf",
    supports: "Summary of the joint lake ordinances and who enforces them",
  },
  {
    publisher: "Town of Linn, Ch. 13 Boating Regulations",
    url: "https://ecode360.com/8814296",
    supports: "Municipal boating regulations and the town launches",
  },
];

export default function LakeGenevaBoatRentals() {
  return (
    <GuideShell
      title="Getting on the Water at Lake Geneva"
      metaTitle="Lake Geneva Boat Rentals & Getting on the Water — What to Know First"
      metaDescription="Renting a boat on Geneva Lake: the safety certificate that stops people at the dock, the counterclockwise rule, what a rental really costs, and when the lake is worth avoiding."
      path="/guides/lake-geneva-boat-rentals"
      datePublished="2026-07-31"
      dateModified="2026-08-03"
      intro={
        <>
          <p>
            Geneva Lake is 21 miles around and most of what people come here for
            happens on it. Renting a boat for the day is the default plan, and
            it is a good one — but there are three or four things that catch
            visitors out every summer, and none of them appear on a rental
            company's booking page.
          </p>
          <p>
            This guide covers those. It does not rank rental companies and does
            not name one — see the note at the bottom for why.
          </p>
        </>
      }
      sections={[
        {
          id: "certificate",
          heading: "The certificate that stops people at the dock",
          body: (
            <>
              <p>
                This is the big one. In Wisconsin, anyone{" "}
                <strong>born on or after 1 January 1989</strong> must have
                completed a boater safety course approved by the state
                Department of Natural Resources before operating a motorboat or
                personal watercraft — and must carry proof of it.
              </p>
              <p>
                It applies to rentals. If you were born in 1989 or later, turning
                up at a livery without the certificate can end the day before it
                starts, and finding this out at the dock on a Saturday morning is
                a genuinely common way for a trip to fall apart.
              </p>
              <p>
                The course can be taken online through a DNR-approved provider.
                Do it before you travel, not the night before — and take the
                certificate with you rather than assuming a photo of it will do.
              </p>
              <p className="text-sm text-slate-600">
                Born before 1989? The requirement does not apply to you. That
                does not make the rest of this page optional.
              </p>
            </>
          ),
        },
        {
          id: "lake-rules",
          heading: "Two Geneva Lake rules that surprise almost everyone",
          body: (
            <>
              <p>
                Geneva Lake is governed by a joint ordinance shared across the
                municipalities around it, and enforced on the water by the Water
                Safety Patrol rather than by any one town's police. Two of its
                rules are not what a visitor would guess.
              </p>
              <p>
                <strong>The slow-no-wake band is wide.</strong> Outside the
                traffic lane you must be at slow-no-wake speed, and the lane is
                defined as the greater of 200 feet from the shoreline or 100 feet
                from any pier, raft, mooring or structure. In practice that means
                a substantial ring around the entire lake where you are going
                slowly — considerably wider than most people assume when they open
                the throttle leaving a pier.
              </p>
              <p>
                <strong>Traffic runs counterclockwise.</strong> Boats moving at
                slow-no-wake in that lane travel in a counterclockwise rotation
                around the lake. Almost nobody expects a lake to have a direction,
                and going the wrong way is both an offence and a good way to meet
                somebody head-on in the narrow band near shore.
              </p>
              <p>
                Read the ordinance summary before your first day out rather than
                learning either of these from a patrol boat.
              </p>
            </>
          ),
        },
        {
          id: "cost",
          heading: "What a day actually costs",
          body: (
            <>
              <p>
                The rate on the booking page is rarely the number on your card.
                Budget for the gap:
              </p>
              <ul className="space-y-1.5 list-disc pl-5">
                <li>
                  <strong>Fuel.</strong> Usually billed separately on return, at
                  marina prices. On a big pontoon over a full day this is not a
                  rounding error.
                </li>
                <li>
                  <strong>A security deposit</strong>, held against the card,
                  often well into the hundreds.
                </li>
                <li>
                  <strong>A damage waiver</strong>, which may be optional in
                  theory and effectively mandatory in practice.
                </li>
                <li>
                  <strong>Launch or slip fees</strong> if you brought your own
                  boat rather than renting.
                </li>
              </ul>
              <p className="mt-3">
                Ask for the all-in figure when you book, in writing. A livery
                that will not give you one is telling you something.
              </p>
            </>
          ),
        },
        {
          id: "when",
          heading: "When the lake is worth avoiding",
          body: (
            <>
              <p>
                A July or August Saturday afternoon on Geneva Lake is busy in a
                way the photographs never show. The lake is 21 miles around and
                on a peak weekend it can feel considerably smaller — chop from
                boat traffic rather than wind, queues at the launches, and the
                good anchorages taken by late morning.
              </p>
              <p>
                If you have any flexibility: go on a weekday, or go early. The
                water is calmest in the morning before the traffic builds, which
                is also when the{" "}
                <Link to="/guides/lake-geneva-mailboat" className="text-blue-700 hover:underline font-medium">
                  mailboat
                </Link>{" "}
                is working its way round.
              </p>
              <p>
                September is the quiet secret. The water is still warm, the
                crowds have gone back, and rentals are easier to get.
              </p>
            </>
          ),
        },
        {
          id: "without-renting",
          heading: "Getting on the water without renting a boat",
          body: (
            <>
              <p>
                Renting is not the only option and often not the best one for a
                first visit.
              </p>
              <ul className="space-y-1.5 list-disc pl-5">
                <li>
                  <strong>Take a tour.</strong> The{" "}
                  <Link to="/guides/lake-geneva-mailboat" className="text-blue-700 hover:underline font-medium">
                    U.S. Mailboat
                  </Link>{" "}
                  is the one genuinely unusual thing on this lake — a working
                  postal route where the carrier jumps off a moving boat — and it
                  covers the whole shoreline with narration.
                </li>
                <li>
                  <strong>Launch your own.</strong> The towns around the lake
                  operate public launches; they are paid, and parking is sized for
                  trailers rather than for a day out. Our{" "}
                  <Link to="/guides/lake-geneva-public-access-guide" className="text-blue-700 hover:underline font-medium">
                    public access guide
                  </Link>{" "}
                  covers where they are.
                </li>
                <li>
                  <strong>Swim from a public beach</strong> rather than a rented
                  boat. The shoreline in front of private homes is private
                  waterfront.
                </li>
                <li>
                  <strong>Walk it instead.</strong> The{" "}
                  <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline font-medium">
                    Shore Path
                  </Link>{" "}
                  gets you the same views, from the other side, for nothing.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "no-rankings",
          heading: "Why this page doesn't rank the rental companies",
          body: (
            <>
              <p>
                Because we sell advertising, and a "best boat rentals" list from a
                publication that takes money from local businesses is worth
                exactly as much as the reader's willingness to believe it wasn't
                bought.
              </p>
              <p>
                The liveries around this lake are easy to find and their booking
                pages are better at selling boat time than we would be. What they
                will not tell you is the certificate rule, the counterclockwise
                rotation, or which afternoons to skip — so that is what this page
                is for. Operators are listed, unranked, in our{" "}
                <Link to="/directory" className="text-blue-700 hover:underline font-medium">
                  directory
                </Link>
                .
              </p>
              <p className="text-sm text-slate-600">
                If that ever changes, it will come with a published disclosure
                rule attached, and you will be able to see it.
              </p>
            </>
          ),
        },
        {
          id: "sources",
          heading: "Where the rules came from",
          body: (
            <>
              <p className="mb-3">
                The regulations above are cited rather than paraphrased from
                rental sites. Ordinances get amended — check the current text
                before relying on any of it in a dispute.
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
                Costs above are described as categories, not figures, because
                rates change every season and a stale number is worse than none.
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "Do I need a boating license to rent a boat in Lake Geneva?",
          answer:
            "Not a licence, but a certificate. In Wisconsin anyone born on or after 1 January 1989 must have completed a DNR-approved boater safety course to operate a motorboat or personal watercraft, and must carry proof. It applies to rentals, and turning up without it can end the day at the dock.",
        },
        {
          question: "What is the speed limit on Geneva Lake?",
          answer:
            "Outside the traffic lane you must be at slow-no-wake. The lane is defined as the greater of 200 feet from the shoreline or 100 feet from any pier, raft, mooring or structure — a wider band around the lake than most visitors expect.",
        },
        {
          question: "Which direction do boats travel on Geneva Lake?",
          answer:
            "Counterclockwise. Boats moving at slow-no-wake speed in the traffic lane travel in a counterclockwise rotation around the lake. Most visitors do not expect a lake to have a direction of travel.",
        },
        {
          question: "What does a Lake Geneva boat rental actually cost?",
          answer:
            "More than the advertised rate. Expect fuel billed separately at marina prices on return, a security deposit held against your card, and a damage waiver that is optional in theory. Ask for the all-in figure in writing when you book.",
        },
        {
          question: "When is the best time to be on Geneva Lake?",
          answer:
            "Weekday mornings, or September. A July or August Saturday afternoon brings heavy boat traffic, chop from the boats rather than the wind, queues at the launches, and the good anchorages gone by late morning.",
        },
        {
          question: "Can I get on Geneva Lake without renting a boat?",
          answer:
            "Yes. Take the U.S. Mailboat or another Cruise Line tour, launch your own boat from one of the public town launches, swim from a public beach, or walk the 21-mile Shore Path for the same views from the shoreline.",
        },
      ]}
      related={[
        {
          title: "The U.S. Mailboat",
          path: "/guides/lake-geneva-mailboat",
          blurb: "The only working mail route in America delivered by someone jumping off a moving boat.",
        },
        {
          title: "Public access to the lake",
          path: "/guides/lake-geneva-public-access-guide",
          blurb: "Every public beach, boat launch and shoreline entry point.",
        },
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "21 miles of public shoreline path — the same views, from the other side.",
        },
      ]}
      bottomExtra={<GuideNewsletterCTA />}
    />
  );
}
