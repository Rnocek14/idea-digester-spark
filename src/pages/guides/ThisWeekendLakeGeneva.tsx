import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";
const UPDATED = "2026-07-29";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Four weekend shapes, side by side. Every cell compresses a sentence written
 * elsewhere on this page — no dates, no times, no prices, no bookings.
 */
const WEEKEND_SHAPES: {
  trip: string;
  lockFirst: string;
  leaveLoose: string;
  goesWrong: string;
}[] = [
  {
    trip: "Day trip from Chicago or Milwaukee",
    lockFirst: "One water thing, or nothing at all",
    leaveLoose: "Lunch, the shops, how far you walk",
    goesWrong:
      "Fitting a boat, a long shore path leg and a sit-down dinner between the drive up and the drive home",
  },
  {
    trip: "One night, in season",
    lockFirst: "Dinner — and the water thing if you want one",
    leaveLoose: "The whole afternoon",
    goesWrong:
      "Arriving to discover the only fixed item of the weekend was the one that needed a reservation",
  },
  {
    trip: "Two nights, in season",
    lockFirst: "Lodging, then dinner, then the boat",
    leaveLoose: "Sunday, entirely",
    goesWrong:
      "Stacking two booked things on the same day and spending a weekend watching a clock",
  },
  {
    trip: "Off-season or shoulder weekend",
    lockFirst: "Usually nothing — but confirm anything seasonal is running",
    leaveLoose: "Most of it",
    goesWrong:
      "Assuming a summer itinerary transfers. Some of it is seasonal and simply isn't there",
  },
];

export default function ThisWeekendLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva This Weekend"
      metaTitle="Things to Do in Lake Geneva This Weekend — A Local's Picks"
      metaDescription="A local's shortlist of what's worth your weekend in Lake Geneva, Wisconsin — events, food, the lake, the shore path, and the quieter corners most visitors miss."
      path="/guides/things-to-do-lake-geneva-this-weekend"
      datePublished={TODAY}
      dateModified={UPDATED}
      intro={
        <>
          <p>
            A weekend in Lake Geneva is a planning game more than a
            what-to-do game — the lake, the shore path, and a downtown you
            can cross on foot mean the bones of a great weekend are already
            here. The question is mostly which order, and which corners to
            skip.
          </p>
          <p>
            This is the page The Brief editors hand a friend texting on a
            Friday morning, and it's deliberately not a list of what's on.
            The{" "}
            <Link to="/events" className={LINK}>
              live events calendar
            </Link>{" "}
            is the current-week source — concerts, markets, festivals, kids'
            programming, anything with a date attached. This guide is the
            evergreen frame around it: what has to be booked versus walked up
            to, what to do when the forecast turns, and how the season changes
            both answers.
          </p>
          <p>
            You'll notice there are no event dates, prices or opening hours
            below. Each belongs to somebody else — a boat line, a restaurant,
            a village, an organizing committee — and each moves.
          </p>
        </>
      }
      introExtra={
        <div className="not-prose rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            What's on right now
          </p>
          <p className="text-slate-700 text-base leading-relaxed">
            For dated specifics — concerts, farmers markets, festivals, kid
            programming — see the{" "}
            <Link to="/events" className={LINK}>
              full events calendar
            </Link>
            . That page is maintained week to week and is the one to trust for
            this weekend. Everything below is the part that doesn't change.
          </p>
        </div>
      }
      sections={[
        {
          id: "weekday-vs-weekend",
          heading: "Why a weekend here isn't just a longer Tuesday",
          body: (
            <>
              <p>
                Lake Geneva is a resort town inside comfortable driving range
                of two large metros, and demand doesn't spread evenly across
                the week — it lands in a window that opens Friday evening and
                closes Sunday afternoon. Almost everything a visitor
                experiences as a problem here is that compression rather than
                a shortage: a full dining room, a sold-out departure, a lot
                with no gaps, a beach that felt half-private on Thursday.
              </p>
              <p>
                That changes the fix. On a weekend the constraint is rarely{" "}
                <em>is this open</em> — it's <em>is there room</em>, and a
                longer list of attractions doesn't help while sequencing and
                two phone calls do. The same advice can be right and wrong on
                the same day: walk down to the docks and see what's leaving is
                sound midweek and a good way to lose a July Saturday
                afternoon.
              </p>
              <p>
                The dependable release valve is early — mornings are the least
                compressed hours of a weekend, and free. If that isn't you,
                plan around the crowd instead of pretending it isn't there:
                eat early or late rather than in the middle, pick the quieter
                shoreline over the famous one, walk instead of drive.
              </p>
            </>
          ),
        },
        {
          id: "which-weekend",
          heading: "Which weekend you're planning, and what to lock first",
          body: (
            <>
              <p className="mb-4">
                Four trips get planned from this page, and they aren't
                variations on one itinerary — they're different problems.
              </p>
              <div
                className="overflow-x-auto rounded-sm border border-slate-200 bg-white"
                role="region"
                aria-label="Comparison table, scrollable"
                tabIndex={0}
              >
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <caption className="sr-only">
                    Four Lake Geneva weekend shapes compared on what to book
                    first, what to leave unplanned, and the mistake each one
                    tends to make.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {[
                        "The trip",
                        "Lock this first",
                        "Leave this loose",
                        "Where it usually goes wrong",
                      ].map((h) => (
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
                    {WEEKEND_SHAPES.map((row) => (
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
                        <td className="px-3 py-3 text-slate-700">
                          {row.lockFirst}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.leaveLoose}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.goesWrong}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Every cell restates something stated elsewhere on this page.
                Nothing here is a date, a time or a booking.
              </p>
              <p>
                Nights don't change what's here, only how much of it can be
                fixed in advance before a weekend turns into a schedule. A day
                trip carries one fixed item. Two nights carry three across two
                days and still leave a morning with nothing in it.
              </p>
              <p>
                One test sorts almost everything into the first column or the
                second: if it has a departure time and a finite number of
                seats, it's a booking; if it's a place rather than a
                departure, it's a walk-up.
              </p>
              <p>
                <strong>Book</strong> the water thing, because a tour has both
                a clock and a seat count. Book dinner — the load-bearing item
                of most trips here, not because the food is the point but
                because it's what everything else has to be back in time for.
                Book lodging in season, and anything ticketed off the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>
                .
              </p>
              <p>
                <strong>Walk up</strong> to the shore path, the downtown
                blocks and shops, the public beaches and parks, a coffee and a
                bench. That list is what makes this town easy — and it's the
                trap, because it's long enough that people assume the whole
                weekend works that way.
              </p>
              <p>
                Each of those has exactly one authoritative source, and it
                isn't this page: the operator for departures, the restaurant
                for its own hours, the events calendar for anything dated, and
                the municipality for beaches and launches — public access here
                is run town by town, so non-resident rules differ between
                shoreline villages. The{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                  public access guide
                </Link>{" "}
                is the map of which shoreline is whose.
              </p>
            </>
          ),
        },
        {
          id: "friday",
          heading: "Friday night",
          body: (
            <>
              <p>
                Friday in Lake Geneva is a fish fry, almost without exception.
                It's a Wisconsin contract more than a meal, and our running{" "}
                <Link to="/eats/fish-fry" className={LINK}>
                  fish fry guide
                </Link>{" "}
                tracks who's serving and the current Friday rotation.
              </p>
              <p>
                Because it's a standing weekly institution rather than a
                special event, the constraint isn't finding one — it's the
                hour you walk in. A good share of the county is doing the same
                thing on the same night, so the comfortable ends are early or
                late and the middle is where the wait lives.
              </p>
              <p>
                If a fish fry isn't the move, the supper clubs north of town
                are the second answer — old-school, slow, generous pours — and
                lakeside seating at the Pier 290 patio in Williams Bay or the
                Grand Geneva is the third. After dinner the Riviera ballroom
                often has something on, though whether it does on your Friday
                is an{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>{" "}
                question rather than a guide question. Downtown stays lively
                past sunset in summer; winter Fridays are quieter, which is
                the appeal rather than a disappointment.
              </p>
            </>
          ),
        },
        {
          id: "saturday",
          heading: "Saturday: the full day",
          body: (
            <>
              <p>
                Mornings on the lake belong to the early risers: a coffee from
                a downtown roaster, a bench in Library Park, and the mailboat
                heading out for its 10am run is one of the best free hours in
                town. Departure times belong to the boat line and shift with
                the season — confirm them there, not here.
              </p>
              <p>
                <strong>The boat decision</strong>: the U.S. Mailboat tour is
                the signature pick (the jumpers actually deliver mail at
                speed), a general lake tour from the Riviera Docks is the
                shorter alternative, and renting your own from the Riviera or
                Gage Marine is more doable than people think — call by
                Thursday in summer. The mailboat is the best first visit and a
                commitment you can't shorten; a tour asks less of the day; a
                rental buys the most freedom for the most setup.
              </p>
              <p>
                <strong>The walk decision</strong>: the Geneva Lake Shore Path
                is 21 miles around the whole lake and most people do a 2–4
                mile section. Library Park toward Black Point is the classic
                introduction — historic estates, lake views, and a
                public-access tradition that, as the account is handed down
                around the lake, predates statehood. It's also one of the few
                things here you can abandon halfway through without wasting
                anything, which makes it a reasonable partner for a day that
                already has a fixed item in it. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  shore path guide
                </Link>{" "}
                breaks the loop into legs.
              </p>
              <p>
                One piece of geography does more work than any tip: you drive
                around the lake rather than across it, so road distance is
                nothing like straight-line distance. Settle which end dinner
                is on, then shape the afternoon toward it — lunch downtown or
                lakeside, the shops on Main and Broad, and a real sit-down
                dinner booked Friday at the latest in summer.
              </p>
            </>
          ),
        },
        {
          id: "sunday",
          heading: "Sunday: slow it down",
          body: (
            <>
              <p>
                Sundays are quieter on purpose. The compression that fills the
                town on Friday evening runs the other way on Sunday afternoon
                as weekenders head home, which makes Sunday morning one of the
                calmest good stretches of the weekend and mid-afternoon the
                part you'd rather not spend on the road out.
              </p>
              <p>
                A long breakfast, the farmers market when it's in season
                (dates on the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>
                ), and a drive to <strong>Fontana or Williams Bay</strong> for
                a different shoreline before heading home. Yerkes Observatory
                runs Sunday tours and is worth the detour, though the schedule
                is the observatory's and worth confirming first. Big Foot
                Beach State Park is the easier swim and picnic answer if
                Saturday was a marathon; the Geneva Lake Museum is the
                rainy-Sunday save.
              </p>
              <p>
                One mechanical note on the state park, because it catches
                people out: leaving a vehicle inside a Wisconsin state park
                requires a state park vehicle admission sticker, sold daily or
                annual, and it attaches to the car rather than the activity —
                swimming, picnicking, or only using the lot as a shore path
                trailhead. The{" "}
                <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                  Big Foot Beach guide
                </Link>{" "}
                covers it.
              </p>
            </>
          ),
        },
        {
          id: "rain",
          heading: "When the forecast turns",
          body: (
            <>
              <p>Sort a wet weekend into three buckets, not a write-off.</p>
              <p>
                <strong>Rain-proof.</strong> The Geneva Lake Museum, Yerkes,
                the magic theatre downtown, the Riviera ballroom if something's
                on, and a long lunch somewhere with a view of the lake instead
                of on it. The breweries and tap rooms have grown noticeably in
                the last few years; an afternoon flight is a reasonable rain
                plan.
              </p>
              <p>
                <strong>Rain-tolerant.</strong> A shore path leg in light rain
                is close to empty, and plenty of people here would rather walk
                it wet than not at all. The trade-off is footing: the path is
                uneven, unpaved in stretches, and takes in stone steps and
                tree roots, all of which behave differently wet. Whether a
                given leg is walkable in the rain is a judgement to make on the
                ground, in the shoes you have on — this desk can't make it for
                you.
              </p>
              <p>
                <strong>Rain-cancelled.</strong> Open boats and beaches. On
                open water it's usually wind rather than rain that decides
                whether a boat goes out, because chop builds across a long
                fetch of open lake in a way it never does on a sheltered
                river. That call is the operator's, and it's made the same
                day.
              </p>
              <p>
                Then swap the days rather than salvage one: indoor list on the
                wet day, water on the dry one. For what the sky is doing over
                the water right now — which a regional forecast won't tell you
                — the{" "}
                <Link to="/lake-geneva-webcams" className={LINK}>
                  lake webcams
                </Link>{" "}
                are faster than any app, and the{" "}
                <Link to="/lake-geneva-weather" className={LINK}>
                  local weather page
                </Link>{" "}
                is the forecast side of the same question.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "How the season changes the answer",
          body: (
            <>
              <p>
                A lake town's calendar is set by the water. What's running
                depends on whether boats are in, and that isn't a town-wide
                switch someone throws — it's an operator-by-operator decision,
                which is why "is it open yet" is a phone call every spring
                rather than a fact a guide can hold.
              </p>
              <ul>
                <li>
                  <strong>Summer</strong> — peak. Everything is running and
                  everything is full; this is the season the booking advice
                  above is written for. The{" "}
                  <Link to="/guides/best-things-to-do-lake-geneva-in-summer" className={LINK}>
                    summer guide
                  </Link>{" "}
                  goes deeper.
                </li>
                <li>
                  <strong>Fall</strong> — the good shoulder. Walk-up capacity
                  returns and the town goes back to something closer to its
                  own size. The catch: seasonal operations wind down on their
                  own schedules, so confirm anything you'd drive over for.
                </li>
                <li>
                  <strong>Winter</strong> — the quiet is the product, not a
                  compromise. Less is running, so there's less to book, and a
                  weekend shifts onto the food, the indoor list, and a lake
                  most visitors never see. The{" "}
                  <Link to="/guides/things-to-do-lake-geneva-in-winter" className={LINK}>
                    winter guide
                  </Link>{" "}
                  is the companion read.
                </li>
                <li>
                  <strong>Spring</strong> — the least predictable of the four,
                  because reopening is staggered rather than simultaneous.
                </li>
              </ul>
              <p>
                None of those seasons gets a start or end date here. They
                aren't ours to set, and a printed date is a promise this page
                can't keep.
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
                If you only have one weekend: skip the inland chains, skip
                trying to drive between every stop downtown (park once, walk
                everywhere), and skip Saturday afternoon at Riviera Beach in
                July unless you arrived by 10am. Edgewater Park in Williams
                Bay is the better afternoon swim answer that week.
              </p>
              <p>
                Two more worth naming. Skip trying to walk the whole shore
                path — 21 miles is a hiking commitment, not a weekend errand.
                And skip stacking two booked things on one day: a weekend with
                a single fixed item in it feels like a weekend, and a weekend
                with three feels like a connecting flight.
              </p>
            </>
          ),
        },
        {
          id: "scope",
          heading: "What this page deliberately doesn't do",
          body: (
            <>
              <p>
                Deliberate omissions, so you know what you're not getting. No
                event dates, admission prices or opening hours — each is set
                by somebody else and each changes, and the one long-standing
                departure mentioned above is still the boat line's to confirm.
                This
                also isn't a lodging comparison, a restaurant ranking or an
                events listing; those are three different jobs, done on{" "}
                <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                  where to stay
                </Link>
                ,{" "}
                <Link to="/eats" className={LINK}>
                  the eats section
                </Link>{" "}
                and the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>
                .
              </p>
              <p>Which leaves a whole weekend here as four contacts, in order:</p>
              <ol>
                <li>
                  <strong>The events calendar,</strong> for anything dated
                  this week.
                </li>
                <li>
                  <strong>The restaurant,</strong> for the fixed meal you
                  build the day backward from.
                </li>
                <li>
                  <strong>The operator,</strong> if a boat is in the plan — for
                  the departure, and on the day for the weather call.
                </li>
                <li>
                  <strong>The forecast and the webcams,</strong> the morning
                  of, to decide which day is the water day.
                </li>
              </ol>
              <p>
                That's the whole procedure. Everything else can be decided
                standing on the sidewalk, which is the actual argument for
                coming here on a weekend.
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
          blurb:
            "The full evergreen guide — boats, the shore path, downtown, food, and what changes by season.",
        },
        {
          title: "Things to Do With Kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb:
            "Family-friendly weekend planning, from beaches to Yerkes Observatory to the magic theatre downtown.",
        },
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "The 21-mile loop broken into legs — the walk-up half of any weekend here.",
        },
        {
          title: "Lake Geneva in Summer",
          path: "/guides/best-things-to-do-lake-geneva-in-summer",
          blurb:
            "Peak season, when the booking advice on this page matters most.",
        },
        {
          title: "Lake Geneva in Winter",
          path: "/guides/things-to-do-lake-geneva-in-winter",
          blurb:
            "The off-season weekend, where the quiet is the product rather than a compromise.",
        },
        {
          title: "Where to Stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb:
            "Downtown, resort or lakeside — the lodging decision this page deliberately leaves alone.",
        },
        {
          title: "Public Access to the Lake",
          path: "/guides/lake-geneva-public-access-guide",
          blurb:
            "Beaches, launches and entry points, town by town — including which ones sit outside the state park.",
        },
        {
          title: "Big Foot Beach State Park",
          path: "/guides/big-foot-beach-state-park",
          blurb:
            "The easier swim-and-picnic answer, and how the vehicle sticker works.",
        },
      ]}
      faqs={[
        {
          question: "Where do I find what's actually happening in Lake Geneva this weekend?",
          answer:
            "The live events calendar on this site is the current-week source — concerts, farmers markets, festivals and kids' programming, with dates. This guide is deliberately the evergreen frame around that listing rather than a list of what's on, because dated specifics go stale within a week of being written.",
        },
        {
          question: "What's the best free thing to do in Lake Geneva on a weekend?",
          answer:
            "Walking a section of the 21-mile Geneva Lake Shore Path. The stretch from Library Park toward Black Point is the easiest introduction and one of the best free experiences in town. It's also the most flexible thing on a weekend itinerary, because you can turn around whenever you like.",
        },
        {
          question: "What do I actually need to book for a Lake Geneva weekend?",
          answer:
            "In season: the water thing, dinner, lodging, and anything ticketed you found on the events calendar. The test is simple — if it has a departure time and a finite number of seats, book it. If it's a place rather than a departure, walk up. The shore path, downtown, the shops, and the public beaches and parks all fall on the walk-up side.",
        },
        {
          question: "Do I need to book a boat tour in advance?",
          answer:
            "In summer, yes — especially the U.S. Mailboat tour and weekend afternoons. Off-season you can often walk up. Renting your own boat is easier with a few days of lead time. Departure times and availability belong to the operator, who is also the only source that knows about a same-day weather cancellation.",
        },
        {
          question: "Can you do Lake Geneva as a day trip from Chicago or Milwaukee?",
          answer:
            "Yes — about 90 minutes from downtown Chicago and 50 to 70 minutes from Milwaukee. A focused day with a boat tour, a downtown lunch, and a stretch of the shore path is very doable. The mistake is carrying more than one fixed item on a day that already includes the drive both ways.",
        },
        {
          question: "Is one night enough for a weekend in Lake Geneva?",
          answer:
            "It's enough, but it changes what you can plan rather than what you can see. One night comfortably carries one or two fixed items — usually dinner and a boat — with the afternoon left loose. Two nights lets you spread the same items across two days and still keep a morning with nothing in it, which is the version most people actually wanted.",
        },
        {
          question: "Is a weekend really busier than a weekday in Lake Geneva?",
          answer:
            "Noticeably, and the reason is geography rather than popularity: this is a resort town within easy driving range of two large metros, so demand concentrates in a window from Friday evening to Sunday afternoon. The practical consequence is that the weekend constraint is capacity, not opening hours — which is why sequencing and a couple of phone calls do more for a weekend here than a longer list of things to do.",
        },
        {
          question: "What is there to do in Lake Geneva when it rains?",
          answer:
            "The Geneva Lake Museum, Yerkes Observatory in Williams Bay, the magic theatre downtown, the Riviera ballroom if something is scheduled, and the breweries and tap rooms, which have grown noticeably in recent years. A shore path leg in light rain is also nearly empty, though the path is uneven and unpaved in stretches and includes stone steps and tree roots, so whether a given leg is walkable wet is a call to make on the ground rather than one this guide can make for you. On a two-day trip the better plan is to swap the days: indoor list on the wet one, water on the dry one.",
        },
        {
          question: "Can you have a good Lake Geneva weekend without getting on a boat?",
          answer:
            "Easily. The shore path, the public beaches, the downtown blocks, Yerkes Observatory, the Geneva Lake Museum and the food are all shore-side, and none of them require a reservation or a departure time. Skipping the boat also removes the one item in a typical weekend here that runs on someone else's clock.",
        },
        {
          question: "Do I need a sticker to park at Big Foot Beach State Park?",
          answer:
            "Yes — leaving a vehicle inside a Wisconsin state park requires a state park vehicle admission sticker, available daily or annual. It attaches to the car rather than to the activity, so it applies whether you're swimming, picnicking, or only using the lot as a shore path trailhead. The public access guide covers entry points outside the park if you'd rather not buy one for a short walk.",
        },
        {
          question: "Where should I swim if Riviera Beach is packed?",
          answer:
            "Edgewater Park in Williams Bay is the better afternoon answer on a busy summer Saturday, and Big Foot Beach State Park just south of town is the easier picnic-and-swim option. Public access around this lake is run town by town, so non-resident rules differ between shoreline villages — the public access guide is the map of which is which.",
        },
        {
          question: "Is Lake Geneva worth a weekend in the off-season?",
          answer:
            "For a different trip than the summer one, yes. Less is running, which means less to book and considerably more room, and the weight of the weekend shifts onto the food, the indoor stops and a lake that most visitors never see quiet. The trade-off is that seasonal operations reopen and wind down on their own individual schedules rather than on a shared date, so anything you'd drive over specifically for is worth confirming first.",
        },
      ]}
    />
  );
}
