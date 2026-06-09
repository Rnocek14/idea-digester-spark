import { GuideShell } from "@/components/guides/GuideShell";

export default function LakeGenevaPublicAccess() {
  return (
    <GuideShell
      title="Lake Geneva Public Beaches & Boat Launches: A Local's Access Guide"
      metaTitle="Lake Geneva Public Beaches & Boat Launches Guide"
      metaDescription="Every public beach and boat launch on Geneva Lake — Riviera, Williams Bay, Fontana and more. Parking, fees, hours, and what to expect."
      path="/guides/lake-geneva-public-access-guide"
      datePublished="2026-06-09"
      dateModified="2026-06-09"
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
            Fees, hours, and rules change year to year. Treat this as a starting map; call
            ahead for the latest before holiday weekends.
          </p>
        </>
      }
      sections={[
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
              </ul>
            </>
          ),
        },
      ]}
      related={[
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "21 miles of historic walking path around the lake — and the families, estates, and stories along it.",
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
      ]}
    />
  );
}