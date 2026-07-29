import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";

/**
 * Lake Geneva Icons — cornerstone entry.
 *
 * Editorial constraint for anyone extending this page: the only hard facts
 * here are the ones the desk already had — the early 1950s founding, the
 * 1960s design, 1987, the named construction features, and "Wake the Lake."
 * Do not add dates, addresses, model names, prices, or event schedules.
 * Everything else is either geography this site already covers or reasoning
 * a reader can check with their own eyes from public shoreline.
 */

// Assembled from the company history as it is commonly recounted around
// Geneva Lake. Nothing added beyond the dates the desk already had.
const TIMELINE: { when: string; what: string }[] = [
  {
    when: "Early 1950s",
    what: "Larry Streblow begins building wooden boats in Wisconsin — a small operation, not a factory.",
  },
  {
    when: "The 1960s",
    what: "The signature design settles: centered engine, wraparound seating, double-plank hull, white stripe. It has held ever since.",
  },
  {
    when: "1987",
    what: "Operations move closer to Geneva Lake, near where many customers already kept their boats.",
  },
  {
    when: "Since then",
    what: "Boats stay in families rather than turning over, owners restore rather than replace, and the fleet cruises together at the annual \"Wake the Lake\" gatherings.",
  },
];

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
          <p>
            Here's where the boats came from, how to tell one from the other wooden hulls on the
            lake, and where you can expect to see one from public ground.
          </p>
        </>
      }
      sections={[
        {
          id: "wisconsin-roots",
          heading: "A Wisconsin boat that found its home water",
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
                That last word is the one that matters. Most of the American boat business moved
                to fiberglass — cheaper to mold, faster to build, and forgiving of an owner who
                wants to launch in May and think about the boat again in October. A wooden hull
                asks for varnish, attention, and a relationship with someone who knows how to work
                on it. The builders who stayed with wood survived by being worth the trouble.
              </p>
              <p>
                In 1987, the company moved its operations closer to Geneva Lake, where many of
                its customers already kept their boats. The move cemented the relationship
                between the brand and the lake that would eventually become its spiritual home.
              </p>
              <p>
                That decision explains most of what follows. Manufacturers usually move toward
                cheaper land or a bigger labor pool. This one moved toward the specific body of
                water where its boats already spent their summers — which is less like selling a
                product and more like servicing a fleet.
              </p>
            </>
          ),
        },
        {
          id: "timeline",
          heading: "The Streblow timeline",
          body: (
            <>
              <p>
                Four moments, in order — the distance between "a man building boats in Wisconsin"
                and "a boat you can name from a bench on the Shore Path."
              </p>
              <ol className="not-prose mt-4 rounded-sm border border-slate-200 bg-white divide-y divide-slate-100">
                {TIMELINE.map((t) => (
                  <li key={t.when} className="p-4 sm:p-5">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      {t.when}
                    </p>
                    <p className="text-slate-700 leading-relaxed mt-1">{t.what}</p>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-slate-500 italic mt-3">
                These four dates are the documented spine of this page. We've deliberately not
                filled the gaps with model years or production figures we can't stand behind.
              </p>
            </>
          ),
        },
        {
          id: "signature-silhouette",
          heading: "How to spot a Streblow from shore",
          body: (
            <>
              <p>
                Part of what makes a Streblow special is that it doesn't look like anything else.
                The signature design emerged in the 1960s and has stayed remarkably consistent
                since, which is exactly why it's learnable. You don't need to know boats. You need
                four things to look for and one attentive afternoon.
              </p>

              <h3>The white stripe</h3>
              <p>
                The most reliable tell, and the one that works at distance. A single white stripe
                runs along the side, breaking up the dark varnished mahogany. On a bright day,
                when the hull is reading as one glowing brown mass, the stripe is what your eye
                catches first.
              </p>

              <h3>Engine in the middle, seating wrapped around it</h3>
              <p>
                The structural tell, and the one that works even when you can't make out color.
                The engine sits centered in the boat rather than pushed to the stern or hung off
                the transom, and the seating wraps around it instead of lining up in rows of
                bucket seats. The result is a long, low profile that stays close to the water bow
                to stern. Compare that to almost any modern runabout: tall bow, high sides, power
                at the back. A Streblow reads horizontal; most everything else reads vertical.
              </p>

              <h3>The finish</h3>
              <p>
                Varnished mahogany does something painted fiberglass can't — light goes into the
                surface and comes back out, so the hull looks entirely different at seven in the
                morning than it does at noon. Gelcoat reflects; varnish glows. It's also the
                feature that costs owners their weekends.
              </p>

              <h3>The sound</h3>
              <p>
                With the engine amidships and a wooden hull around it, a Streblow doesn't sound
                like the boats it shares the water with. It's lower and rounder — a hum rather
                than the flat buzz of an outboard. People who grew up here will tell you they can
                identify one with their back turned, and on a quiet morning that isn't a boast.
              </p>

              <h3>And the part you can't see: the double-plank hull</h3>
              <p>
                Double-plank construction means two layers of planking instead of one. You'll
                never spot it from a bench. It's worth knowing anyway, because it's why boats
                built decades ago are still running, and why owners talk about restoring rather
                than replacing.
              </p>

              <p>
                <strong>One honest caveat.</strong> Geneva Lake has a lot of beautiful old wooden
                boats and not all of them are Streblows. Varnished mahogany alone isn't an
                identification — it's the combination that makes it. If you've only got two of
                the three, call it a classic wooden runabout and enjoy it anyway.
              </p>
            </>
          ),
        },
        {
          id: "where-to-see",
          heading: "Where you'll see them, and when",
          body: (
            <>
              <p>
                There's no schedule for this and nothing to buy a ticket for. Streblows aren't an
                attraction; they're privately owned boats that happen to live on a lake with an
                unusual amount of public shoreline. That shoreline is the only reason this page
                can give you a useful answer at all.
              </p>

              <h3>From the Shore Path</h3>
              <p>
                The best vantage point on the lake, and it's free. The{" "}
                <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline font-medium">
                  Lake Geneva Shore Path
                </Link>{" "}
                runs 21 continuous miles around the water on a public easement, which puts you at
                water level for the entire walk with an uninterrupted view of boat traffic. The
                quieter stretches away from downtown are better for this than the busy in-town
                section — less between you and the lake.
              </p>

              <h3>From the public beaches and piers</h3>
              <p>
                Public access points ring the lake, so you can choose a shoreline and a direction
                of light rather than being stuck with one view. Our{" "}
                <Link to="/guides/lake-geneva-public-access-guide" className="text-blue-700 hover:underline font-medium">
                  public access guide
                </Link>{" "}
                covers where the beaches, piers, and launches are. Day-use fees, parking, and
                seasonal hours vary by village and change year to year — check before you drive
                over.
              </p>

              <h3>From the water</h3>
              <p>
                Being out on the lake changes the exercise entirely: you see hulls in profile, at
                speed, from the plane they sit on. The tour boats running from the downtown
                lakefront are the easy version if you don't have a boat — see{" "}
                <Link to="/guides/things-to-do-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  things to do in Lake Geneva
                </Link>{" "}
                for how the lakefront is laid out.
              </p>

              <h3>When to look</h3>
              <p>
                The owners' own habits are the best schedule anyone can offer. Early mornings,
                while the water is still flat, are classic-boat hours; evenings after dinner are
                the other reliable window; holiday nights with fireworks over the water bring out
                boats you won't see the rest of the season. And it's seasonal, unavoidably — this
                is a Wisconsin lake that freezes, so wooden boats come out of storage in spring
                and go back before the cold. A clear October morning, with few boats out, is
                arguably the best light varnish ever gets.
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
              <p>
                That habit isn't only sentiment — it's what wood asks of you. Varnish has to be
                kept up. The boat has to be pulled, covered, and stored through a Wisconsin
                winter. Work on a wooden hull is specialized enough that you end up in a
                relationship with whoever does it. Nobody takes that on for a boat they plan to
                trade in three seasons, which is precisely why these get handed down instead.
              </p>
              <p>
                You can observe the result from shore without knowing a single owner: the wooden
                fleet here is unusually stable. The same hulls come out year after year, which is
                how a boat stops being a purchase and becomes a family fixture — the thing a
                grandchild learns to drive and inherits the maintenance schedule for.
              </p>
            </>
          ),
        },
        {
          id: "lake-geneva-tradition",
          heading: "The fleet, and Wake the Lake",
          body: (
            <>
              <p>
                You'll hear that more than 100 Streblows call Geneva Lake home, with hundreds more
                across the country. It's a figure worth repeating and worth labeling honestly: it
                is the number as it circulates among owners and longtime residents, not a count
                this desk has verified against a registry, a harbor list, or a builder's records.
                Read it as the local estimate it is. What isn't in question — anyone can stand on
                the Shore Path in July and check — is that the concentration here is real.
              </p>
              <p>
                The annual "Wake the Lake" gatherings, where Streblow owners gather on the water
                and cruise together, are a reminder that the boats have become something larger
                than a product. They've become a community. Owners who bring their boats out
                together once a year aren't a customer base; they're closer to a club with a
                shared object.
              </p>
              <p>
                We don't publish a date for it here, because owner gatherings aren't fixed the way
                a village festival is. For anything on the water with a date attached, the{" "}
                <Link to="/events" className="text-blue-700 hover:underline font-medium">
                  events calendar
                </Link>{" "}
                is the place to check.
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
                Geneva Lake has{" "}
                <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline font-medium">
                  the Shore Path
                </Link>
                . The Riviera on the{" "}
                <Link to="/guides/things-to-do-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  downtown lakefront
                </Link>
                .{" "}
                <Link to="/guides/yerkes-observatory" className="text-blue-700 hover:underline font-medium">
                  Yerkes Observatory
                </Link>{" "}
                above Williams Bay. Black Point Estate, out along that same shoreline walk. And
                out on the water, it has the Streblow.
              </p>
              <p>
                Not because it's the biggest boat on the lake. Not because it's the fastest. But
                because after decades of craftsmanship and tradition, it became something rare: a
                boat that feels like it belongs here.
              </p>
              <p>
                That's what separates this landmark from the others. The observatory and the
                estates sit still and you go to them. The Streblow is a landmark that moves, that
                nobody administers, and that exists only because a few hundred families decided a
                difficult boat was worth keeping. It has to be actively maintained every year or
                it disappears. Most of what people love about this place works that way.
              </p>

              {/* Resident intent — this page attracts multi-generational lake
                  families and second-home owners. */}
              <h3>If the lake is pulling at you</h3>
              <p>
                Pages like this find two kinds of readers: people who already have a boat like
                this in the family, and people who've started wondering what it would take to be
                here year-round. If you're the second kind, the honest next reads are{" "}
                <Link to="/guides/why-people-love-lake-geneva" className="text-blue-700 hover:underline font-medium">
                  why people love Lake Geneva
                </Link>{" "}
                — trade-offs included — and the{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className="text-blue-700 hover:underline font-medium">
                  neighborhood guide
                </Link>
                , on what each shoreline town is like to actually live in.
              </p>

              {/* Series footer — the framing already existed in the copy; this
                  makes it navigable. */}
              <div className="not-prose mt-8 rounded-sm border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Lake Geneva Icons
                </p>
                <p className="text-slate-700 leading-relaxed mt-2">
                  An ongoing series about the places, traditions, businesses, and people that
                  helped shape Geneva Lake. Other entries:
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li>
                    <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline font-medium">
                      The Lake Geneva Shore Path
                    </Link>
                    <span className="text-slate-600"> — 21 miles of public shoreline, and how it stayed public.</span>
                  </li>
                  <li>
                    <Link to="/guides/yerkes-observatory" className="text-blue-700 hover:underline font-medium">
                      Yerkes Observatory
                    </Link>
                    <span className="text-slate-600"> — the great dome above Williams Bay.</span>
                  </li>
                  <li>
                    <Link to="/guides/why-people-love-lake-geneva" className="text-blue-700 hover:underline font-medium">
                      Why people love Lake Geneva
                    </Link>
                    <span className="text-slate-600"> — the case for the lake, trade-offs included.</span>
                  </li>
                  <li>
                    <Link to="/guides" className="text-blue-700 hover:underline font-medium">
                      All Lake Geneva guides
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="not-prose mt-6 rounded-sm border-l-2 border-slate-300 pl-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  How this page was put together
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-1.5">
                  Written by The Brief Editors. The dates here — the early 1950s founding, the
                  1960s design, the 1987 move — are the company's history as it is commonly
                  recounted around Geneva Lake; we have not reproduced corporate records. The
                  fleet figure is flagged above as a local estimate. The identification features
                  and the viewing advice describe things any reader can check from public
                  shoreline. If you own one of these boats and we've gotten a detail wrong, we
                  want to hear it.
                </p>
              </div>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "What is a Streblow boat?",
          answer:
            "A handcrafted wooden sport boat — a mahogany runabout built by Streblow, a Wisconsin builder. The design is defined by a centered engine, wraparound seating, double-plank hull construction, varnished mahogany, and a white stripe along the side.",
        },
        {
          question: "Who started Streblow Boats?",
          answer:
            "Larry Streblow, who began building wooden boats in Wisconsin in the early 1950s. What started as a small operation grew into one of America's longest-running wooden sport boat builders.",
        },
        {
          question: "When did Streblow move to Geneva Lake?",
          answer:
            "In 1987, when the company moved operations closer to Geneva Lake, where many of its customers already kept their boats. That move is what tied the builder to this lake in particular.",
        },
        {
          question: "How do you recognize a Streblow on the water?",
          answer:
            "Look for four things together: the white stripe along a dark varnished mahogany hull; the engine centered in the boat with seating wrapped around it rather than power at the stern; a long, low profile close to the water; and a lower, rounder engine note than a modern outboard. Varnished wood alone isn't enough — Geneva Lake has plenty of other classic wooden boats.",
        },
        {
          question: "Why are Streblows associated with Lake Geneva?",
          answer:
            "Because the builder followed its customers here. Many owners already kept their boats on Geneva Lake before operations moved closer in 1987, and the concentration of boats, the multi-generational ownership, and the annual owners' gatherings all center on this lake.",
        },
        {
          question: "What is Wake the Lake?",
          answer:
            "An annual gathering where Streblow owners bring their boats out on Geneva Lake and cruise together. Dates aren't published on a fixed calendar here — check current event listings.",
        },
        {
          question: "How many Streblows are on Geneva Lake?",
          answer:
            "The figure repeated locally is more than 100 on Geneva Lake, with hundreds more across the country. Treat that as an estimate as it circulates among owners and longtime residents, not a verified registry count — this desk has not reproduced a builder's or harbor list.",
        },
        {
          question: "Where can I see a Streblow without owning a boat?",
          answer:
            "From public shoreline. The 21-mile Lake Geneva Shore Path is the best free vantage point because it keeps you at water level the whole way. The public beaches, piers, and launches work too, and a tour boat from the downtown lakefront lets you see hulls in profile. Fees and seasonal hours vary — check before you go.",
        },
        {
          question: "Are Streblow boats made of wood?",
          answer:
            "Yes. They're handcrafted mahogany runabouts built with double-plank hull construction — two layers of planking rather than one. That's a large part of why boats built decades ago are still in use.",
        },
        {
          question: "When is the best time of year to see classic wooden boats on Geneva Lake?",
          answer:
            "Late spring through fall, since this is a Wisconsin lake that freezes and wooden boats are stored over winter. Early mornings and evenings are the reliable windows. A clear October morning, with fewer boats out, is one of the best times to see a varnished hull properly.",
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
          title: "The Lake Geneva Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb:
            "21 miles of historic walking path around the lake — and the best free vantage point for watching the wooden fleet.",
        },
        {
          title: "Yerkes Observatory",
          path: "/guides/yerkes-observatory",
          blurb:
            "The great dome above Williams Bay — another Lake Geneva Icon, and one that stays put.",
        },
        {
          title: "Things to Do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb:
            "The wider tour: the downtown lakefront, the Riviera, and what's worth your time on and off the water.",
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
