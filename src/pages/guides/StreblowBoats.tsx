import { GuideShell } from "@/components/guides/GuideShell";

export default function StreblowBoats() {
  return (
    <GuideShell
      title="Why Streblow Boats Became an Icon of Geneva Lake"
      metaTitle="Streblow Boats on Geneva Lake — A Lake Geneva Icon"
      metaDescription="The story of Streblow Boats and how a Wisconsin-built mahogany runabout became inseparable from Geneva Lake."
      path="/guides/streblow-boats-geneva-lake"
      datePublished="2026-06-05"
      dateModified="2026-06-05"
      intro={
        <>
          <p>
            If you've spent any time around Geneva Lake, you've probably seen one. A polished
            mahogany runabout gliding across the water. The sun catches the varnished wood. The
            engine hums with a sound that's unmistakably different from modern fiberglass boats.
            And along the side, a simple white stripe marks it as something locals recognize
            immediately: a Streblow.
          </p>
          <p>
            For many visitors, it's just a beautiful boat. For Lake Geneva, it's part of the
            lake's identity.
          </p>
        </>
      }
      sections={[
        {
          id: "wisconsin-roots",
          heading: "A Wisconsin boat with Geneva Lake roots",
          body: (
            <>
              <p>
                The Streblow story began in the early 1950s when Larry Streblow started building
                wooden boats in Wisconsin. What began as a small operation grew into one of
                America's longest-running wooden sport boat builders. Over time, Streblow
                developed a reputation for handcrafted mahogany runabouts that balanced elegance,
                performance, and durability.
              </p>
              <p>
                In 1987, the company moved its operations closer to Geneva Lake, where many of
                its customers already kept their boats. The move cemented the relationship
                between the brand and the lake that would eventually become its spiritual home.
              </p>
            </>
          ),
        },
        {
          id: "signature-silhouette",
          heading: "The boat you can spot from across the water",
          body: (
            <>
              <p>Part of what makes a Streblow special is that it doesn't look like anything else.</p>
              <p>
                The signature design emerged in the 1960s and has remained remarkably consistent
                ever since. A centered engine, wraparound seating, double-plank hull construction,
                and the famous white stripe create a silhouette that longtime lake residents can
                identify almost instantly.
              </p>
              <p>
                On Geneva Lake, that's saying something. This is a lake known for classic boats,
                historic estates, and generations of boating tradition. Yet Streblow managed to
                become one of the few designs that feels inseparable from the lake itself.
              </p>
            </>
          ),
        },
        {
          id: "more-than-a-boat",
          heading: "More than a boat",
          body: (
            <>
              <p>For many families, a Streblow isn't just transportation.</p>
              <ul>
                <li>Sunrise cruises before the lake wakes up.</li>
                <li>Evening rides after dinner.</li>
                <li>Teaching children how to handle a boat for the first time.</li>
                <li>Watching fireworks from the water.</li>
              </ul>
              <p>
                Over the decades, these boats became woven into family traditions around Geneva
                Lake. Owners often keep them for generations, restoring and maintaining them
                rather than replacing them.
              </p>
            </>
          ),
        },
        {
          id: "lake-geneva-tradition",
          heading: "A Lake Geneva tradition",
          body: (
            <>
              <p>
                Today, more than 100 Streblows are believed to call Geneva Lake home, with
                hundreds more across the country. Yet nowhere are they more closely associated
                with a place than here.
              </p>
              <p>
                The annual "Wake the Lake" gatherings, where Streblow owners gather on the water
                and cruise together, are a reminder that the boats have become something larger
                than a product. They've become a community.
              </p>
            </>
          ),
        },
        {
          id: "why-it-matters",
          heading: "Why it matters",
          body: (
            <>
              <p>Every town has landmarks.</p>
              <p>
                Geneva Lake has the Shore Path. The Riviera. Yerkes Observatory. Black Point
                Estate. And out on the water, it has the Streblow.
              </p>
              <p>
                Not because it's the biggest boat on the lake. Not because it's the fastest. But
                because after decades of craftsmanship and tradition, it became something rare: a
                boat that feels like it belongs here.
              </p>
              <p className="text-sm text-slate-500 italic mt-6">
                Lake Geneva Icons is an ongoing series exploring the places, traditions,
                businesses, and people that helped shape Geneva Lake.
              </p>
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
          title: "Why people love Lake Geneva",
          path: "/guides/why-people-love-lake-geneva",
          blurb:
            "What keeps families coming back to Geneva Lake generation after generation.",
        },
      ]}
    />
  );
}