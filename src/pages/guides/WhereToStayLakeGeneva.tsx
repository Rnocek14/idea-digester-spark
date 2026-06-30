import { GuideShell } from "@/components/guides/GuideShell";

/**
 * Cornerstone SEO target: "lake geneva hotels" + "where to stay lake geneva"
 * cluster. Lodging is one of the highest-traffic page types for
 * visitlakegeneva.com — this guide gives us a real entry into that cluster.
 */
export default function WhereToStayLakeGeneva() {
  return (
    <GuideShell
      title="Where to Stay in Lake Geneva — Hotels, Resorts & Rentals"
      metaTitle="Lake Geneva Hotels & Resorts (2026): Where to Stay Guide"
      metaDescription="A local's guide to where to stay in Lake Geneva, Wisconsin — Grand Geneva, The Abbey, Lake Lawn, boutique inns, and lakefront rentals, sorted by traveler type."
      path="/guides/where-to-stay-lake-geneva"
      dateModified={new Date().toISOString().slice(0, 10)}
      intro={
        <>
          <p>
            "Where should we stay?" is the question we get most from friends
            planning a Lake Geneva weekend. The honest answer is: it depends
            on what kind of trip you want. A resort pool day with kids, a
            quiet couples' weekend on the water, and a girls' trip downtown
            all point to very different doors.
          </p>
          <p>
            Here's how we break it down — the four big resorts, a handful of
            smaller inns worth knowing, and when a lakefront rental beats a
            hotel room.
          </p>
        </>
      }
      sections={[
        {
          id: "big-resorts",
          heading: "The four big resorts",
          body: (
            <>
              <p>
                Lake Geneva has four destination resorts, each with its own
                personality. Pick by what you actually want to do, not by
                star rating.
              </p>
              <ul>
                <li>
                  <strong>Grand Geneva Resort &amp; Spa</strong> — 1,300-acre
                  property east of town with two golf courses, a ski hill,
                  the WELL Spa, and Timber Ridge water park next door. Best
                  for families and groups who want everything on one campus.
                </li>
                <li>
                  <strong>The Abbey Resort</strong> — On the water in
                  Fontana, with the largest marina on the lake, Avani Spa,
                  and the easiest lakefront access of the big four. Best for
                  couples and anyone who wants a boat slip steps from their
                  room.
                </li>
                <li>
                  <strong>Lake Lawn Resort</strong> — 270 acres on Delavan
                  Lake (15 minutes from downtown Lake Geneva), with a
                  historic golf course, calmer pace, and lower price point.
                  Best for multi-generational trips and golf weekends.
                </li>
                <li>
                  <strong>Geneva National Resort</strong> — Three signature
                  golf courses (Palmer, Player, Trevino) and condo-style
                  villas. Best for golf-first trips and longer stays where
                  a kitchen helps.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "downtown-boutique",
          heading: "Downtown & boutique stays",
          body: (
            <>
              <p>
                If you want to walk to dinner, coffee, the Riviera, and the
                Shore Path, stay downtown rather than at a resort.
              </p>
              <ul>
                <li>
                  <strong>The Geneva Inn</strong> — Small lakefront inn just
                  east of downtown with maybe the best in-town water views
                  for the price. Quiet, adult-leaning.
                </li>
                <li>
                  <strong>The Cove of Lake Geneva</strong> — All-suite
                  property a block off Main Street; good for families who
                  want kitchens and indoor pool access without a full resort.
                </li>
                <li>
                  <strong>Maxwell Mansion</strong> — Restored 1856 mansion
                  with a popular cocktail bar (Apothecary) on site. Walkable
                  to everything; best for a date-weekend feel.
                </li>
                <li>
                  <strong>French Country Inn (Williams Bay)</strong> — Small
                  lakefront inn on the quieter north shore, 10 minutes from
                  downtown. Romantic, low-key.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "by-traveler",
          heading: "Pick by traveler type",
          body: (
            <ul>
              <li>
                <strong>Families with young kids:</strong> Grand Geneva (for
                Timber Ridge water park) or The Cove (suites + indoor pool,
                walkable downtown).
              </li>
              <li>
                <strong>Couples weekend:</strong> The Geneva Inn, Maxwell
                Mansion, or French Country Inn.
              </li>
              <li>
                <strong>Golf trip:</strong> Geneva National or Lake Lawn.
              </li>
              <li>
                <strong>Boating / lake-first:</strong> The Abbey Resort in
                Fontana — slip access is hard to beat.
              </li>
              <li>
                <strong>Bigger group (8+):</strong> A lakefront house rental
                almost always wins on price-per-person and shared space.
              </li>
            </ul>
          ),
        },
        {
          id: "lakefront-rentals",
          heading: "When a lakefront rental beats a hotel",
          body: (
            <>
              <p>
                Once you're past four people or two nights, a private rental
                on Geneva Lake — through Vrbo, Airbnb, or a local manager
                like Geneva Lakefront Realty's vacation arm — usually beats a
                resort room on both price and experience. You get a pier, a
                kitchen, and a yard.
              </p>
              <p>
                Trade-offs to know: most lakefront rentals require Saturday-
                to-Saturday bookings in peak summer, cleaning fees can be
                steep, and pier space (boat slip vs. just swim pier) varies
                wildly. Read the listing for the lake-access details, not
                just the bedroom count.
              </p>
            </>
          ),
        },
        {
          id: "when-to-book",
          heading: "When to book",
          body: (
            <ul>
              <li>
                <strong>Summer weekends (Memorial Day–Labor Day):</strong>{" "}
                book 2–3 months out. The Abbey and Grand Geneva sell out
                first.
              </li>
              <li>
                <strong>Winterfest (early February):</strong> downtown rooms
                sell out fast — book in November.
              </li>
              <li>
                <strong>Shoulder season (May, late September, October):</strong>{" "}
                the best value all year. Weather is hit-or-miss but rates
                drop 30–40%.
              </li>
            </ul>
          ),
        },
      ]}
      faqs={[
        {
          question: "What is the best resort in Lake Geneva?",
          answer:
            "It depends on the trip. Grand Geneva is the most all-inclusive for families, The Abbey wins for lakefront access in Fontana, Lake Lawn is the value pick for golf and multi-gen trips, and Geneva National is the golf-first option.",
        },
        {
          question: "Where should I stay to walk to downtown Lake Geneva?",
          answer:
            "Maxwell Mansion, The Cove of Lake Geneva, and The Geneva Inn are all within walking distance of Main Street, the Riviera, and the Shore Path.",
        },
        {
          question: "Is The Abbey or Grand Geneva better?",
          answer:
            "The Abbey is on the water in Fontana with the biggest marina on the lake — best for boaters and couples. Grand Geneva is a 1,300-acre inland resort with golf, skiing, and the Timber Ridge water park next door — best for families and groups.",
        },
        {
          question: "Are there lakefront hotels in Lake Geneva?",
          answer:
            "Yes — The Abbey Resort (Fontana), The Geneva Inn (just east of downtown), and French Country Inn (Williams Bay) all sit directly on Geneva Lake. The big inland resorts (Grand Geneva, Geneva National) are not on the water.",
        },
        {
          question: "How far in advance should I book a Lake Geneva hotel for summer?",
          answer:
            "For summer weekends, 2–3 months ahead is safe; The Abbey and Grand Geneva often sell out earlier. Winterfest weekend (early February) also books up months out.",
        },
      ]}
      related={[
        {
          title: "Things to do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb: "What's actually worth doing once you've checked in.",
        },
        {
          title: "Best restaurants in Lake Geneva",
          path: "/best-of/restaurants-lake-geneva",
          blurb: "Where the locals eat — downtown, lakefront, and worth-the-drive.",
        },
        {
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The 21-mile public path that circles the entire lake.",
        },
      ]}
    />
  );
}