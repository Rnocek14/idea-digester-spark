import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const PUBLISHED = "2026-06-11";
const UPDATED = "2026-07-29";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * SEO play: capture the long-tail question keywords that have near-zero KD
 * but real volume (how far, how deep, how big, swim, worth visiting, etc).
 * One page, one FAQPage schema, many question-targeted answers.
 *
 * House rule for this page: no prices, admission fees, room rates, operating
 * hours or event dates. Operators set those and change them. Where a cost or
 * a schedule decides someone's plan, name the source instead of reprinting a
 * number that goes stale. The prose sections stay deliberately short — the
 * depth on this page belongs in the FAQ array, which is what ranks.
 */
export default function LakeGenevaFAQ() {
  return (
    <GuideShell
      title="Lake Geneva, Wisconsin: Everything You're Wondering"
      metaTitle="Lake Geneva WI FAQ — Distance, Depth, Swimming & Visiting"
      metaDescription="Straight local answers about Lake Geneva, Wisconsin: distance from Chicago and Milwaukee, how deep and how big the lake is, swimming, parking, where to eat and stay, and when to come."
      path="/guides/lake-geneva-faq"
      datePublished={PUBLISHED}
      dateModified={UPDATED}
      intro={
        <>
          <p>
            People ask the same handful of questions about Lake Geneva before
            they ever set foot here — how far is it from Chicago, can you swim
            in it, is it actually worth the drive. This page answers them
            straight, from people who live here. No fluff, no SEO filler.
          </p>
          <p>
            What you won't find: prices, fees, room rates or operating hours.
            Operators set those and revise them, and a stale figure published
            confidently is worse than none. Where a cost or a schedule decides
            your plan, this page names who owns the current answer.
          </p>
          <p>
            If you want what's happening <em>today</em> — events, road
            closures, what's open — check the homepage. If you're planning a
            visit or a move, start here.
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
              <strong className="text-slate-900">The lake and the town have different names.</strong>{" "}
              The water is Geneva Lake; the city on its north shore is Lake
              Geneva. The difference only bites when you're searching for an
              address.
            </li>
            <li>
              <strong className="text-slate-900">You will need a car.</strong>{" "}
              No train, no commercial airport, patchy weekend rideshare.
              Everything below assumes you're driving.
            </li>
            <li>
              <strong className="text-slate-900">The season decides the trip.</strong>{" "}
              Summer is the full version of the place and charges you in
              traffic and parking. Fall is the same lake at rest. Winter is a
              different trip, not a lesser one.
            </li>
          </ul>
        </div>
      }
      sections={[
        {
          id: "getting-here",
          heading: "Getting here",
          body: (
            <>
              <p>
                Lake Geneva sits in the southeast corner of Wisconsin,
                roughly equidistant from Chicago and Milwaukee. Most visitors
                arrive by car — there's no train, no commercial airport, and
                rideshare is patchy on weekends. Plan on driving.
              </p>
              <ul>
                <li><strong>From Chicago:</strong> ~80 miles, 1 hr 30 min via I-94 W and US-12 W. Add 30+ minutes on summer Friday afternoons.</li>
                <li><strong>From Milwaukee:</strong> ~50 miles, 50–70 minutes via I-43 S depending on your downtown destination.</li>
                <li><strong>From Madison:</strong> ~75 miles, 1 hr 20 min via US-12 E.</li>
                <li><strong>From the Wisconsin Dells:</strong> ~115 miles, about 2 hours.</li>
                <li><strong>From Rockford, IL:</strong> ~50 miles, 1 hour.</li>
              </ul>
              <p>
                All five are free-flowing car times, not promises. The summer
                Friday penalty is directional traffic — one metro heading
                toward the same lakes on the same afternoon. Note too that
                US-12 is the final leg from two
                directions, which makes it the road worth checking for
                construction whichever way you come.
              </p>
              <p>
                Flying in means landing at an airport serving Chicago or
                Milwaukee and driving the rest. The mileages above are to the
                city centers, not to the airports, so check the actual
                airport-to-lake drive before you pick one. Either way, don't
                build an evening around summoning a ride
                late at night — the coverage a metro has isn't the coverage out
                here.
              </p>
            </>
          ),
        },
        {
          id: "the-lake",
          heading: "The lake itself",
          body: (
            <>
              <p>
                Locals call it <strong>Geneva Lake</strong>; the town is
                Lake Geneva. The lake is spring-fed, glacially carved, and
                surprisingly cold even in August.
              </p>
              <ul>
                <li>
                  <strong>Size:</strong> about 5,260 acres per the Wisconsin
                  DNR (roughly 8.2 square miles). You'll also see 5,400 cited
                  locally — we point at the DNR because it's the source of
                  record.
                </li>
                <li><strong>Length:</strong> 7.6 miles end to end</li>
                <li><strong>Max depth:</strong> 135 feet</li>
                <li><strong>Average depth:</strong> ~62 feet</li>
                <li><strong>Shoreline:</strong> 21 miles, almost entirely walkable via the public Shore Path</li>
                <li><strong>Water clarity:</strong> typically 15–25 feet of visibility</li>
              </ul>
              <p>
                <strong>Why those numbers hang together.</strong> A glacially
                carved basin is gouged rather than pooled, so it comes out
                steep-sided and deep for its surface area. That one fact
                explains most of what surprises visitors: a lake averaging
                around 62 feet holds more cold water than a summer of sun can
                warm, and deep lakes stratify — a warm surface layer over much
                colder water. Hence the shock of the first swim in August, and
                clarity that looks nothing like a shallow pond.
              </p>
              <p>
                Depth, acreage and shoreline are fixed. Temperature and clarity
                are not. For what the water is doing today, use the{" "}
                <Link to="/lake-geneva-weather" className={LINK}>
                  weather page
                </Link>{" "}
                and the{" "}
                <Link to="/lake-geneva-webcams" className={LINK}>
                  lake webcams
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "swimming-and-water",
          heading: "Swimming, beaches, and getting on the water",
          body: (
            <>
              <p>
                Yes, you can swim in it. Public beaches include Riviera Beach
                downtown, Williams Bay Beach, and Fontana Beach. Water
                temperatures peak around 75–80°F in late July and early August.
              </p>
              <p>
                <strong>Walkable is not swimmable.</strong> Nearly the whole
                21-mile shoreline can be walked via the public Shore Path,
                which leads visitors to assume all of it is theirs to swim
                from. It isn't. Swim where a beach is posted public; the{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  Shore Path guide
                </Link>{" "}
                explains why a public path can run in front of shoreline that
                isn't.
              </p>
              <p>
                Beach fees and hours are set village by village and change
                seasonally, which is why they live in the{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                  public access guide
                </Link>{" "}
                rather than here.{" "}
                <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                  Big Foot Beach State Park
                </Link>{" "}
                works differently again: as a Wisconsin state park it runs on a
                vehicle admission sticker rather than a per-person charge, so
                the math favors a full car. And you don't need to own a boat to
                get out on the water — the{" "}
                <Link to="/guides/things-to-do-lake-geneva" className={LINK}>
                  things-to-do guide
                </Link>{" "}
                covers the ways.
              </p>
            </>
          ),
        },
        {
          id: "is-it-worth-it",
          heading: "Is it actually worth visiting?",
          body: (
            <>
              <p>
                Honest answer: yes, but match your expectations to the season.
              </p>
              <ul>
                <li><strong>Summer (June–August):</strong> peak everything — boats, festivals, restaurant waits, traffic. Stunning, but busy. Book lodging weeks ahead.</li>
                <li><strong>Fall (September–October):</strong> the local favorite. Warm days, no crowds, fall colors on the Shore Path, restaurants without a line.</li>
                <li><strong>Winter (December–February):</strong> quiet and cold. Winterfest in early February is genuinely worth a trip if you like ice sculpture.</li>
                <li><strong>Spring (April–May):</strong> shoulder season. Things are opening up; the lake's still cold.</li>
              </ul>
              <p>
                The real question is "worth it compared to what." Against a
                city weekend this is not a fair fight — it's a small lake town,
                so calibrate if you want a dense restaurant scene or late{" "}
                <Link to="/nightlife" className={LINK}>
                  nightlife
                </Link>
                . Against a day spent not leaving the metro, it's an easy yes.
              </p>
              <p>
                <strong>How long you need</strong> follows from that. A day:
                downtown plus a Shore Path walk is plenty. A weekend adds time
                on the water and one thing inland. Past two nights you're
                visiting the other lake communities — a slower trip. The{" "}
                <Link to="/guides/things-to-do-lake-geneva-this-weekend" className={LINK}>
                  weekend shortlist
                </Link>
                ,{" "}
                <Link to="/guides/things-to-do-lake-geneva-with-kids" className={LINK}>
                  family guide
                </Link>{" "}
                and{" "}
                <Link to="/guides/things-to-do-lake-geneva-in-winter" className={LINK}>
                  winter guide
                </Link>{" "}
                sort the same list different ways. One caution: annual festival
                dates are set by their organizers and shift, so book against
                the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>{" "}
                rather than against a guide.
              </p>
            </>
          ),
        },
        {
          id: "eat-stay",
          heading: "Eating and sleeping",
          body: (
            <>
              <p>
                Downtown classics include Next Door Pub, Egg Harbor Cafe for
                breakfast, and Sopra for a nicer dinner. Pier 290 in Williams
                Bay is the lakeside view spot, and a Friday fish fry is a
                Wisconsin tradition worth doing at least once — see the{" "}
                <Link to="/eats/fish-fry" className={LINK}>
                  fish fry guide
                </Link>
                , the{" "}
                <Link to="/eats" className={LINK}>
                  eats section
                </Link>{" "}
                and the{" "}
                <Link to="/best-of/restaurants-lake-geneva" className={LINK}>
                  restaurants roundup
                </Link>
                . Hours and prices are the restaurants' to change, so call
                ahead on a summer weekend.
              </p>
              <p>
                Lodging splits along one trade-off. Grand Geneva Resort and The
                Abbey Resort put amenities on site and generally put a car
                between you and downtown; a downtown inn or B&amp;B puts dinner and the
                lakefront on foot and gives you less on the property. Ask
                whether the resort or the lake is meant to be the destination,
                then read the{" "}
                <Link to="/guides/where-to-stay-lake-geneva" className={LINK}>
                  where-to-stay guide
                </Link>
                . Book weeks ahead for summer weekends: the room count around
                this lake doesn't change with the season, and demand does.
              </p>
            </>
          ),
        },
        {
          id: "logistics",
          heading: "Practical logistics",
          body: (
            <>
              <p>
                A few things people wish they'd known:
              </p>
              <ul>
                <li><strong>Parking downtown</strong> fills up by 11am on summer Saturdays. The Library Park lot is closest to the water; the lot behind Next Door Pub usually has space longer.</li>
                <li><strong>Cell service</strong> is solid in town, spotty out at the public estates on the south shore.</li>
                <li><strong>Cash is rarely needed</strong> — even farmers' market vendors take cards.</li>
                <li><strong>Walworth County, Wisconsin</strong> — that's the county for any official paperwork.</li>
                <li><strong>Central Time Zone</strong> (CT/CDT) — same as Chicago.</li>
              </ul>
              <p>
                The parking pattern is the obvious one: the closer a lot sits
                to the water, the sooner it goes. On a busy day, stop circling
                and park a few blocks back. The coverage gap has an equally
                practical consequence — download directions and confirmations
                before you leave the car.
              </p>
              <p>
                One structural note worth carrying into every other answer
                here: the county handles official records, but the rules that
                shape a visit — beach access, parking, lakefront ordinances —
                are set by each city or village individually. That's why two
                beaches on the same lake can run under different rules, and why
                a blanket answer about "Lake Geneva" fees is rarely right for
                every shoreline town at once.
              </p>
            </>
          ),
        },
        {
          id: "what-this-doesnt-cover",
          heading: "What this page deliberately doesn't answer",
          body: (
            <>
              <p>
                Prices and room rates are left out because operators revise
                them whenever they like. Hours are worse: a stale listing sends
                someone on an eighty-mile drive to a locked door. Event dates
                live in the{" "}
                <Link to="/events" className={LINK}>
                  events calendar
                </Link>
                , which is maintained, rather than in evergreen prose, which
                isn't. And there are no "best" or "number one" claims here
                unless we can point at who did the voting.
              </p>
              <p>
                Instead the page names the source that owns each answer: the{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                  public access guide
                </Link>{" "}
                for beaches and launches, the{" "}
                <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                  state park guide
                </Link>{" "}
                for the park, the Wisconsin DNR for fishing rules, and the
                business itself for hours.
              </p>
              <p>
                It also stops at the visitor's edge. If you're working out
                whether you could live here, the questions change entirely —
                the tax rate on a specific parcel, which district a street sits
                in, what a winter commute costs in hours. Those have their own
                guides: the{" "}
                <Link to="/guides/moving-to-lake-geneva" className={LINK}>
                  relocation guide
                </Link>
                , the{" "}
                <Link to="/guides/cost-of-living-lake-geneva" className={LINK}>
                  cost of living guide
                </Link>
                , the{" "}
                <Link to="/guides/lake-geneva-schools" className={LINK}>
                  schools guide
                </Link>{" "}
                and the{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className={LINK}>
                  neighborhood guide
                </Link>
                .
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "How far is Lake Geneva, Wisconsin from Chicago?",
          answer:
            "About 80 miles, or a 1 hour 30 minute drive via I-94 West and US-12 West. Add 30 minutes or more on summer Friday afternoons — that's directional traffic. Treat the figure as a free-flowing estimate, not a promise.",
        },
        {
          question: "How far is Lake Geneva from Milwaukee?",
          answer:
            "About 50 miles, generally 50 to 70 minutes by car via I-43 South depending on where in downtown you're headed. It's the closest big city to Lake Geneva.",
        },
        {
          question: "How far is Lake Geneva from Madison, Wisconsin?",
          answer:
            "About 75 miles, or a 1 hour 20 minute drive via US-12 East. US-12 is also the final leg of the Chicago approach from the other direction, which makes it the one road worth checking for construction whichever way you're coming.",
        },
        {
          question: "How far is Lake Geneva from the Wisconsin Dells?",
          answer:
            "About 115 miles, or roughly 2 hours by car. They are not close — they sit at opposite ends of the state's tourism map, and pairing them in a weekend puts a two-hour drive in the middle of it. Better understood as two trips than as two stops on one.",
        },
        {
          question: "Is there a train from Chicago to Lake Geneva?",
          answer:
            "No. There's no rail service, no commercial airport, and rideshare is patchy on weekends, so arriving without a car takes arranging in advance. Downtown itself is walkable once you're here, so the problem is the first and last mile, not the middle.",
        },
        {
          question: "What airport do you fly into for Lake Geneva, Wisconsin?",
          answer:
            "There's no commercial airport in Lake Geneva, so flying means landing at an airport serving Chicago or Milwaukee and driving in. The mileages elsewhere on this page are measured to the city centers rather than to the airports, so check the actual airport-to-lake drive before you pick one.",
        },
        {
          question: "How deep is Lake Geneva, Wisconsin?",
          answer:
            "Geneva Lake has a maximum depth of 135 feet and an average depth of about 62 feet, making it one of the deepest natural lakes in southern Wisconsin. It's a glacially carved basin — gouged rather than pooled — which is why it came out steep-sided and deep for its surface area. That depth is also why it stays cold.",
        },
        {
          question: "How big is Lake Geneva, Wisconsin?",
          answer:
            "The lake covers about 5,260 acres — roughly 8.2 square miles — measures 7.6 miles end to end, and has a 21-mile shoreline almost entirely walkable via the public Shore Path. The shoreline runs longer than the length because the lake is bayed rather than straight-sided, and it's the more useful of the two figures for planning. You'll see 5,400 acres cited in a lot of local material; the Wisconsin DNR's figure is the lower one, and that's the one we use.",
        },
        {
          question: "How many acres is Lake Geneva?",
          answer:
            "The Wisconsin DNR puts Geneva Lake at about 5,260 acres, or roughly 8.2 square miles; 5,400 is widely repeated locally and is the figure you'll meet most often. For scale, the lake runs 7.6 miles end to end — one you can see across, but not one you'd cross casually.",
        },
        {
          question: "Why is Lake Geneva so clear?",
          answer:
            "Visibility typically runs 15 to 25 feet, which surprises people expecting a murky Midwestern lake. That's consistent with what it is: a deep, cold, spring-fed glacial basin rather than a shallow warm one. Clarity moves with the season and recent weather, so read the range as typical rather than promised.",
        },
        {
          question: "Is Lake Geneva a natural lake or man-made?",
          answer:
            "Natural. Geneva Lake is a glacially carved, spring-fed basin with a maximum depth of 135 feet — none of which is characteristic of an impoundment.",
        },
        {
          question: "Why is Lake Geneva so cold in the summer?",
          answer:
            "Depth. With a 135-foot maximum and an average around 62 feet, the lake holds more cold water than one summer of sun can warm, and deep lakes stratify — a warm surface layer over much colder water below. Surface temperatures peak around 75–80°F in late July and early August; a few feet down is another matter.",
        },
        {
          question: "Can you swim in Lake Geneva, Wisconsin?",
          answer:
            "Yes. Public beaches include Riviera Beach in downtown Lake Geneva, Williams Bay Beach, and Fontana Beach, and peak water temperatures hit around 75–80°F in late July and early August. Swim at posted public beaches — nearly the whole shoreline is walkable via the Shore Path, but walkable and swimmable are not the same thing here.",
        },
        {
          question: "Can you walk around Lake Geneva?",
          answer:
            "Yes — the 21-mile shoreline is almost entirely walkable via the public Shore Path, which is unusual for a lake ringed by private homes. Very few people do the full loop in one go; most walk a section between two public access points. Our Shore Path guide covers leg distances, parking and etiquette.",
        },
        {
          question: "Does Geneva Lake freeze in the winter?",
          answer:
            "Ice conditions vary year to year, and no evergreen page can tell you what the lake looks like on the day you're reading it. Winter here is genuinely cold and quiet, but whether there's safe ice on a given weekend is a current-conditions question. Check the weather page and the lake webcams first.",
        },
        {
          question: "Can you fish in Geneva Lake?",
          answer:
            "Fishing is regulated by the State of Wisconsin rather than by the lake or the town — meaning a Wisconsin fishing license plus season, size and bag rules set by the Department of Natural Resources. Those change, so pull current regulations from the WDNR rather than from any guide, this one included.",
        },
        {
          question: "Is Geneva Lake the same as Lake Geneva?",
          answer:
            "The lake itself is technically named Geneva Lake; the city on its north shore is Lake Geneva. Locals use both, and the distinction mostly matters when you're searching for an address or a business name. Don't confuse it with Geneva-on-the-Lake in Ohio, or with Lake Geneva in Switzerland.",
        },
        {
          question: "What county is Lake Geneva, Wisconsin in?",
          answer:
            "Walworth County, in the southeast corner of Wisconsin. The county handles official records, while the rules that shape a visit — beach access, parking, lakefront ordinances — are set by each city or village individually. That's why two beaches on the same lake can run under different rules.",
        },
        {
          question: "What time zone is Lake Geneva in?",
          answer:
            "Central Time (CT/CDT), the same as Chicago, Milwaukee and Madison. Nobody driving in from those metros changes their clock, so it only matters if you're booking from a different zone.",
        },
        {
          question: "Is Lake Geneva, Wisconsin worth visiting?",
          answer:
            "Yes, especially in fall (September–October) when the weather is warm, crowds thin out, and restaurants don't have waits. Summer is the busy season — beautiful, but expect traffic and full parking lots. The honest caveat: this is a small lake town rather than a city, so calibrate if you're after a dense restaurant or nightlife scene.",
        },
        {
          question: "When is the best time to visit Lake Geneva?",
          answer:
            "Locals favor September and early October — warm days, fall colors on the Shore Path, no summer crowds. Peak season is June through August. Winterfest in early February is a real draw for ice-sculpture fans, but annual event dates are set by their organizers and move, so confirm against the events calendar before booking around one.",
        },
        {
          question: "How many days do you need in Lake Geneva?",
          answer:
            "One day covers the essentials — downtown plus a Shore Path walk is plenty. A weekend adds time on the water and one thing inland without rushing, and it's the trip the town is best set up for. Past two nights you're really visiting the other lake communities, which is a slower and less downtown-centred trip.",
        },
        {
          question: "Is Lake Geneva a good day trip from Chicago?",
          answer:
            "It works well as one: about 80 miles and 1 hour 30 minutes each way leaves a real day at the lake rather than a drive with lunch in the middle. What breaks a day trip is summer Saturday parking rather than the distance, so start early.",
        },
        {
          question: "Where should I park in downtown Lake Geneva?",
          answer:
            "Downtown parking fills up by 11am on summer Saturdays. The Library Park lot is closest to the water; the lot behind Next Door Pub usually has space longer. The pattern is the obvious one — the closer a lot sits to the lake, the sooner it goes — so on a busy day, park a few blocks back and walk instead of circling.",
        },
        {
          question: "Where should I eat in Lake Geneva, Wisconsin?",
          answer:
            "Downtown classics include Next Door Pub, Egg Harbor Cafe for breakfast, and Sopra for a nicer dinner. Pier 290 in Williams Bay is the lakeside view spot, and a Friday fish fry is a Wisconsin tradition worth doing at least once. Hours and prices belong to the restaurants and change seasonally, so call ahead on a summer weekend.",
        },
        {
          question: "Where should I stay in Lake Geneva?",
          answer:
            "Grand Geneva Resort and The Abbey Resort are the two destination resorts: amenities on site, and a car between you and downtown. Downtown inns and B&Bs put restaurants and the lakefront within walking distance and give you less on the property itself. Book several weeks ahead for summer weekends — the room count doesn't change with the season, and demand does.",
        },
        {
          question: "Is Lake Geneva good for kids?",
          answer:
            "The ingredients are there — public beaches, the lake itself, and short stretches of the Shore Path that suit small legs. The constraint is the one adults hit too: summer weekends are crowded and parking is the hard part, so an early start matters more with a family than without. We keep a separate guide for visiting with kids.",
        },
        {
          question: "Is Lake Geneva expensive to visit?",
          answer:
            "This page deliberately doesn't print prices, fees or room rates — the businesses, villages and parks that set them change them, and a stale figure is worse than none. What's fair to say is that the range is wide: a Shore Path walk and a picnic costs nothing, and a resort weekend in peak season is a different budget entirely.",
        },
        {
          question: "What's the difference between Lake Geneva, Williams Bay and Fontana?",
          answer:
            "They're separate communities on the same lake, each with its own public beach. Lake Geneva is the one with the downtown that most of this page describes; Williams Bay and Fontana sit further around the shoreline. For a visit the difference is mainly which beach and restaurants you're near — for a move it's a much bigger question, and we keep town-by-town comparisons for that.",
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
          blurb: "A local's guide to what's actually worth your weekend.",
        },
        {
          title: "The Geneva Lake Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The 21-mile public path that loops the entire lake.",
        },
        {
          title: "Lake Geneva Public Access Guide",
          path: "/guides/lake-geneva-public-access-guide",
          blurb: "Beaches, boat launches, and the parking locals use.",
        },
        {
          title: "Where to Stay in Lake Geneva",
          path: "/guides/where-to-stay-lake-geneva",
          blurb: "Resorts, downtown inns, rentals — and who each suits.",
        },
        {
          title: "Big Foot Beach State Park",
          path: "/guides/big-foot-beach-state-park",
          blurb: "The southeast-shore state park, and how the sticker works.",
        },
        {
          title: "Yerkes Observatory",
          path: "/guides/yerkes-observatory",
          blurb: "The Williams Bay landmark that isn't about the lake.",
        },
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "What it's actually like to live here year-round.",
        },
        {
          title: "Cost of Living in Lake Geneva",
          path: "/guides/cost-of-living-lake-geneva",
          blurb: "The money side of a move, including what the lake adds.",
        },
      ]}
    />
  );
}
