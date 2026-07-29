import { Link } from "react-router-dom";

import { GuideShell } from "@/components/guides/GuideShell";

const LINK = "text-blue-700 hover:underline font-medium";

/**
 * Cornerstone SEO target: "big foot beach state park" (~4.4K/mo, KDI 38).
 * State park right on Geneva Lake's southeast shore — Lake Geneva's only
 * state park, popular for camping, day use, and Shore Path access.
 */
export default function BigFootBeach() {
  return (
    <GuideShell
      title="Big Foot Beach State Park — A Visitor's Guide"
      metaTitle="Big Foot Beach State Park (2026): Camping, Beach, Trails, Hours"
      metaDescription="Visiting Big Foot Beach State Park in Lake Geneva, Wisconsin — beach, campground, hiking, day-use fees, parking, and what locals wish first-time visitors knew."
      path="/guides/big-foot-beach-state-park"
      dateModified="2026-07-29"
      intro={
        <>
          <p>
            Big Foot Beach State Park is the easy answer when someone asks
            where to actually swim in Lake Geneva without paying a beach
            pass at the Riviera. It's a 271-acre Wisconsin state park
            wrapped around a quiet stretch of Geneva Lake's southeast
            shore, about a mile south of downtown on Highway 120. There's
            a sand beach, a wooded campground, a handful of short hiking
            loops, and direct access to the Shore Path.
          </p>
          <p>
            Here's what to know before you go — fees, what the beach is
            really like, the camping situation, and where the parking
            actually fills up in July.
          </p>
          <p>
            Fees, campground dates and sticker prices are set by the
            Wisconsin DNR and change, so this page points at the DNR rather
            than reprinting numbers that go stale. What it does cover is the
            part that holds: which of the four quite different visits this
            park supports you're actually planning, and what each one needs.
          </p>
        </>
      }
      sections={[
        {
          id: "which-visit",
          heading: "Four different parks, one entrance",
          body: (
            <>
              <p>
                Most of the confusion about Big Foot comes from people
                planning one visit and arriving for another. The park
                supports four, and they want different things from you.
              </p>
              <ul>
                <li>
                  <strong>The beach day.</strong> The reason most people
                  come, and the one most sensitive to timing — the beach and
                  its parking are what fill on a hot weekend. Early arrival
                  is the whole strategy.
                </li>
                <li>
                  <strong>The camping trip.</strong> Effectively a separate
                  park with a separate booking calendar, months out. The
                  campground is in the woods rather than on the water.
                </li>
                <li>
                  <strong>The trail walk.</strong> Roughly five flat miles
                  inside the park, and the least crowded thing here. On a
                  July weekend when the beach lot is full, the trails
                  usually aren't.
                </li>
                <li>
                  <strong>Shore Path access.</strong> Using the park as a
                  trailhead rather than a destination — you're paying for a
                  vehicle sticker to park, then walking out along the lake.
                </li>
              </ul>
              <p>
                The one that trips people up is the last. A state park
                vehicle admission sticker is required to leave a car here
                whichever of the four you're doing, including when the park
                is only your parking spot for a Shore Path walk. That's
                worth knowing before you plan a long walk from this end —
                the{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className={LINK}>
                  public access guide
                </Link>{" "}
                covers the alternatives if you'd rather start somewhere
                without a sticker requirement.
              </p>
            </>
          ),
        },
        {
          id: "beach",
          heading: "The beach and day use",
          body: (
            <>
              <p>
                The swim beach is a long, shallow strip on the lake — sand
                underfoot, no lifeguards, gentle drop-off that works for
                kids. It faces north toward downtown, so it gets sun most
                of the day. Picnic tables, charcoal grills, and a shelter
                sit just up the slope. Restrooms are open seasonally. The
                beach can get busy on summer weekends; arrive before 10am
                if you want a shaded picnic table.
              </p>
              <p>
                Two things follow from "no lifeguards," and they're the
                reason this beach suits some families and not others. Swimming
                is at your own risk at every hour the park is open, which
                means supervision is entirely yours — there is no one whose
                job it is to watch the water. Against that, the shallow,
                gradual entry is genuinely gentle, and the bay is calmer than
                the open lake because it isn't exposed to the long fetch that
                builds chop on a windy afternoon. For confident parents of
                small children that combination is close to ideal. For a group
                that wanted a guarded beach, it isn't one, and that's worth
                settling before you drive out.
              </p>
              <p>
                The north-facing aspect is the underrated detail. Sun stays on
                the sand through most of the day, which is pleasant in June and
                relentless in late July — hence the advice about shaded tables.
                It also means the view across the water is of downtown and the
                north shore, so this is one of the better places on the lake to
                sit through an evening without paying for the privilege.
              </p>
            </>
          ),
        },
        {
          id: "camping",
          heading: "Camping",
          body: (
            <>
              <p>
                The campground has around 100 family sites in two loops
                set back in oak woods — none directly on the water, but
                the beach is a short walk. Sites are a mix of electric
                and non-electric; a few are reservable as walk-in tent
                sites. Reservations open about 11 months in advance
                through the Wisconsin DNR system and summer weekends
                book out fast, especially July 4th and Venetian Fest
                weekend.
              </p>
              <ul>
                <li>
                  <a
                    href="https://wisconsinstateparks.reserveamerica.com/camping/big-foot-beach-state-park/r/campgroundDetails.do?contractCode=WI&parkId=720185"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    Reserve a campsite — Wisconsin DNR / ReserveAmerica
                  </a>
                </li>
                <li>Showers and flush toilets on site.</li>
                <li>Quiet hours strictly enforced — this is a family park.</li>
              </ul>
            </>
          ),
        },
        {
          id: "hiking-trails",
          heading: "Trails and the Shore Path",
          body: (
            <p>
              There are roughly five miles of easy trails inside the
              park — flat, well-marked, family-paced. The bigger draw
              for visitors is that the public Lake Geneva Shore Path
              runs along the park's lakefront, so you can pick it up
              here and walk west toward downtown (about a mile to Flat
              Iron Park). The full Shore Path circles the entire lake
              for 21 miles, and Big Foot is one of its best public
              entry points.
            </p>
          ),
        },
        {
          id: "fees-hours",
          heading: "Fees, hours, and parking",
          body: (
            <ul>
              <li>
                <strong>Day-use:</strong> a Wisconsin State Park vehicle
                admission sticker is required (daily or annual). In-state
                rates are lower than out-of-state. Buy at the park
                entrance or online via the DNR.
              </li>
              <li>
                <strong>Hours:</strong> the park is open 6am–11pm daily,
                year-round. The campground is seasonal (typically late
                spring through mid-fall).
              </li>
              <li>
                <strong>Parking:</strong> the main beach lot fills on
                hot weekends by mid-morning. Overflow parking is up the
                hill near the picnic area.
              </li>
              <li>
                <strong>Dogs:</strong> allowed on leash on trails and a
                designated pet beach area, but not on the main swim
                beach.
              </li>
              <li>
                <strong>Address:</strong> 1452 WI-120, Lake Geneva, WI
                53147. Some map listings render the route as "IL-120" —
                it's Wisconsin Highway 120, the same road.
              </li>
            </ul>
          ),
        },
        {
          id: "history-name",
          heading: "Where the name comes from",
          body: (
            <>
              <p>
                The park is named for Chief Big Foot (Maunk-suck), the
                19th-century Potawatomi leader whose people lived along
                the southeast shore of Geneva Lake before being forcibly
                removed in 1836. The Potawatomi name for the lake is
                usually given locally as "Kishwauketoe," commonly
                translated as "clear water" — the name the nature
                conservancy in Williams Bay still carries. Treat the
                translation as the account handed down around the lake
                rather than a linguistic citation; this desk hasn't
                reproduced a primary source for it.
              </p>
              <p>
                It's worth knowing the name on the sign before you settle in
                on the beach. The removal in 1836 is the event that made the
                shoreline available to the Chicago families who built the
                estates the Shore Path now runs past — the park, the path,
                and the summer-resort history that followed all trace back
                to it. The sign is not decoration.
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "Is there an entrance fee at Big Foot Beach State Park?",
          answer:
            "Yes — a Wisconsin State Park vehicle admission sticker is required for day use, available as a daily or annual pass at the park entrance or through the Wisconsin DNR.",
        },
        {
          question: "Can you swim at Big Foot Beach?",
          answer:
            "Yes. There's a long sand swim beach on Geneva Lake with shallow, gentle entry. There are no lifeguards, so swimming is at your own risk.",
        },
        {
          question: "Can you camp at Big Foot Beach State Park?",
          answer:
            "Yes. The park has a roughly 100-site family campground with electric and non-electric sites, showers, and flush toilets. Reservations are recommended for summer weekends.",
        },
        {
          question: "Are dogs allowed at Big Foot Beach?",
          answer:
            "Dogs are allowed on leash on trails and on a designated pet beach area, but not on the main swim beach.",
        },
        {
          question: "How far is Big Foot Beach from downtown Lake Geneva?",
          answer:
            "About a mile south of downtown on Highway 120 — roughly five minutes by car or a 20–25 minute walk along the Shore Path.",
        },
        {
          question: "Do I need a sticker just to park and walk the Shore Path?",
          answer:
            "Yes. A Wisconsin State Park vehicle admission sticker is required to leave a vehicle in the park regardless of what you're there to do, including using it purely as a Shore Path trailhead. If you'd rather start a walk without that, the public access guide covers entry points that don't sit inside the state park.",
        },
        {
          question: "Is Big Foot Beach State Park open in winter?",
          answer:
            "The park itself is open year-round; the campground is seasonal, typically late spring through mid-fall, and restrooms are seasonal too. Winter is when the trails and the lakefront are at their quietest, and the vehicle sticker requirement still applies.",
        },
        {
          question: "Are there lifeguards at Big Foot Beach?",
          answer:
            "No. Swimming is at your own risk at all times. The entry is shallow and gradual and the bay is calmer than the open lake, which makes it forgiving water — but supervision is entirely the responsibility of whoever brought the kids.",
        },
        {
          question: "Where should I park when the beach lot is full?",
          answer:
            "Overflow parking is up the hill near the picnic area. On hot summer weekends the main beach lot fills by mid-morning, so arriving before 10am is the reliable answer and the overflow lot is the fallback.",
        },
        {
          question: "Is Big Foot Beach good for young kids?",
          answer:
            "The shallow, gentle entry and the calmer bay make it one of the more forgiving swim spots on the lake for small children. The caveats are that there are no lifeguards and that shade at the picnic tables goes early on summer weekends.",
        },
        {
          question: "Can you have a fire or grill at Big Foot Beach?",
          answer:
            "There are charcoal grills and picnic tables in the day-use area up the slope from the beach, plus a shelter. Campground sites are the place for fires; check current DNR rules and any seasonal fire restrictions before you go.",
        },
      ]}
      related={[
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "The 21-mile public walking path that circles the lake — Big Foot is one of its best entry points.",
        },
        {
          title: "Lake Geneva public access guide",
          path: "/guides/lake-geneva-public-access-guide",
          blurb: "Every public beach, boat launch, and shoreline access point on the lake.",
        },
        {
          title: "Things to do in Lake Geneva with kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb: "Family-friendly picks around the lake, including the beach.",
        },
      ]}
    />
  );
}