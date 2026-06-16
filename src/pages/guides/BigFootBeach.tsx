import { GuideShell } from "@/components/guides/GuideShell";

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
      dateModified={new Date().toISOString().slice(0, 10)}
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
        </>
      }
      sections={[
        {
          id: "beach",
          heading: "The beach and day use",
          body: (
            <p>
              The swim beach is a long, shallow strip on the lake — sand
              underfoot, no lifeguards, gentle drop-off that works for
              kids. It faces north toward downtown, so it gets sun most
              of the day. Picnic tables, charcoal grills, and a shelter
              sit just up the slope. Restrooms are open seasonally. The
              beach can get busy on summer weekends; arrive before 10am
              if you want a shaded picnic table.
            </p>
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
                <strong>Address:</strong> 1452 IL-120, Lake Geneva, WI
                53147.
              </li>
            </ul>
          ),
        },
        {
          id: "history-name",
          heading: "Where the name comes from",
          body: (
            <p>
              The park is named for Chief Big Foot (Maunk-suck), the
              19th-century Potawatomi leader whose people lived along
              the southeast shore of Geneva Lake before being forcibly
              removed in 1836. The lake itself was called
              "Kishwauketoe" — "clear water" — by the Potawatomi. It's
              worth knowing the name on the sign before you settle in
              on the beach.
            </p>
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