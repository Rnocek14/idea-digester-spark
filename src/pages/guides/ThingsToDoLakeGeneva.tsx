import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * The decision router. Every cell compresses a sentence written elsewhere on
 * this page — no prices, no hours, no schedules, nothing asserted here that
 * isn't argued below.
 */
const TRIPS: {
  trip: string;
  leadWith: string;
  binds: string;
  next: { label: string; path: string };
}[] = [
  {
    trip: "Couple, one weekend",
    leadWith: "Water in the morning, downtown late, one dinner you actually chose",
    binds: "The dinner reservation — book it first, build the weekend backward from it",
    next: {
      label: "This weekend",
      path: "/guides/things-to-do-lake-geneva-this-weekend",
    },
  },
  {
    trip: "Family, young kids",
    leadWith: "One beach, one boat, and an indoor plan you can reach for without a debate",
    binds: "How far the nearest bathroom is from wherever everyone is swimming",
    next: {
      label: "With kids",
      path: "/guides/things-to-do-lake-geneva-with-kids",
    },
  },
  {
    trip: "Family, teens",
    leadWith: "Your own rented boat if anyone can run one, plus unstructured downtown time",
    binds: "Whether the group will split up for an hour and meet somewhere obvious",
    next: {
      label: "In summer",
      path: "/guides/best-things-to-do-lake-geneva-in-summer",
    },
  },
  {
    trip: "Friends, a group",
    leadWith: "One booked water thing early, a loose afternoon, downtown in the evening",
    binds: "Settling that booking before you arrive — deciding on the morning of costs the morning",
    next: { label: "Nightlife", path: "/nightlife" },
  },
  {
    trip: "Solo, or a deliberately quiet trip",
    leadWith: "A shore path section, coffee, and the museum-and-observatory end of the list",
    binds: "Timing. The same places at a different hour are a different trip",
    next: { label: "The Shore Path", path: "/guides/lake-geneva-shore-path" },
  },
  {
    trip: "Day trip from Chicago or Milwaukee",
    leadWith: "One end of the lake, parked once, walked",
    binds: "The drive home — pick your leaving point before you start, not after dinner",
    next: { label: "Lake Geneva FAQ", path: "/guides/lake-geneva-faq" },
  },
  {
    trip: "Off-season or winter",
    leadWith: "Indoors, at the ski hill, or walking a quiet town — far fewer people about",
    binds: "Openness rather than crowds — confirm what's running before you drive over",
    next: {
      label: "In winter",
      path: "/guides/things-to-do-lake-geneva-in-winter",
    },
  },
];

export default function ThingsToDoLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva, Wisconsin"
      metaTitle="Things to Do in Lake Geneva, WI — A Local's Guide (Updated 2026)"
      metaDescription="A local's guide to Lake Geneva, Wisconsin — how to plan a day by season, group and time budget: the lake, the shore path, downtown, food, and what to skip."
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
          <p>
            Which is why the attraction list here is short and largely
            uncontested. Nobody arrives confused about whether to see the lake.
            What's hard is sequencing — which end of the lake on which day, and
            what to leave out. That's the job of this page; the places
            themselves have their own guides, linked throughout. You'll also
            notice no prices, hours or dates below: those are set by operators
            and municipalities, they move season to season, and a stale number
            is worse than none.
          </p>
        </>
      }
      introExtra={
        <div className="space-y-4">
          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
              The short version, up top
            </p>
            <ul className="space-y-3 text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900">Pick an end of the lake per day.</strong>{" "}
                The towns sit on a ring around the water, so any trip between
                two of them goes around the rim. East end plus west end in one
                day mostly means driving.
              </li>
              <li>
                <strong className="text-slate-900">Book the one water thing first.</strong>{" "}
                A tour or a rental is the only part of the day that runs on
                someone else's clock. Everything else bends around it.
              </li>
              <li>
                <strong className="text-slate-900">Downtown is a timing problem, not a place problem.</strong>{" "}
                Fifteen minutes end to end, and the whole weekend passes through
                it in the same few hours.
              </li>
              <li>
                <strong className="text-slate-900">Have an off-water version of every plan.</strong>{" "}
                Wind cancels boats, and the indoor list here is short.
              </li>
            </ul>
          </div>

          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
              Looking for what's on this week?
            </p>
            <p className="text-slate-700 text-base">
              The{" "}
              <Link to="/events" className={LINK}>
                live events calendar
              </Link>{" "}
              is updated daily — concerts, festivals, farmers markets, kids' programming,
              everything we can verify. This guide is the evergreen "where do I even start"
              companion to that calendar.
            </p>
          </div>
        </div>
      }
      sections={[
        {
          id: "which-trip",
          heading: "Which trip are you actually planning?",
          body: (
            <>
              <p className="mb-4">
                Most "things to do" lists answer a question nobody asked — what
                exists here. The useful question is which of these very
                different trips you're on, because a couple's weekend and a
                family day trip use almost none of the same plan. Find your row.
              </p>
              <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <caption className="sr-only">
                    Seven kinds of Lake Geneva trip, what to lead with, and
                    which guide to read next.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {["The trip", "Lead with", "What binds the day", "Go deeper"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TRIPS.map((row) => (
                      <tr
                        key={row.trip}
                        className="border-b border-slate-200 align-top last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left font-semibold text-slate-900"
                        >
                          {row.trip}
                        </th>
                        <td className="px-3 py-3 text-slate-700">{row.leadWith}</td>
                        <td className="px-3 py-3 text-slate-700">{row.binds}</td>
                        <td className="px-3 py-3">
                          <Link to={row.next.path} className={LINK}>
                            {row.next.label}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Every cell restates something argued elsewhere on this page.
                Nothing here is a price or a booking.
              </p>
            </>
          ),
        },
        {
          id: "geography",
          heading: "The lake is the logistics",
          body: (
            <>
              <p>
                One piece of geography decides more Lake Geneva itineraries than
                anything else: the towns are arranged around the water, not
                along a road. Lake Geneva sits at the east end, Williams Bay on
                the north shore, Fontana at the west end. Getting from any one
                to another means going around the rim, because the short line
                between them is water.
              </p>
              <p>
                And the driving isn't the expensive part — parking is. In
                season, arriving somewhere is cheap and re-arriving is not,
                which is why the oldest local advice about downtown still holds:
                park once, walk everywhere. Build the day around one end of the
                lake and use the drive once.
              </p>
              <ul>
                <li>
                  <strong>The east end</strong> — the City of Lake Geneva.
                  Library Park, the Riviera and its docks, the downtown blocks,
                  Riviera Beach, and{" "}
                  <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                    Big Foot Beach State Park
                  </Link>{" "}
                  just south of town — everything within a walk of everything
                  else.
                </li>
                <li>
                  <strong>The north shore</strong> — Williams Bay. Edgewater
                  Park for beach access and{" "}
                  <Link to="/guides/yerkes-observatory" className={LINK}>
                    Yerkes Observatory
                  </Link>{" "}
                  up from the water. A quieter, more deliberate half-day.
                </li>
                <li>
                  <strong>The west end</strong> — Fontana. Smaller downtown,
                  same lake, resort dining rooms on that side.
                </li>
              </ul>
              <p>
                One exception: on foot, the Geneva Lake Shore Path runs
                continuously along the shoreline and ignores the road network
                entirely. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  Shore Path guide
                </Link>{" "}
                has the distances and access points to plan around it.
              </p>
            </>
          ),
        },
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
                backyards of historic estates because of a long-standing
                public-access easement. Most people do a 2–4 mile section. The
                stretch from Library Park toward Black Point is the classic
                intro.
              </p>
              <p>
                <strong>A note on that tradition.</strong> The origin story
                you'll hear locally — that the right to walk the shoreline goes
                back to Potawatomi use of the lake — is the account as it's
                handed down here, not something this desk has traced to a deed
                or a court record. Read it as the traditional account rather
                than a citation. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  Shore Path guide
                </Link>{" "}
                sets out the easement's history separately, and marks which
                parts of it this desk treats as the traditional account rather
                than a citation.
              </p>
              <p>
                <strong>Boat tours and the U.S. Mailboat</strong> run from the
                Riviera Docks. The mailboat is a Lake Geneva original — the
                jumpers actually deliver mail by leaping onto piers at speed. If
                you only do one boat thing, do this.
              </p>
              <h3>Four ways to be on the water, and who each suits</h3>
              <ul>
                <li>
                  <strong>Sit beside it.</strong> A bench at Library Park. No
                  booking, any age. Suits people who came here to stop moving,
                  not anyone travelling with someone who needs an itinerary.
                </li>
                <li>
                  <strong>Walk it.</strong> A shore path section — the only
                  option here you can shorten halfway through. The trade-off is
                  surface: it changes underfoot as it crosses property after
                  property, so footwear and mobility matter.
                </li>
                <li>
                  <strong>Ride it.</strong> A tour boat or the mailboat. Best
                  for a first visit or a mixed-age group; the trade-off is a
                  fixed block you can't leave in the middle.
                </li>
                <li>
                  <strong>Drive it yourself.</strong> Renting is easier than
                  people think — several outfits operate out of the Riviera and
                  Gage Marine, and you book mornings in summer or you wait. Most
                  freedom, most setup.
                </li>
              </ul>
              <p>
                Doing three of those in one day is the most common way visitors
                waste an afternoon. If you end up wondering what the varnished
                wooden runabouts are, they have their own guide:{" "}
                <Link to="/guides/streblow-boats-geneva-lake" className={LINK}>
                  Streblow boats on Geneva Lake
                </Link>
                .
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
                peek even between events. Main Street and Broad Street are where
                most of the independent shops live: the booksellers, the
                chocolate shops, a couple of long-running outdoor outfitters,
                and a rotating cast of newer boutiques.
              </p>
              <p>
                It's worth being precise about why it feels crowded, because the
                fix follows from the cause. The core is tiny — fifteen minutes
                end to end — and a weekend's visitors funnel through it in the
                same handful of hours, because that's when the boats come back
                and when people eat. The crowd is a function of the clock, not
                of the town. The same blocks early, on a weekday, or in shoulder
                season — May, September, early October — read as a different
                place.
              </p>
              <p>
                For a quieter version, drive around the rim to{" "}
                <strong>Williams Bay</strong> (about ten minutes) or{" "}
                <strong>Fontana</strong> at the west end (nearer twenty).
                Smaller downtowns, same lake, half the crowd. Williams Bay's Edgewater Park has
                some of the best public beach access on the lake; the{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                  public access guide
                </Link>{" "}
                tracks which access points are open to non-residents.
              </p>
            </>
          ),
        },
        {
          id: "off-water",
          heading: "The off-water half of a lake town",
          body: (
            <>
              <p>
                Every plan here needs a version that survives wind, rain, or an
                afternoon too hot for an open shoreline. Wind is the one people
                underestimate: it doesn't just make a boat trip unpleasant, it
                can cancel one, and it gives less warning than rain.
              </p>
              <p>
                The off-water list is short but real.{" "}
                <Link to="/guides/yerkes-observatory" className={LINK}>
                  Yerkes Observatory
                </Link>{" "}
                in Williams Bay is the substantial one — a historic scientific
                instrument rather than an attraction built to be one. The{" "}
                <strong>Geneva Lake Museum</strong> is small, well-curated, and
                the honest answer to "where do I learn the real history."{" "}
                <strong>Tristan Crist Magic Theatre</strong> downtown is a
                genuine rainy-day save. The resorts run indoor amenities of their
                own, which the{" "}
                <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                  where-to-stay guide
                </Link>{" "}
                covers. And the shops are, functionally, an indoor activity.
              </p>
              <p>
                Because that list is short, everyone's bad-weather plan is the
                same bad-weather plan — on the first grey Saturday of a busy
                weekend it absorbs the whole town at once. Pick your fallback the
                night before, and confirm it's running first: tour times, show
                schedules and admissions are set by each operator and change with
                the season. The{" "}
                <Link to="/lake-geneva-weather" className={LINK}>
                  weather page
                </Link>{" "}
                and the{" "}
                <Link to="/lake-geneva-webcams" className={LINK}>
                  lake webcams
                </Link>{" "}
                answer the question a forecast alone doesn't: is the water flat
                right now.
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
                <Link to="/eats" className={LINK}>
                  dining coverage
                </Link>{" "}
                tracks what's open and what's worth it; this section is the
                evergreen frame.
              </p>
              <p>
                <strong>Friday fish fry</strong> is a Wisconsin contract. If
                you're here on a Friday, do one. We keep a running{" "}
                <Link to="/eats/fish-fry" className={LINK}>
                  fish fry guide
                </Link>{" "}
                with the current rotation.
              </p>
              <p>
                For lakeside meals, the resort dining rooms (Grand Geneva, The
                Abbey in Fontana, Pier 290 in Williams Bay) all have reliable
                kitchens and water views. For something less polished, the
                supper clubs north of town do exactly what supper clubs do, and
                do it well. The coffee scene is small but real, and breweries
                and tap rooms have grown noticeably in the last few years.
              </p>
              <p>
                Dinner is the load-bearing decision of a weekend here, and not
                because the food is the point: it's the only fixed item most
                visitors have, and everything else has to be back in time for
                it. Pick the restaurant first, note which end of the lake it
                sits on, and shape the day so you're already near it. Prices,
                hours and reservation policies belong to the restaurants and
                move between seasons; the{" "}
                <Link to="/best-of/restaurants-lake-geneva" className={LINK}>
                  restaurants roundup
                </Link>{" "}
                and{" "}
                <Link to="/nightlife" className={LINK}>
                  nightlife coverage
                </Link>{" "}
                are the pages we keep current.
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
                February. The organizers set those dates and the week moves, so
                the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>{" "}
                is the authority, not any guide page.
              </p>
              <p>
                One trade-off worth naming before committing a family day to the
                water: a boat tour is a fixed block you can't leave partway
                through, fine for older kids and hard for a toddler mid-meltdown.
                A beach is the opposite — endlessly interruptible, with no
                structure at all. The fuller version, day shapes by age included,
                is in the{" "}
                <Link to="/guides/things-to-do-lake-geneva-with-kids" className={LINK}>
                  Lake Geneva with kids guide
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "how-much-time",
          heading: "How much time do you actually have?",
          body: (
            <>
              <p>
                The most common planning mistake isn't picking the wrong thing.
                It's picking the right number of things for a longer trip than
                the one you're on. Four honest shapes:
              </p>
              <ul>
                <li>
                  <strong>A few hours, passing through.</strong> East end only.
                  Park once downtown, sit at Library Park, walk the blocks, eat
                  something. One thing done unhurriedly beats three done in
                  transit.
                </li>
                <li>
                  <strong>One full day.</strong> One water thing, one walk, one
                  downtown stretch, one real meal, all at the same end of the
                  lake. If the water thing is a booked tour you have one fixed
                  point instead of four negotiations.
                </li>
                <li>
                  <strong>A weekend.</strong> Give each day its own end of the
                  lake — one in the City of Lake Geneva, one split between
                  Williams Bay and Fontana. Variety without spending either day
                  driving; the{" "}
                  <Link to="/guides/things-to-do-lake-geneva-this-weekend" className={LINK}>
                    weekend guide
                  </Link>{" "}
                  takes that apart hour by hour.
                </li>
                <li>
                  <strong>Three days or more.</strong> Now the specific guides
                  are worth it rather than aspirational: a longer shore path
                  section, a proper visit to Yerkes, the trails behind Big Foot
                  Beach, real time in the smaller towns. It's also where staying
                  somewhere other than downtown starts to make sense — see{" "}
                  <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                    where to stay
                  </Link>
                  .
                </li>
              </ul>
              <p>
                What no amount of planning fits into one day: both ends of the
                lake, a boat, a swim, and an unhurried dinner. Better to choose
                what goes than to find out at the fourth stop.
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
                shut down; it just gets quieter and warmer-feeling.{" "}
                <strong>Spring</strong> is short and underrated: late April
                through mid-June, before the summer crush, is the moment locals
                seem to enjoy the lake most.
              </p>
              <p>
                The swing is this hard because a lake town's calendar isn't
                really about weather — it's about whether the water is usable.
                When it is, the boats run, the beaches are staffed, the patios
                open, and demand for a small number of parking spaces and tables
                spikes at once. When it isn't, the same businesses cut hours or
                close.
              </p>
              <p>
                So your constraint flips. In summer it's crowding, and the fix is
                timing — earlier, later, midweek, or the far end of the lake.
                Outside summer it's openness, and the fix is confirming before
                you drive. The shoulder seasons are good precisely because they
                briefly have neither problem. Season detail lives on its own
                pages:{" "}
                <Link to="/guides/best-things-to-do-lake-geneva-in-summer" className={LINK}>
                  summer
                </Link>{" "}
                and{" "}
                <Link to="/guides/things-to-do-lake-geneva-in-winter" className={LINK}>
                  winter
                </Link>
                .
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
              <h3>Overrated in peak season</h3>
              <p>
                Not overrated as places — overrated as plans, on the weekend
                when everyone else has made the same one.
              </p>
              <ul>
                <li>
                  <strong>Duplicating the water.</strong> A tour, then a rental,
                  then a beach is three versions of one experience. Pick the one
                  that matches how much control you want.
                </li>
                <li>
                  <strong>The extra stop at the far end.</strong> Adding
                  something at the opposite end of the lake late in the day costs
                  the rim drive twice and usually arrives too late to enjoy.
                </li>
                <li>
                  <strong>The full itinerary.</strong> The most reliable way to
                  have a worse time here is to schedule the whole list. This is a
                  town whose best hour is usually an unplanned one on a bench by
                  the water.
                </li>
              </ul>
              <p>
                And a preference rather than a skip: if a sunset over the water
                matters to you, work out which shore you need to be standing on{" "}
                <em>before</em> dinner rather than after. On a lake that's a
                geometry question with one right answer.
              </p>
            </>
          ),
        },
        {
          id: "scope-and-sources",
          heading: "What this page doesn't do, and where to check",
          body: (
            <>
              <p>
                Deliberate omissions, so you know what you're not getting. There
                are no admission prices, opening hours, tour times or festival
                dates here. Each is set by somebody else — an operator, a
                village, a state agency, an organizing committee — and each
                changes, most of them seasonally. A guide that prints them is
                accurate briefly and quietly wrong for a long time. This page
                also isn't a hotel comparison, a restaurant ranking or an event
                listing; those are three different jobs on three different pages,
                all linked above.
              </p>
              <p>What to do instead:</p>
              <ol>
                <li>
                  <strong>Anything involving a boat — ask the operator.</strong>{" "}
                  Departures, mailboat runs and rental availability are theirs,
                  and they're the only source that knows about a cancellation on
                  the day.
                </li>
                <li>
                  <strong>Beaches and launches — ask the municipality that runs it.</strong>{" "}
                  Public access is operated town by town, which is exactly why
                  non-resident rules and charges differ from one shoreline
                  village to the next. The{" "}
                  <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                    public access guide
                  </Link>{" "}
                  is the map of which is which.
                </li>
                <li>
                  <strong>Big Foot Beach is a state park, and those work differently.</strong>{" "}
                  Wisconsin state parks are entered on a vehicle admission
                  sticker rather than a per-person ticket, available in daily
                  and annual forms — so the charge lands per car, not per head.
                  The{" "}
                  <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                    Big Foot Beach guide
                  </Link>{" "}
                  covers the park; the state's own pages carry current rates.
                </li>
                <li>
                  <strong>Dates — use the calendar, not a guide.</strong>{" "}
                  Festivals move, and a week that's fixed in reputation isn't
                  always fixed on the calendar. The{" "}
                  <Link to="/events" className={LINK}>
                    events page
                  </Link>{" "}
                  is updated daily and is the only page here we'd trust for a
                  date.
                </li>
              </ol>
              <p>
                None of that takes more than a few minutes, and it's the
                difference between a plan and a hope.
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
          title: "Things to Do This Weekend",
          path: "/guides/things-to-do-lake-geneva-this-weekend",
          blurb: "The same decisions compressed into two days, plus a bad-weather plan.",
        },
        {
          title: "Lake Geneva With Kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb: "Day shapes by age, rainy-day plans that hold up, and eating out with kids.",
        },
        {
          title: "Lake Geneva in Summer",
          path: "/guides/best-things-to-do-lake-geneva-in-summer",
          blurb: "The water, the festivals, and how to enjoy the season without fighting the crowd.",
        },
        {
          title: "Lake Geneva in Winter",
          path: "/guides/things-to-do-lake-geneva-in-winter",
          blurb: "Winterfest, the ice, the ski hill, and the quieter version of the shore path.",
        },
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "21 miles of public shoreline, stop by stop — with distances and access points.",
        },
        {
          title: "Public Beaches & Boat Launches",
          path: "/guides/lake-geneva-public-access-guide",
          blurb: "Every public access point on the lake, town by town.",
        },
        {
          title: "Where to Stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb: "Resorts, downtown inns and lakefront rentals, sorted by the kind of trip.",
        },
        {
          title: "Yerkes Observatory",
          path: "/guides/yerkes-observatory",
          blurb: "The substantial off-water stop — tours, history, and the big refractor.",
        },
        {
          title: "Big Foot Beach State Park",
          path: "/guides/big-foot-beach-state-park",
          blurb: "Beach, trails and campground south of downtown — and how the sticker works.",
        },
        {
          title: "Lake Geneva FAQ",
          path: "/guides/lake-geneva-faq",
          blurb: "Distance from Chicago and Milwaukee, the lake's size and depth, when to come.",
        },
        {
          title: "Lake Geneva Neighborhoods",
          path: "/guides/lake-geneva-neighborhoods",
          blurb: "Lake Geneva, Fontana, Williams Bay, Genoa City — what each town feels like.",
        },
      ]}
      faqs={[
        {
          question: "How many days do you need in Lake Geneva?",
          answer:
            "Two full days covers the essentials — a boat trip, a stretch of the shore path, a downtown afternoon, and a real dinner. Three days lets you slow down and venture to Fontana or Williams Bay. With only a few hours, stay at the east end, park once, and do one thing properly rather than three in transit.",
        },
        {
          question: "How do you plan a day in Lake Geneva without driving back and forth?",
          answer:
            "Pick one end of the lake and stay there. The towns sit on a ring around the water, so travelling between any two means going around the rim rather than across. A day built around the City of Lake Geneva, or around Williams Bay and Fontana, uses the drive once. On a weekend, give each day its own end.",
        },
        {
          question: "What is there to do in Lake Geneva if you don't have a boat?",
          answer:
            "Most of it. Walk a section of the 21-mile Geneva Lake Shore Path, take a tour boat or the U.S. Mailboat from the Riviera Docks, swim at a public beach, walk the downtown blocks, or visit Yerkes Observatory in Williams Bay and the Geneva Lake Museum. Renting is easier than people expect, but nothing here requires owning a boat.",
        },
        {
          question: "What is there to do in Lake Geneva when it rains?",
          answer:
            "The indoor list is short: the Geneva Lake Museum, Tristan Crist Magic Theatre downtown, Yerkes Observatory in Williams Bay, the downtown shops, and the resorts' own indoor amenities. Because it's short, everyone's rainy-day plan is the same plan — decide yours the night before rather than at midday, and confirm with the operator that it's running.",
        },
        {
          question: "Is Lake Geneva good for a couples weekend?",
          answer:
            "It's one of the trips the town is best set up for. The shape that works: water in the morning, downtown in the late afternoon, one dinner you actually chose. Book the dinner first — it's the only fixed point in the weekend, and building the rest backward from it removes most of the friction.",
        },
        {
          question: "What is there to do in Lake Geneva with a group of friends?",
          answer:
            "Book one water thing in advance — a rental or a tour — and keep the rest of the day loose, with downtown in the evening. The failure mode for groups is arriving without that decision settled, because a group deciding on the morning of tends to lose the morning.",
        },
        {
          question: "Is Lake Geneva walkable?",
          answer:
            "The downtown core is about a fifteen-minute walk end to end, so once you've parked you rarely need the car again within the City of Lake Geneva. Between towns it isn't walkable by road — but the Geneva Lake Shore Path is a continuous public route along the shoreline, and it's how people move between points on the water on foot.",
        },
        {
          question: "Can you swim in Geneva Lake?",
          answer:
            "Yes. Public swim beaches include Riviera Beach in downtown Lake Geneva, Big Foot Beach State Park just south of town, and Edgewater Park in Williams Bay. The water is cleaner than most Midwest lakes thanks to a long-running watershed protection effort.",
        },
        {
          question: "What's the best way to see the lake?",
          answer:
            "Two options most locals recommend: the U.S. Mailboat tour from the Riviera Docks, or a section of the 21-mile shore path on foot. Renting your own boat is the third and easier to arrange than people expect. They suit different trips — a tour is the best first visit but a fixed commitment, a walk can be shortened halfway through, and a rental gives the most freedom for the most setup.",
        },
        {
          question: "Is Lake Geneva worth visiting in the off-season?",
          answer:
            "Yes — fall and late spring are the locals' favorite seasons. Smaller crowds, the same lake, and lodging that costs less. Winter has its own appeal if you're into ice fishing, cross-country skiing, or Winterfest. What changes off-season is your constraint: in summer it's crowding, and outside summer it's whether a given place is open, so confirm before you drive over.",
        },
        {
          question: "Do you need to book anything in advance in Lake Geneva?",
          answer:
            "Two things, in season: the water activity and the dinner. A boat tour or rental is the only part of the day that runs on someone else's schedule, and a weekend dinner is where an unplanned evening most often turns into a long wait. Lodging is worth booking early in summer too. Everything else can be decided on the day.",
        },
        {
          question: "Where do I find current hours, prices, and event dates for Lake Geneva?",
          answer:
            "From whoever sets them. Boat operators publish their own departures and handle weather cancellations. Beaches and launches are run town by town, so rules and charges differ between shoreline villages. Big Foot Beach is a Wisconsin state park, entered on a vehicle admission sticker rather than a per-person ticket. For dates, use a live events calendar rather than any evergreen guide — festival weeks move.",
        },
      ]}
    />
  );
}
