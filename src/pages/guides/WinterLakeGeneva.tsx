import { GuideShell } from "@/components/guides/GuideShell";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";
const UPDATED = "2026-07-29";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Five winter trips, side by side. Every cell compresses a sentence written
 * elsewhere on this page — no dates, no prices, no hours, no new claims.
 */
const TRIPS: {
  trip: string;
  builtAround: string;
  dependsOn: string;
  bookFirst: string;
}[] = [
  {
    trip: "Championship weekend",
    builtAround:
      "Winterfest and the U.S. National Snow-Sculpting Championship at the Riviera",
    dependsOn:
      "Getting a room at all — this is the one winter weekend that behaves like July",
    bookFirst: "Lodging, far ahead of everything else",
  },
  {
    trip: "The quiet weekend",
    builtAround:
      "A long dinner, a walk, a spa afternoon, a slow morning with nowhere to be",
    dependsOn:
      "Almost nothing. This is the version of a winter trip that the weather cannot cancel",
    bookFirst:
      "Dinner — and confirmation that the restaurant is open the day you want it",
  },
  {
    trip: "The snow day",
    builtAround: "Mountain Top, sledding, cross-country trails",
    dependsOn:
      "Conditions, natural or made — the one trip that a green winter genuinely takes away",
    bookFirst: "Lessons and rentals, then re-check conditions the morning of",
  },
  {
    trip: "The ice trip",
    builtAround: "A half-day of ice fishing with an outfitter who knows the lake",
    dependsOn:
      "The lake actually freezing, and an outfitter judging it worth going out on",
    bookFirst:
      "Nothing. Commit to this one last, after someone who was out there this week says so",
  },
  {
    trip: "The indoor anchor",
    builtAround:
      "The museum, the magic theatre, an observatory tour, a long lunch indoors",
    dependsOn:
      "Nothing weather-wise, and everything schedule-wise — winter hours are the whole game",
    bookFirst: "Confirmation of each venue's current winter schedule, from the venue",
  },
];

/**
 * The procedure for getting current information yourself. Sources only —
 * deliberately no hours, no dates, no numbers.
 */
const CHECKS: { source: string; use: string }[] = [
  {
    source: "The operator, by phone",
    use: "Winter is the season a small business actually answers. One call settles hours, closures, and whether the kitchen is running that night.",
  },
  {
    source: "The operator's own feed",
    use: "A post from this week beats a website footer. Footers are the field most often left on last summer's schedule.",
  },
  {
    source: "Aggregator listings — with suspicion",
    use: "Third-party hours are inherited and rarely corrected in January. Treat them as a hint, then confirm with the business.",
  },
  {
    source: "The events calendar",
    use: "For which weekend anything actually falls on this year, rather than a date reprinted from a previous season.",
  },
  {
    source: "Weather and webcams",
    use: "For conditions, checked late rather than early — a forecast made a week out is not a plan.",
  },
  {
    source: "Bait shops, outfitters, local groups",
    use: "The only honest read on ice, because it comes from people who were standing on it recently.",
  },
];

export default function WinterLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva in Winter"
      metaTitle="Things to Do in Lake Geneva in Winter — A Local's Guide"
      metaDescription="A local's guide to winter in Lake Geneva, Wisconsin — Winterfest, the National Snow-Sculpting Championship, ice fishing, cross-country skiing, and the quieter version of the shore path."
      path="/guides/things-to-do-lake-geneva-in-winter"
      datePublished={TODAY}
      dateModified={UPDATED}
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
          <p>
            Two notes on how this page is written. It carries no prices, hours
            or this-year dates — operators set those and revise them
            mid-season, and a stale number is worse than none, so what follows
            points at the source instead. And it will not tell you the ice is
            safe. No page can.
          </p>
        </>
      }
      introExtra={
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
            The short version, up top
          </p>
          <ul className="space-y-3 text-slate-700 leading-relaxed">
            <li>
              <strong className="text-slate-900">Winter is a trade, not a downgrade.</strong>{" "}
              You give up the lake's summer program — boats, beaches, the whole
              on-the-water calendar — and you get the town back. Space at
              dinner, a shore path with nobody on it.
            </li>
            <li>
              <strong className="text-slate-900">One weekend behaves like July.</strong>{" "}
              Winterfest and the snow-sculpting championship put a
              summer-sized crowd against the same fixed number of rooms. Every
              other winter weekend is the easier booking; that one is the
              hardest of the season.
            </li>
            <li>
              <strong className="text-slate-900">Build the trip so weather is upside.</strong>{" "}
              Ice and snow are the two things nobody can promise months ahead.
              Anchor each day on something indoors, then treat a frozen lake or
              a good base as the bonus it is.
            </li>
          </ul>
        </div>
      }
      sections={[
        {
          id: "which-trip",
          heading: "Which winter trip are you actually planning?",
          body: (
            <>
              <p className="mb-4">
                "Things to do in Lake Geneva in winter" is really five
                different questions, and they have different answers, different
                booking orders, and very different exposure to the weather.
                Settle which one you're on before you book anything.
              </p>
              <div
                className="overflow-x-auto scroll-x-hint rounded-sm border border-slate-200 bg-white"
                role="region"
                aria-label="Comparison table, scrollable"
                tabIndex={0}
              >
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <caption className="sr-only">
                    Five winter trip types in Lake Geneva compared on what each
                    is built around, what it depends on, and what to book first.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {[
                        "The trip",
                        "What it's built around",
                        "What it depends on",
                        "What to book first",
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
                        <td className="px-3 py-3 text-slate-700">
                          {row.builtAround}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.dependsOn}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.bookFirst}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Every cell restates something stated elsewhere on this page.
                Nothing here is a schedule or a quoted price.
              </p>
              <p>
                Two of these rows are weather-proof and two are not. Book only
                the middle two and you've bet a weekend on a forecast.
              </p>
            </>
          ),
        },
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
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>{" "}
                tracks current dates.
              </p>
              <p>
                Why that one weekend is harder to book than the whole rest of
                the season is simple arithmetic. The number of hotel rooms and
                rental houses around this lake doesn't shrink in the off-season
                — the buildings are all still standing in February. Demand
                does, to a fraction of what the town is built to hold, and
                that's the entire reason a winter weekend here is the easy
                booking. Championship weekend puts a summer-sized crowd back
                against that same fixed supply.
              </p>
              <p>
                Which cuts two ways. If the sculptures are why you're coming,
                plan like you're booking a summer holiday weekend and accept
                that you'll be sharing the sidewalk. If you're coming for the
                quiet — the honest selling point of winter here — check the
                calendar so you can avoid that weekend rather than land on it
                by accident.
              </p>
            </>
          ),
        },
        {
          id: "open-closed",
          heading: "What's open in winter — and how to find out",
          body: (
            <>
              <p>
                This is the question that actually decides whether a winter trip
                works, and it's the one no guide can answer permanently.
              </p>
              <p>
                The mechanism is straightforward. A business whose revenue is
                concentrated into a short, intense season can't carry a full
                summer schedule through January, because the staffing doesn't
                pencil against a slow Tuesday. So places adapt in three
                different ways, and around this lake you'll find all three:
                some trim to a shorter week, some close for a stretch and
                reopen, some run normally and are simply quiet. Nothing from
                the outside tells you which is which, and the same business can
                make a different call from one winter to the next.
              </p>
              <p>
                So a winter itinerary should be confirmed, not assumed. Showing
                up at a restaurant you ate at in August and finding the lights
                off isn't bad luck; it's the predictable result of not calling.
                Six sources, in rough order of how much they're worth:
              </p>
              <div
                className="mt-4 overflow-x-auto scroll-x-hint rounded-sm border border-slate-200 bg-white"
                role="region"
                aria-label="Comparison table, scrollable"
                tabIndex={0}
              >
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <caption className="sr-only">
                    Where to check what's open in Lake Geneva in winter, and
                    what each source is good for.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {["Source", "What it's good for"].map((h) => (
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
                    {CHECKS.map((row) => (
                      <tr
                        key={row.source}
                        className="border-b border-slate-200 align-top last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left font-semibold text-slate-900 whitespace-nowrap"
                        >
                          {row.source}
                        </th>
                        <td className="px-3 py-3 text-slate-700">{row.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                For dining, The Brief's{" "}
                <Link to="/eats" className={LINK}>
                  dining coverage
                </Link>{" "}
                tracks what's open week to week, which is the right cadence for
                a question that changes week to week. For conditions, the{" "}
                <Link to="/lake-geneva-weather" className={LINK}>
                  local forecast
                </Link>{" "}
                and the{" "}
                <Link to="/lake-geneva-webcams" className={LINK}>
                  lake webcams
                </Link>{" "}
                get more useful the closer to departure you look at them.
              </p>
            </>
          ),
        },
        {
          id: "ice",
          heading: "On the ice: fishing, walking, and what this page won't tell you",
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
              <div className="my-5 rounded-sm border border-amber-300 bg-amber-50 p-5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-amber-800 mb-2">
                  Read this before you step onto anything
                </p>
                <p className="text-slate-800 leading-relaxed">
                  Nothing on this page is a clearance to walk on Geneva Lake.
                  This desk is not aware of any agency that inspects a lake and
                  declares it open, here or elsewhere in Wisconsin — so waiting
                  for an official green light is not a plan. The decision is
                  yours, made in person, on the day, and the only inputs worth
                  anything are current and local.
                </p>
              </div>
              <p>
                It helps to understand why a single reassuring number is
                worthless. Ice on a large lake doesn't form as one even sheet.
                Anything that keeps water moving underneath — springs, inflows
                and outflows, current, any aerator running near a pier — leaves
                thin ice directly alongside thick ice
                with nothing on the surface to mark the boundary. Wind stacks
                and cracks it into pressure ridges. Snow on top insulates,
                which both slows the ice below from thickening and hides
                whatever is down there. A mid-winter warm stretch can undo
                weeks of cold in days.
              </p>
              <p>
                So a measurement tells you about the hole it was taken in and
                the hour it was taken. A photograph from last weekend tells you
                about last weekend. A confident stranger online is telling you
                about their own risk tolerance, not about the ice under your
                boots. Bait shops, outfitters and local groups are the best
                available read precisely because those people were out there
                recently — but treat what they say as information, not as
                permission.
              </p>
              <p>
                Which is the strongest practical argument for going out with an
                outfitter the first time. What you're renting isn't really the
                shanty and the auger; it's judgment — someone whose livelihood
                depends on reading this specific lake correctly and who has
                every reason not to take a group somewhere questionable. That
                is a better bet than your own read of a strange lake; it is not
                a guarantee, and nobody can offer one. If ice
                is central to your trip, make it the last thing you commit to
                and the first thing you're willing to drop. And whatever you
                decide, dress for the water rather than the air.
              </p>
            </>
          ),
        },
        {
          id: "ski",
          heading: "Skiing, sledding, and snow conditions",
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
                Be honest about who that suits. For a first-timer, a family
                with small kids, or anyone who wants a half-day on skis rather
                than an expedition, a small hill near your room is the right
                tool and the drive north is a wasted Saturday. For an
                experienced skier chasing vertical and variety it isn't, and
                the hills further north exist for exactly that reason. A winter
                trip here is not a ski holiday with a lake attached; it's a
                lake weekend with skiing available.
              </p>
              <p>
                <strong>Cross-country trails</strong> run through Big Foot
                Beach State Park and several parcels around the lake. The{" "}
                <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                  state park guide
                </Link>{" "}
                covers the park itself in more detail. Two procedural notes
                that catch people out. Wisconsin state parks are entered on a
                vehicle admission sticker rather than a per-person ticket, and
                trail use can carry its own conditions on top of that — what
                applies on a given winter day, and what it costs, is a
                Wisconsin DNR question, and the current figures live with the
                DNR and the park rather than in a guide. Ask rather than assume
                a sticker covers everything. And fresh snow is not groomed trail:
                grooming happens after a snowfall, on somebody's schedule, so a
                big overnight doesn't mean tracks are set by morning.
              </p>
              <p>
                Whether there's snow at all is the larger variable. Small
                Midwest ski operations run on snowmaking at least as much as on
                natural snowfall, which is why a brown December doesn't
                necessarily mean a closed hill. The catch is that snowmaking
                needs cold, dry air to work — so the winter that really hurts a
                hill isn't the one without snow, it's the warm, wet one where
                the machines can't run either.
              </p>
              <p>
                Sledding hills are scattered around town. The temporary
                lakefront hill during Winterfest is the obvious one; ask any
                local family about the neighborhood favorite and you'll get
                three answers. Worth saying plainly: those are hills, not
                facilities — nobody grooms or supervises them, which is how
                sledding has always worked, as long as you go in understanding
                it.
              </p>
            </>
          ),
        },
        {
          id: "shore-path",
          heading: "The shore path in snow",
          body: (
            <>
              <p>
                The shore path stays open in winter where it's safely walkable —
                with traction, it's one of the prettier cold-weather walks
                in the Midwest. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  full shore path guide
                </Link>{" "}
                covers the route, the access points and the history of the
                easement that keeps it public.
              </p>
              <p>
                Winter changes the walk in its favor in one specific way: with
                the leaves down, the sightlines open up. You see more of the
                water and more of the houses in January than in July from
                exactly the same feet of path, and the foot traffic that makes
                the summer version a social experience is simply absent.
              </p>
              <p>
                The trade-offs are equally real. The path is not maintained for
                snow. What gets cleared, when anything does, is the paved
                downtown stretch; the grass, gravel and stone-step sections
                don't, so walkability changes stretch by stretch rather than
                holding for the whole route. Snow over ice is the normal winter
                surface, and ice forms first along the edge closest to the
                water, which is why traction devices matter more here than
                boots do. Treat a winter walk as an out-and-back on a section
                you can see rather than pushing through an unbroken one. And the
                daylight is short: the middle of the day is the whole usable
                window in deep winter, so start earlier than instinct says and
                turn around sooner than you want to. An unfamiliar section, in
                fading light, on ice, a few feet from open water is the one
                avoidable mistake on this page.
              </p>
              <p>
                The etiquette doesn't change with the season. It's a public
                path through private front yards year-round — stay on it, keep
                your voice down, and don't wander onto lawns or piers because
                snow has blurred where one ends and the other begins.
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
                or snowy-day options.{" "}
                <Link to="/guides/yerkes-observatory" className={LINK}>
                  Yerkes Observatory
                </Link>{" "}
                in Williams Bay runs winter tours.
              </p>
              <p>
                Two honest caveats. Every one of those runs on a schedule set
                by the venue, and winter schedules are the ones most likely to
                differ from whatever a website last said — confirm directly, in
                the week you're going. And there are a handful of indoor
                attractions here, not a city's worth: a trip built entirely on
                indoor backup runs out of building somewhere on the second day.
              </p>
              <p>
                Which matters less than it sounds, because the real indoor
                program in a lake town in February isn't attractions at all.
                It's long meals, a spa afternoon, and a downtown small enough
                to give you a short walk outside and then a door to go
                through.
              </p>
            </>
          ),
        },
        {
          id: "trips",
          heading: "Romantic and small-group trips, and why winter books easier",
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
              <p>
                The reason it works is the supply-and-demand point from
                earlier, running the other direction. The rooms, the spa
                appointments and the good tables all still exist in February;
                the crowd competing for them doesn't. So what reliably improves
                in winter is <em>availability</em> — a Saturday reservation
                that would have needed planning in July, a table by a window.
                Note the word. What a room or a package costs on a given
                weekend is set by the operator and moves with the calendar, and
                this page isn't going to guess at it. Ask the property what
                they're running.
              </p>
              <p>
                Who this suits: couples, small groups of adults, anyone whose
                idea of a good weekend is unhurried, and anyone who tried to
                book here in summer and gave up. Who it doesn't: a group that
                wants the on-the-water program, a crowd, or a guaranteed
                activity schedule. Those people should read the{" "}
                <Link to="/guides/best-things-to-do-lake-geneva-in-summer" className={LINK}>
                  summer guide
                </Link>{" "}
                and come back in July — that's a real answer, not a deflection.
                The{" "}
                <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                  where-to-stay guide
                </Link>{" "}
                covers lodging in more depth; note that which end of the lake
                you base on matters differently in winter, because you'll be
                driving to dinner rather than walking to a beach.
              </p>
            </>
          ),
        },
        {
          id: "no-winter",
          heading: "When winter doesn't show up",
          body: (
            <>
              <p>
                Some years the lake doesn't freeze usefully, the snow doesn't
                hold, and the outdoor half of this page quietly becomes
                unavailable. It's the biggest risk in planning a winter trip
                here, and it's worth planning around rather than hoping past.
              </p>
              <p>
                Look back at the five trips. The snow day and the ice trip are
                the two a warm winter takes away outright — no shanties on the
                lake, no tracks in the park, a hill fighting the thermometer.
                The quiet weekend and the indoor anchor are untouched by it. So
                the practical rule is to build on the weather-proof rows and
                let the rest be upside: book the dinner, the room and the
                indoor afternoon, and leave the ski day and the ice day as
                intentions you confirm two days out. Done in that order, the
                weekend is good in any winter. Done in reverse, it's one warm
                front away from a long drive to nothing.
              </p>
            </>
          ),
        },
        {
          id: "not-covered",
          heading: "What this guide deliberately doesn't cover",
          body: (
            <>
              <p>
                Being clear about the edges is more useful than pretending
                there aren't any:
              </p>
              <ul>
                <li>
                  <strong>Prices, hours and this-year dates.</strong> The
                  sources above beat anything that could be printed here.
                </li>
                <li>
                  <strong>Whether the ice is safe.</strong> Not a liability
                  hedge — it genuinely can't be known in advance by anyone,
                  including people who live here.
                </li>
                <li>
                  <strong>Ice-fishing technique and gear.</strong> An outfitter
                  will teach more of that in an afternoon than a guide can in a
                  paragraph.
                </li>
                <li>
                  <strong>Ranking restaurants.</strong> What's open and what's
                  worth the drive changes week to week in winter, which is why{" "}
                  <Link to="/eats" className={LINK}>
                    the dining coverage
                  </Link>{" "}
                  handles it on a weekly cadence instead.
                </li>
                <li>
                  <strong>What winter is like to live through.</strong> Visiting
                  for three days and heating a house here all season are
                  different subjects.{" "}
                  <Link to="/guides/moving-to-lake-geneva" className={LINK}>
                    Moving to Lake Geneva
                  </Link>{" "}
                  and{" "}
                  <Link to="/guides/cost-of-living-lake-geneva" className={LINK}>
                    the cost-of-living guide
                  </Link>{" "}
                  cover that, including the parts that aren't charming.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "plan",
          heading: "Planning a winter weekend here, in order",
          body: (
            <>
              <p>
                The whole page compressed into the sequence that avoids the
                usual mistakes.
              </p>
              <ol>
                <li>
                  <strong>Decide which of the five trips you're on.</strong>{" "}
                  Everything follows from it, including how much the forecast
                  is allowed to matter to you.
                </li>
                <li>
                  <strong>Check the events calendar to choose your weekend,
                  not to fill it.</strong> Championship weekend is either the
                  reason you're coming or the weekend to avoid.
                </li>
                <li>
                  <strong>Book lodging first if it's that weekend, dinner
                  first if it isn't.</strong> The scarce thing in winter is
                  rarely the room.
                </li>
                <li>
                  <strong>Confirm hours with each operator directly, in the
                  week you travel.</strong> Not the month before, and not from
                  a third-party listing.
                </li>
                <li>
                  <strong>Give every day an indoor anchor</strong> — one thing
                  that happens regardless of weather, booked in advance.
                </li>
                <li>
                  <strong>Check conditions last.</strong> Forecast and webcams,
                  a day or two out, when the information is worth something.
                </li>
                <li>
                  <strong>Leave the ice decision for the ground,</strong> and
                  for someone who was out there this week. If it doesn't
                  happen, you've lost nothing — you didn't build the weekend on
                  it.
                </li>
              </ol>
              <p>
                Do it in that order and the trade-off at the heart of a Lake
                Geneva winter works in your favour: you gave up the boats, and
                you got the town.
              </p>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
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
          title: "Best Things to Do in Summer",
          path: "/guides/best-things-to-do-lake-geneva-in-summer",
          blurb: "The other half of the trade — what you give up in winter, and what it costs in crowds.",
        },
        {
          title: "Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The route, the access points, and the easement that keeps it public year-round.",
        },
        {
          title: "Where to Stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb: "Lodging by end of the lake — and why basing decisions change when you're driving to dinner.",
        },
        {
          title: "Big Foot Beach State Park",
          path: "/guides/big-foot-beach-state-park",
          blurb: "The park behind the cross-country trails, and how state park admission works.",
        },
        {
          title: "Yerkes Observatory",
          path: "/guides/yerkes-observatory",
          blurb: "The Williams Bay indoor anchor — worth a winter afternoon on its own.",
        },
        {
          title: "Things to Do With Kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb: "The family version, including the indoor options that carry a cold weekend.",
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
            "Yes — especially during Winterfest and the National Snow-Sculpting Championship in February. The town is quieter, restaurants have space, and the lakefront takes on a different kind of beauty. The honest framing is that winter is a trade rather than a downgrade: you give up the on-the-water program and get much easier access to everything else.",
        },
        {
          question: "Does Geneva Lake freeze over?",
          answer:
            "Most years, yes — usually mid-January through late February or early March. Ice depth and conditions vary year to year, so always check with local bait shops or Facebook groups before walking out. Some winters it never freezes usefully at all, which is why an ice-dependent trip should be the last part of a plan you commit to.",
        },
        {
          question: "Is it safe to walk on the ice on Geneva Lake?",
          answer:
            "No page can tell you that, and this one won't try. This desk is not aware of any agency that inspects a lake and declares it open, so waiting for an official green light is not a plan. Ice on a large lake forms unevenly — springs, inflows, current and any aerator running near a pier leave thin ice beside thick ice with nothing on the surface to mark it, and snow cover both insulates the ice and hides what's underneath. The only useful information is current and local: bait shops, outfitters and people who were out there this week. Treat what they tell you as information, not permission.",
        },
        {
          question: "Where can you ski near Lake Geneva?",
          answer:
            "Mountain Top at the Grand Geneva is the local hill — small, beginner-friendly, with lessons and rentals. Cross-country trails run through Big Foot Beach State Park and several parcels around the lake. It suits first-timers and families who want a half-day rather than an expedition; an experienced skier chasing vertical is better served by the drive north.",
        },
        {
          question: "What's open in Lake Geneva in winter?",
          answer:
            "It varies by business and by year, which is why this guide doesn't publish a list. Places whose revenue is concentrated in a short season adapt differently: some trim to a shorter week, some close for a stretch and reopen, some run normally and are just quiet. Confirm directly with each operator in the week you're travelling — a phone call or a same-week post from the business itself beats a website footer or a third-party listing, both of which tend to be left on last summer's schedule.",
        },
        {
          question: "Can you walk the Lake Geneva Shore Path in winter?",
          answer:
            "Where it's safely walkable, yes, and it's one of the prettier cold-weather walks in the Midwest. With the leaves down the sightlines open up and the summer foot traffic is gone. The path is not maintained for snow, though: the paved downtown stretch is what gets cleared when anything does, and the grass, gravel and stone-step sections don't, so conditions change stretch by stretch. Bring traction, treat it as an out-and-back on a section you can see, plan for the middle of the day, and turn around before the light goes.",
        },
        {
          question: "When is the National Snow-Sculpting Championship in Lake Geneva?",
          answer:
            "It's held in February, with fifteen teams carving full-block sculptures at Riviera Park over several days and public viewing throughout. The exact weekend moves year to year, so check the events calendar rather than a reprinted date. Whichever weekend it lands on is the busiest of the winter — plan to book far ahead if it's your reason for coming, or to avoid it deliberately if you're coming for the quiet.",
        },
        {
          question: "Is Lake Geneva cheaper in winter?",
          answer:
            "Rates are set by each property and move with the calendar, so this guide doesn't quote them. What is reliably different in winter is availability rather than price: the same rooms, spa appointments and good tables exist in February, with a fraction of the crowd competing for them. Championship weekend is the exception, when a summer-sized demand meets the same fixed supply. Ask a property directly what they're running for your dates.",
        },
        {
          question: "What is there to do in Lake Geneva in winter if there's no snow?",
          answer:
            "Most of it, as it happens. The resort dining rooms, supper clubs and tap rooms, the spas, Tristan Crist Magic Theatre, the Geneva Lake Museum, Yerkes Observatory tours in Williams Bay and a walkable downtown are all indifferent to the forecast. Skiing, sledding and anything on the ice are the parts a green winter takes away — which is the argument for building a trip on the weather-proof things and treating snow as upside.",
        },
        {
          question: "Do you need a state park sticker for cross-country skiing near Lake Geneva?",
          answer:
            "Wisconsin state parks are entered on a vehicle admission sticker rather than a per-person ticket, and trail use can carry its own conditions on top of that. What applies on a given winter day, and what it costs, is a Wisconsin DNR question — check with the DNR or the park rather than assuming a sticker covers everything. This guide doesn't print the figures.",
        },
        {
          question: "Is Lake Geneva good for a winter weekend with kids?",
          answer:
            "It works well if the plan has an indoor anchor each day. Mountain Top is genuinely beginner-friendly, the Winterfest sledding hill on the lakefront is a reliable draw during the festival, and the museum, magic theatre and observatory carry a cold afternoon. What doesn't work is a weekend built entirely on snow, since conditions can't be promised months ahead.",
        },
        {
          question: "What should you pack for a winter trip to Lake Geneva?",
          answer:
            "Traction devices for boots matter more than the boots themselves — snow over ice is the normal winter surface on the shore path, which isn't maintained for snow, and on sidewalks. Beyond that: layers you can shed indoors, since a winter day here alternates between a short spell outside and a warm room, and enough margin that a short daylight window doesn't turn a walk into a problem.",
        },
      ]}
    />
  );
}
