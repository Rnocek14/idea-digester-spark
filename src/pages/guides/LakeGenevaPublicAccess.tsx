import { Link } from "react-router-dom";

import { GuideShell } from "@/components/guides/GuideShell";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * The five categories of lake access, side by side. Every cell compresses a
 * sentence written elsewhere on this page — no fees, no hours, no new claims.
 */
const ACCESS_TYPES: {
  kind: string;
  permits: string;
  doesNot: string;
  owner: string;
}[] = [
  {
    kind: "Municipal public beach",
    permits: "Swim in the posted swim area, use the sand and the park behind it",
    doesNot: "Launch a trailered boat, moor one, or cut through onto the private frontage either side",
    owner: "The city or village that owns it — which is why residency changes what you pay",
  },
  {
    kind: "Municipal boat launch",
    permits: "Put a boat in from a public ramp, with that municipality's permit",
    doesNot: "Guarantee a trailer space, a slip, a mooring, or anywhere to swim afterward",
    owner: "The same city, village or township — plus the state for the boat itself",
  },
  {
    kind: "Shore Path easement",
    permits: "Walk past private lakefront property, on foot, single file where it narrows",
    doesNot: "Stop on lawns, use piers, swim from the frontage, or bring anything wheeled",
    owner: "The landowners it crosses, under a long-standing arrangement. Nobody sells tickets",
  },
  {
    kind: "State park",
    permits: "Whatever the park's rules allow — beach, trails, picnic areas, camping",
    doesNot: "Waive the vehicle sticker because you are only parking, or only walking through",
    owner: "The State of Wisconsin, not the City of Lake Geneva",
  },
  {
    kind: "Private, public welcome",
    permits: "Use a resort beach, restaurant pier, marina or tour-boat dock as a customer or guest",
    doesNot: "Give you any right to be there — this is permission, and the operator sets the terms",
    owner: "The business",
  },
];

/** The decision framework. Each row resolves to one of the five categories. */
const SCENARIOS: { plan: string; go: string; why: string }[] = [
  {
    plan: "Swimming, with or without kids",
    go: "A municipal beach, or Big Foot Beach State Park",
    why: "The only places here where getting in the water is the intended use.",
  },
  {
    plan: "Putting your own boat in",
    go: "A public launch, permit bought ahead",
    why: "Four launches, four issuing offices — and trailer parking is what limits your Saturday.",
  },
  {
    plan: "A long walk with the lake beside you",
    go: "The Shore Path, joined at any public access point with parking",
    why: "The walk is free. What it costs is a parking space, so plan that first.",
  },
  {
    plan: "A picnic and a sunset",
    go: "Fontana Beach and Reid Park, west end",
    why: "A park behind the sand, and the sunset views this page has always sent people west for.",
  },
  {
    plan: "A quiet day out of the crowd",
    go: "Big Foot Beach State Park",
    why: "Trails and quieter shoreline, gated by a vehicle sticker rather than a per-person charge.",
  },
  {
    plan: "On the water without owning a boat",
    go: "A commercial operator, or a hand-carried kayak or paddleboard",
    why: "Tours, rentals and resort piers are access you buy rather than access you hold.",
  },
];

export default function LakeGenevaPublicAccess() {
  return (
    <GuideShell
      title="Lake Geneva Public Beaches & Boat Launches: A Local's Access Guide"
      metaTitle="Lake Geneva Public Beaches & Boat Launches Guide"
      metaDescription="Every public beach and boat launch on Geneva Lake — Riviera, Williams Bay, Fontana, Big Foot Beach and Linn Pier — plus what each kind of access actually permits, and why the Shore Path is not a public shoreline."
      path="/guides/lake-geneva-public-access-guide"
      datePublished="2026-06-09"
      dateModified="2026-07-29"
      intro={
        <>
          <p>
            Most of Geneva Lake's 21-mile shoreline is private — but the public access points
            that exist are well-loved, walkable, and worth knowing by name. This guide pulls
            together every public beach and every public boat launch on the lake, with the
            practical details locals actually use: where to park, what it costs, and when to
            show up.
          </p>
          <p>
            It also does the part a national travel page can't. "Public access" here means five
            different things with five different sets of rules, and the most misunderstood is the
            Shore Path — a public right to <em>walk across</em> private lakefront, which is not
            the same as the shoreline being public. Confusing those two is an easy way for a
            good day to end in an awkward conversation on somebody's lawn.
          </p>
          <p>
            Fees, staffed seasons and lifeguard schedules are set by whichever city, village,
            township or state agency owns the access point, and they change year to year. This
            page describes the shape of a charge rather than the amount, and the last section
            names the office that holds the current answer.
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
              <strong className="text-slate-900">"Public" means publicly owned — or it doesn't.</strong>{" "}
              A municipal beach, a municipal launch and the state park are public land. The
              Shore Path is private land with a public right of passage across it.
            </li>
            <li>
              <strong className="text-slate-900">The Shore Path lets you walk.</strong> That is
              the whole grant. Not swim, not sunbathe, not tie up a boat, not step onto a lawn.
            </li>
            <li>
              <strong className="text-slate-900">Swim at the designated beaches.</strong> Four
              are named below. Nearly everything between them is somebody's front yard.
            </li>
            <li>
              <strong className="text-slate-900">Every access point has an owner.</strong> Lake
              Geneva, Williams Bay, Fontana, the Town of Linn, the State of Wisconsin. Whoever
              owns it sets the fee, the season and the rules.
            </li>
          </ul>
        </div>
      }
      sections={[
        {
          id: "five-kinds",
          heading: "Five kinds of access, and what each one permits",
          body: (
            <>
              <p>
                The word "public" does a lot of work around this lake and it doesn't mean the
                same thing twice. Sorting the five categories out is most of what a first-time
                visitor needs, because the mistakes people make here are category errors rather
                than deliberate rule-breaking.
              </p>
              <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <caption className="sr-only">
                    Five kinds of Geneva Lake access compared on what each permits, what it does
                    not permit, and who sets the rules.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-300 bg-stone-50 text-left">
                      {[
                        "Kind of access",
                        "What it lets you do",
                        "What it does not",
                        "Who sets the rules",
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
                    {ACCESS_TYPES.map((row) => (
                      <tr
                        key={row.kind}
                        className="border-b border-slate-200 align-top last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left font-semibold text-slate-900"
                        >
                          {row.kind}
                        </th>
                        <td className="px-3 py-3 text-slate-700">{row.permits}</td>
                        <td className="px-3 py-3 text-slate-700">{row.doesNot}</td>
                        <td className="px-3 py-3 text-slate-700">{row.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Every cell restates something stated elsewhere on this page. Nothing here is a
                quoted price or a posted hour.
              </p>
              <p>
                There are five categories rather than one because nobody owns a lakeshore. Every
                foot belongs to somebody — a municipality, the state, a business, a household —
                and the rules attach to the owner rather than to the water. That's why "is Geneva
                Lake public?" has no useful answer while "who owns this spot?" always does. Note
                how much work the fifth category does in summer: a resort beach or a boat tour is
                comfortable, staffed and reliable, and it ends when the transaction does.
              </p>
            </>
          ),
        },
        {
          id: "which-access",
          heading: "Which kind of access do you actually need?",
          body: (
            <>
              <p className="mb-4">
                Almost every question this page gets is one of six plans wearing different
                clothes. Settle which one you're on before you drive over — it decides where you
                park, what you buy, and how early you leave the house.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {SCENARIOS.map((s) => (
                  <div
                    key={s.plan}
                    className="rounded-sm border border-slate-200 bg-white p-4"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
                      If you're planning
                    </p>
                    <p className="font-semibold text-slate-900 leading-snug">{s.plan}</p>
                    <p className="text-sm text-slate-900 mt-2 leading-snug">
                      <span className="text-slate-500">Go to: </span>
                      {s.go}
                    </p>
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">{s.why}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                Notice what isn't on that list: "go down to the lake." There is no generic
                lakefront here to go down to. Each of those six resolves to a named place with a
                named owner, and the plans that don't — a swim off the Shore Path, a kayak left on
                a promising strip of grass — are the ones that turn into problems.
              </p>
            </>
          ),
        },
        {
          id: "shore-path-easement",
          heading: "The Shore Path is a right to walk, not a public shoreline",
          body: (
            <>
              <p>
                Read this before the rest. The Shore Path is not public shoreline. It is a public
                right of passage across shoreline that belongs to private households, stitched end
                to end around a lake with 21 miles of shoreline — which sounds like a technicality
                and isn't, because
                it decides what you may do at every point along it.
              </p>
              <h3>What an easement actually is</h3>
              <p>
                An easement is a right to make one particular use of land somebody else owns, and
                the consequence follows directly: the grant names a use, and uses it doesn't name
                aren't implied by it. A right to walk across a strip of lawn is not a right to
                stand on the lawn, swim from the frontage in front of it, tie a boat to the pier
                at the end of it, or bring anything on wheels. The owner still owns the ground,
                the frontage, the pier and the beach. What they don't have is the right to stop
                you walking through.
              </p>
              <p>
                In practice: stay on the path, don't step onto lawns or piers, don't swim from the
                frontage, walking only, leash the dog, keep your voice down. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className={LINK}>
                  full Shore Path guide
                </Link>{" "}
                covers the walk itself — leg distances, access points and which section suits which
                walker.
              </p>
              <h3>Where the arrangement comes from</h3>
              <p>
                The account handed down around the lake is that it dates to the 1870s, when the
                railroad first brought Chicago families up to summer here and the landowners
                agreed — informally, then formally — that a continuous footpath would stay open in
                front of their properties. That is the traditional telling as the shoreline
                communities repeat it; this desk has not reproduced a deed, plat or court record
                for it here, so read it as the local account rather than a citation.
              </p>
              <h3>The mistake it produces</h3>
              <p>
                The error is predictable. A walker reasons that if the path is public then the
                shoreline is public, so the water at the end of it is fair game — a quick swim, a
                spot on the grass, somewhere to leave a kayak. None of that follows: the public
                right runs <em>along</em> the shore, not <em>down to</em> it. The etiquette is also
                stricter here than on an ordinary trail for a structural reason. A public park
                absorbs bad behavior institutionally; an easement across dozens of private
                properties has no such buffer, and it is the only access on this page whose
                survival depends on how visitors behave.
              </p>
              <h3>What this section deliberately doesn't do</h3>
              <p>
                It doesn't say where the property line sits between land and water at any address
                — that's parcel-specific, and a question for the municipality or a title
                professional. And it isn't legal advice; it's the working rule locals operate by.
              </p>
            </>
          ),
        },
        {
          id: "riviera-beach",
          heading: "Riviera Beach (Lake Geneva)",
          body: (
            <>
              <p>
                The Riviera Beach sits right downtown next to the historic Riviera Ballroom and
                the public pier. Sand, lifeguards in season, restrooms, concessions, and the
                shortest walk from downtown shops and restaurants of any beach on the lake.
              </p>
              <ul>
                <li><strong>Address:</strong> 300 Wrigley Drive, Lake Geneva, WI</li>
                <li><strong>Season:</strong> Roughly Memorial Day through Labor Day for lifeguards and fees.</li>
                <li><strong>Daily fee:</strong> Modest per-person fee in season; kids under a certain age free. Season passes available at City Hall.</li>
                <li><strong>Parking:</strong> Paid lots and metered street parking along Wrigley Drive — fills early on summer weekends.</li>
                <li><strong>Good for:</strong> Families staying downtown, anyone without a car.</li>
              </ul>
              <p>
                The honest trade-off is the car. A lot of competing demands land on the same few
                blocks — shops, restaurants, the tour-boat pier and the ballroom all draw on the
                same parking — which makes this a superb beach to <em>walk</em> to and a
                frustrating one to drive to on a July Saturday. It's also actively managed in
                season: reassuring if you want somebody watching the water, and, with a
                per-person fee, the one where a large group pays like a large group.
              </p>
            </>
          ),
        },
        {
          id: "williams-bay-edgewater",
          heading: "Edgewater Park & Beach (Williams Bay)",
          body: (
            <>
              <p>
                Williams Bay's Edgewater Park is the laid-back alternative to the Riviera. A
                long, gently sloping public beach, big grass park behind it, free parking, and
                a slower pace. Locals consider it one of the best swimming beaches on the lake.
              </p>
              <ul>
                <li><strong>Address:</strong> Geneva Street & Park Avenue, Williams Bay, WI</li>
                <li><strong>Daily fee:</strong> Free for Williams Bay residents; small fee for non-residents in peak season.</li>
                <li><strong>Parking:</strong> Free street parking; arrive before 11am on weekends.</li>
                <li><strong>Amenities:</strong> Restrooms, picnic shelters, playground, beach volleyball.</li>
                <li><strong>Good for:</strong> Families looking for calm water and shade.</li>
              </ul>
              <p>
                There's a physical reason the water reads as calmer, and it's the same reason the
                village is called Williams Bay: a bay is sheltered from the long run of open water
                that wind needs to build chop, so a breeze that ripples the middle of the lake
                arrives here softened. Add a gradual entry and a park directly behind the sand and
                you have the standing local pick for small children. Who it doesn't suit is anyone
                hoping to fold a beach afternoon into a downtown Lake Geneva day — this is its own
                community on the north shore, with its own hall and its own resident pricing.
              </p>
            </>
          ),
        },
        {
          id: "fontana-beach",
          heading: "Fontana Beach & Reid Park",
          body: (
            <>
              <p>
                Fontana's public beach anchors the west end of the lake. A wide swimming area,
                shaded park, and one of the best sunset views on Geneva Lake. Smaller than the
                Riviera but rarely as crowded.
              </p>
              <ul>
                <li><strong>Address:</strong> 301 Fontana Boulevard, Fontana-on-Geneva Lake, WI</li>
                <li><strong>Daily fee:</strong> Per-person fee in season; Fontana residents free with sticker.</li>
                <li><strong>Parking:</strong> Public lot plus on-street; metered downtown.</li>
                <li><strong>Amenities:</strong> Restrooms, concessions, sand volleyball, adjacent playground.</li>
                <li><strong>Good for:</strong> Sunsets, west-end visitors, families with toddlers.</li>
              </ul>
              <p>
                The beach and Reid Park work as one destination rather than two, which makes it an
                easy place to spend a whole afternoon without a plan. It's also a Shore Path access
                point, so a swim and a lakeside walk can share one parking space. The trade-off is
                distance: Fontana sits at the west end of the lake and downtown Lake Geneva at the
                east, which is why it's rarely as crowded and never a spontaneous choice from the
                east end.
              </p>
            </>
          ),
        },
        {
          id: "big-foot-beach",
          heading: "Big Foot Beach State Park",
          body: (
            <>
              <p>
                Just south of downtown Lake Geneva, Big Foot Beach State Park offers a quieter
                stretch of public shoreline plus hiking trails, picnic areas, and a small
                campground. A state park sticker is required.
              </p>
              <ul>
                <li><strong>Address:</strong> 1550 South Lakeshore Drive, Lake Geneva, WI</li>
                <li><strong>Daily fee:</strong> Wisconsin State Park vehicle admission sticker (daily or annual).</li>
                <li><strong>Amenities:</strong> Trails, picnic shelters, restrooms, camping (reserve ahead).</li>
                <li><strong>Good for:</strong> Walkers, picnickers, anyone who already has a state park sticker.</li>
              </ul>
              <p>
                This access point runs on different arithmetic, and the reason is how state park
                stickers work rather than anything local. A sticker is <em>vehicle</em> admission,
                not a per-person charge, sold as a day pass or an annual one. A carload pays the
                same as a single walker, which inverts the calculation at every municipal beach
                above: hold a Wisconsin annual sticker and this park is effectively pre-paid; buy a
                day sticker only to park for a walk and the sticker is the cost of the outing.
                Because the credential is a state one, village residency buys nothing here — and
                the sticker is required to leave a vehicle regardless of what you came to do,
                including using the park purely as a Shore Path trailhead. The{" "}
                <Link to="/guides/big-foot-beach-state-park" className={LINK}>
                  Big Foot Beach State Park guide
                </Link>{" "}
                covers the campground and the trails behind the beach.
              </p>
            </>
          ),
        },
        {
          id: "boat-launches",
          heading: "Public boat launches on Geneva Lake",
          body: (
            <>
              <p>
                Geneva Lake has a small number of public boat launches, and they fill quickly
                on summer weekends. Most charge a launch fee; trailer parking is the real
                bottleneck. Plan to arrive early, especially on Saturdays.
              </p>
              <p>
                Be clear about what a launch permit buys, because it's narrower than people expect:
                the right to put a boat in from a public ramp. Not a parking permit, not a slip,
                not a mooring, not a day at a beach. Those are separate questions, and one of them
                — where the truck and trailer sit while you're out — decides whether the day works.
              </p>
              <h3>Lake Geneva — Municipal Launch (Wrigley Drive)</h3>
              <ul>
                <li>Downtown launch with paved ramp and limited trailer parking.</li>
                <li>Daily and seasonal permits sold at City Hall (1860 W Main St) or the launch attendant in season.</li>
                <li>Closest to downtown bars, restaurants, and the Riviera pier.</li>
              </ul>
              <h3>Williams Bay — Edgewater Launch</h3>
              <ul>
                <li>Single ramp at the east end of Edgewater Park.</li>
                <li>Modest launch fee; permits at Village Hall (250 Williams St).</li>
                <li>Good staging area for the north shore.</li>
              </ul>
              <h3>Fontana — Reid Park Launch</h3>
              <ul>
                <li>West-end launch near downtown Fontana.</li>
                <li>Permits at Village Hall (175 Valley View Dr); fees by season and residency.</li>
                <li>Closest ramp to the west shore and Big Foot Country Club.</li>
              </ul>
              <h3>Linn Pier (south shore)</h3>
              <ul>
                <li>Township-managed launch on the south shore.</li>
                <li>Permits required; fees set by Linn Township.</li>
                <li>Useful when north-shore lots are full.</li>
              </ul>
              <h3>Why trailer parking is the constraint, not the ramp</h3>
              <p>
                This is geometry rather than policy. A tow vehicle with a trailer takes the
                footprint of several cars and can't be tucked into a standard stall — it needs a
                long space it can pull out of without reversing around other people's rigs. So a
                lot that comfortably holds cars holds few trailers, and runs out of room long
                before the town does. A ramp cycles boats through all morning; the parking behind
                it fills once. On a busy Saturday the question isn't whether you can launch, it's
                whether you can leave the truck.
              </p>
              <h3>Four launches, four governments</h3>
              <p>
                Each ramp is built and maintained by a different local body, which explains most of
                what confuses first-time launchers: there is no lake-wide launch permit, prices and
                rules differ from ramp to ramp, residents are treated differently at each, and you
                buy the permit at that community's hall rather than from a central lake authority
                that doesn't exist. One layer sits above all four — anything to do with the boat
                itself rather than the ramp, including registration and the inspect-and-drain
                routine for moving a boat between waters, comes from the state. Confirm those with
                the Wisconsin DNR before your first launch of the season.
              </p>
              <h3>Kayaks, paddleboards, and anything you carry</h3>
              <p>
                A hand-carried boat is a different problem, and the ramps are built for the
                trailered case. Whether a public beach allows hand-launching — and whether that
                changes while the swim area is staffed, which is exactly when you'd want to — is a
                municipal decision that varies by community and season, and one phone call to
                settle. Then plan the landing, not just the launch: a paddler can cross the whole
                lake without touching anything public, and the places you may legally step ashore
                are the same short list this page names.
              </p>
            </>
          ),
        },
        {
          id: "seasons",
          heading: "How the season changes what's actually open",
          body: (
            <>
              <p>
                The staffed season and the access itself are two different things, and they don't
                start and end on the same day. Lifeguards, fee collection, concessions and
                seasonal restrooms exist because summer demand pays for them — staffing is a cost,
                so it arrives with the crowds and leaves with them, and a shoulder-season beach is
                often the same sand with none of it around. That's a trade-off worth making
                deliberately: peak season buys supervision, open restrooms, someone to sell you a
                permit on the spot, and the worst parking of the year. Whether a specific beach is
                then open, open-but-unstaffed, or closed is a per-municipality answer.
              </p>
              <p>
                The Shore Path is the exception: an easement has no season, because it isn't a
                service anyone staffs. What changes there is conditions, and the{" "}
                <Link to="/lake-geneva-weather" className={LINK}>
                  weather page
                </Link>{" "}
                answers that faster than any calendar.
              </p>
            </>
          ),
        },
        {
          id: "current-details",
          heading: "How to get the current fee, season, and rules yourself",
          body: (
            <>
              <p>
                This page doesn't print current figures, for the same reason it doesn't print a
                lifeguard roster: five different bodies set them and they move.
              </p>
              <ol>
                <li>
                  <strong>Work out who owns the access point.</strong> The City of Lake Geneva for
                  Riviera Beach and the Wrigley Drive launch; the Village of Williams Bay for
                  Edgewater; the Village of Fontana for the beach, Reid Park and its launch; the
                  Town of Linn for Linn Pier; the State of Wisconsin for Big Foot Beach.
                </li>
                <li>
                  <strong>Ask that owner, not a listing site.</strong> Charges, resident and
                  non-resident rates, season passes, launch permits and staffing dates are set and
                  published by them — City Hall for Lake Geneva, the village halls for Williams Bay
                  and Fontana, the township for Linn. State park questions go to the Wisconsin DNR;
                  a city clerk can't answer those.
                </li>
                <li>
                  <strong>Ask three questions, not one.</strong> What it costs; whether the rate
                  differs for residents; and when the staffed season begins and ends. The third is
                  the one people forget, and it decides whether there's a lifeguard when you
                  arrive.
                </li>
                <li>
                  <strong>Buy launch permits before you tow,</strong> and confirm state boating
                  requirements separately — registration and the inspect-and-drain routine sit on
                  top of whatever the municipality asks of you.
                </li>
              </ol>
            </>
          ),
        },
        {
          id: "not-covered",
          heading: "What this guide doesn't cover, and why",
          body: (
            <>
              <p>Being explicit about the edges is more useful than pretending there aren't any.</p>
              <ul>
                <li>
                  <strong>Private piers and private beaches.</strong> There are far more of them
                  than public access points. They aren't access, and one being empty doesn't change
                  that.
                </li>
                <li>
                  <strong>Deeded and association access.</strong> A meaningful share of the water
                  access here belongs to particular homes and subdivisions through pier rights or a
                  shared beach. That's a property question, and the{" "}
                  <Link to="/guides/cost-of-living-lake-geneva" className={LINK}>
                    cost-of-living guide
                  </Link>{" "}
                  is where this site treats it.
                </li>
                <li>
                  <strong>Boundary and riparian questions.</strong> Where a property line sits
                  relative to the water is a records question, not an editorial one.
                </li>
                <li>
                  <strong>Ice.</strong> Walking or driving on a frozen lake is a separate subject
                  with separate risks.
                </li>
                <li>
                  <strong>Individual commercial operators.</strong> Rental outfits, tour boats and
                  resort beaches change their terms; naming them would date this page faster than
                  anything else on it.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "tips",
          heading: "Local tips before you go",
          body: (
            <>
              <ul>
                <li>
                  <strong>Know which category you're standing in.</strong> Beach, launch,
                  easement, state park, or somebody's business. Most visitor mistakes here are a
                  category error rather than deliberate trespass.
                </li>
                <li>
                  <strong>Arrive early on summer weekends.</strong> Parking — especially trailer
                  parking — is the limiting factor at every launch from Memorial Day to Labor
                  Day.
                </li>
                <li>
                  <strong>Buy your launch permit in advance</strong> at the relevant city or
                  village hall to skip the line at the ramp.
                </li>
                <li>
                  <strong>Bring cash.</strong> Some smaller beaches and launches still take cash
                  only.
                </li>
                <li>
                  <strong>Check before holidays.</strong> Hours, fees, and lifeguard schedules
                  shift year to year — a quick call to the city or village confirms what's open.
                </li>
                <li>
                  <strong>Respect the private shoreline.</strong> The Shore Path is public, but
                  the lawns and piers it crosses are private. Stay on the path, keep dogs
                  leashed, and pack out what you bring in.
                </li>
                <li>
                  <strong>Don't park on the lakefront lanes.</strong> The narrow residential
                  streets serving the homes the path crosses are not overflow lots.
                </li>
              </ul>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "Is Geneva Lake public?",
          answer:
            "The lake and its shoreline are two different questions. Most of the 21-mile shoreline is privately owned. Public access exists at a handful of municipal beaches and boat launches, at Big Foot Beach State Park, and along the Shore Path — which is a public right to walk across private lakefront rather than public shoreline in itself.",
        },
        {
          question: "What is the difference between the Shore Path and a public beach?",
          answer:
            "A public beach is publicly owned land where swimming is the intended use. The Shore Path is a public easement — a right of passage — across shoreline that belongs to private households. On a public beach you may swim, sit and stay. On the Shore Path you may walk through, and that is the whole grant.",
        },
        {
          question: "Can I swim anywhere along the Lake Geneva Shore Path?",
          answer:
            "No. Swim at the designated public beaches — Riviera Beach in Lake Geneva, Edgewater Park in Williams Bay, Fontana Beach — or at Big Foot Beach State Park. The water in front of private homes is private waterfront, and the easement is a right to walk past it, not to enter it.",
        },
        {
          question: "Why can I walk in front of someone's house but not stand on their lawn?",
          answer:
            "Because an easement grants one specific use of land somebody else owns, and uses it doesn't name aren't implied. Here the granted use is passage on foot. The owner still owns the ground, the frontage, the pier and the beach; what they don't have is the right to stop you walking through.",
        },
        {
          question: "Where can I launch a boat on Geneva Lake?",
          answer:
            "There are four public launches: the municipal launch on Wrigley Drive in Lake Geneva, the Edgewater launch in Williams Bay, the Reid Park launch in Fontana, and Linn Pier on the south shore. Each is run by a different local government and each sells its own permit.",
        },
        {
          question: "Is there one boat launch permit that covers the whole lake?",
          answer:
            "No. The four ramps are built and maintained by four separate bodies — the City of Lake Geneva, the Village of Williams Bay, the Village of Fontana and the Town of Linn — so each sells its own permit at its own hall, with its own rates and its own resident treatment. There is no central lake authority.",
        },
        {
          question: "Why is trailer parking harder than getting on the ramp?",
          answer:
            "Geometry. A tow vehicle with a trailer takes the footprint of several cars and needs a long space it can pull out of without reversing around other rigs, so a lot that holds plenty of cars holds few trailers. The ramp can cycle boats all morning; the parking behind it fills once.",
        },
        {
          question: "Do I need a state park sticker just to park and walk the Shore Path at Big Foot Beach?",
          answer:
            "Yes. A Wisconsin State Park vehicle admission sticker is required to leave a vehicle in the park regardless of what you're there to do, including using it purely as a Shore Path trailhead. If you'd rather start a walk without one, the municipal beaches and lakefront parks are the alternatives.",
        },
        {
          question: "How is the Big Foot Beach fee different from the beach fees in town?",
          answer:
            "It's a vehicle admission sticker rather than a per-person charge, sold daily or annually by the state. A carload pays the same as a single walker, which reverses the arithmetic at the municipal beaches. And because it's a state credential, village residency doesn't affect it the way it does at Riviera, Edgewater or Fontana.",
        },
        {
          question: "Can I launch a kayak or paddleboard from a public beach in Lake Geneva?",
          answer:
            "It depends on the community and often on the season, because a designated swim area and a launch area are different uses of the same sand. Whether hand-launching is permitted at a given beach is a municipal decision and a single phone call to the city or village that owns it.",
        },
        {
          question: "Which public beach is best with young children?",
          answer:
            "Edgewater Park in Williams Bay is the standing local pick — a long, gently sloping beach in a sheltered bay with a park, playground and restrooms behind it. Fontana Beach is the other easy answer for families with toddlers, and Riviera Beach suits families staying downtown who'd rather walk than drive.",
        },
        {
          question: "Is there a public beach you can walk to from downtown Lake Geneva?",
          answer:
            "Riviera Beach, right downtown beside the Riviera Ballroom and the public pier. It's the shortest walk from the shops and restaurants of any beach on the lake, which is exactly why its lots and meters fill early on a summer weekend.",
        },
        {
          question: "Where is the public access on the south shore of Geneva Lake?",
          answer:
            "Linn Pier is the township-managed public access and launch on the south shore, and Big Foot Beach State Park sits just south of downtown Lake Geneva with a stretch of public shoreline, trails and camping. Public access points sit farther apart on the south side than on the north.",
        },
      ]}
      related={[
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "21 miles of historic walking path around the lake — the easement, the access points, and the stories along it.",
        },
        {
          title: "Big Foot Beach State Park",
          path: "/guides/big-foot-beach-state-park",
          blurb:
            "The state park option: the vehicle sticker, the beach, the trails behind it, and the campground.",
        },
        {
          title: "Things to do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb:
            "Our running list of the best things to do around Geneva Lake, year-round.",
        },
        {
          title: "Lake Geneva with kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb:
            "Family-friendly beaches, parks, and rainy-day plans around the lake.",
        },
        {
          title: "Lake Geneva in summer",
          path: "/guides/best-things-to-do-lake-geneva-in-summer",
          blurb:
            "The season the beaches and launches are staffed — and the season the parking disappears.",
        },
        {
          title: "Lake Geneva weather",
          path: "/lake-geneva-weather",
          blurb:
            "Forecast and water temperature — the check worth making before you load the boat.",
        },
      ]}
    />
  );
}
