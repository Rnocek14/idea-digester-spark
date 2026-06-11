import { GuideShell } from "@/components/guides/GuideShell";

const TODAY = "2026-06-11";

/**
 * SEO play: capture the long-tail question keywords that have near-zero KD
 * but real volume (how far, how deep, how big, swim, worth visiting, etc).
 * One page, one FAQPage schema, many question-targeted answers.
 */
export default function LakeGenevaFAQ() {
  return (
    <GuideShell
      title="Lake Geneva, Wisconsin: Everything You're Wondering"
      metaTitle="Lake Geneva WI FAQ — Distance, Depth, Size & Visits"
      metaDescription="Quick local answers about Lake Geneva, WI: distance from Chicago and Milwaukee, depth, size, swimming, weather, and when to visit."
      path="/guides/lake-geneva-faq"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            People ask the same handful of questions about Lake Geneva before
            they ever set foot here — how far is it from Chicago, can you swim
            in it, is it actually worth the drive. This page answers them
            straight, from people who live here. No fluff, no SEO filler.
          </p>
          <p>
            If you want what's happening <em>today</em> — events, road
            closures, what's open — check the homepage. If you're planning a
            visit or a move, start here.
          </p>
        </>
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
                <li><strong>From Milwaukee:</strong> ~50 miles, 55 minutes via I-43 S.</li>
                <li><strong>From Madison:</strong> ~75 miles, 1 hr 20 min via US-12 E.</li>
                <li><strong>From the Wisconsin Dells:</strong> ~115 miles, about 2 hours.</li>
                <li><strong>From Rockford, IL:</strong> ~50 miles, 1 hour.</li>
              </ul>
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
                <li><strong>Size:</strong> 5,400 acres (about 8.4 square miles)</li>
                <li><strong>Length:</strong> 7.6 miles end to end</li>
                <li><strong>Max depth:</strong> 144 feet</li>
                <li><strong>Average depth:</strong> ~62 feet</li>
                <li><strong>Shoreline:</strong> 21 miles, almost entirely walkable via the public Shore Path</li>
                <li><strong>Water clarity:</strong> typically 15–25 feet of visibility</li>
              </ul>
              <p>
                Yes, you can swim in it. Public beaches include Riviera Beach
                downtown, Williams Bay Beach, and Fontana Beach. Water
                temperatures peak around 75°F in late July and early August.
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
                If you're coming from out of state for a single weekend,
                fall or summer. If you've got a day, downtown plus a Shore
                Path walk is plenty.
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
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "How far is Lake Geneva, Wisconsin from Chicago?",
          answer:
            "About 80 miles, or a 1 hour 30 minute drive via I-94 West and US-12 West. Add 30 minutes or more on summer Friday afternoons.",
        },
        {
          question: "How far is Lake Geneva from Milwaukee?",
          answer:
            "About 50 miles, or 55 minutes by car via I-43 South. It's the closest big city to Lake Geneva.",
        },
        {
          question: "How far is Lake Geneva from Madison, Wisconsin?",
          answer:
            "About 75 miles, or a 1 hour 20 minute drive via US-12 East.",
        },
        {
          question: "How far is Lake Geneva from the Wisconsin Dells?",
          answer:
            "About 115 miles, or roughly 2 hours by car. They are not close — they are at opposite ends of the state's tourism map.",
        },
        {
          question: "How deep is Lake Geneva, Wisconsin?",
          answer:
            "Geneva Lake has a maximum depth of 144 feet and an average depth of about 62 feet. It is one of the deepest natural lakes in southern Wisconsin.",
        },
        {
          question: "How big is Lake Geneva, Wisconsin?",
          answer:
            "The lake covers 5,400 acres (about 8.4 square miles), measures 7.6 miles end to end, and has a 21-mile shoreline that is almost entirely walkable via the public Shore Path.",
        },
        {
          question: "How many acres is Lake Geneva?",
          answer:
            "Geneva Lake is approximately 5,400 acres.",
        },
        {
          question: "Can you swim in Lake Geneva, Wisconsin?",
          answer:
            "Yes. Public beaches include Riviera Beach in downtown Lake Geneva, Williams Bay Beach, and Fontana Beach. Peak water temperatures hit around 75°F in late July and early August.",
        },
        {
          question: "What county is Lake Geneva, Wisconsin in?",
          answer:
            "Lake Geneva is in Walworth County, in the southeast corner of Wisconsin.",
        },
        {
          question: "What time zone is Lake Geneva in?",
          answer:
            "Central Time (CT/CDT), the same as Chicago and Milwaukee.",
        },
        {
          question: "Is Lake Geneva, Wisconsin worth visiting?",
          answer:
            "Yes, especially in fall (September–October) when the weather is warm, crowds thin out, and restaurants don't have waits. Summer is the busy season — beautiful but expect traffic and full parking lots.",
        },
        {
          question: "When is the best time to visit Lake Geneva?",
          answer:
            "Locals favor September and early October — warm days, fall colors on the Shore Path, no summer crowds. Peak season is June through August. Winterfest in early February is also a real draw for ice-sculpture fans.",
        },
        {
          question: "Where should I eat in Lake Geneva, Wisconsin?",
          answer:
            "Downtown classics include Next Door Pub, Egg Harbor Cafe for breakfast, and Sopra for a nicer dinner. Pier 290 in Williams Bay is the lakeside view spot. Fish fries on Friday nights are a Wisconsin tradition worth doing at least once.",
        },
        {
          question: "Where should I stay in Lake Geneva?",
          answer:
            "Grand Geneva Resort and The Abbey Resort are the two destination resorts. Downtown has smaller inns and B&Bs within walking distance of restaurants and the lakefront. Book several weeks ahead for summer weekends.",
        },
        {
          question: "Is Geneva Lake the same as Lake Geneva?",
          answer:
            "The lake itself is technically named Geneva Lake. The city on its north shore is Lake Geneva. Locals use both. Don't confuse it with Geneva-on-the-Lake in Ohio, which is a different place entirely.",
        },
      ]}
      related={[
        {
          title: "Things to Do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb: "A local's guide to what's actually worth your weekend.",
        },
        {
          title: "The Geneva Lake Shore Path",
          path: "/guides/lake-geneva-shore-path",
          blurb: "The full 21-mile public path that loops the entire lake.",
        },
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "What it's actually like to live here year-round.",
        },
        {
          title: "Lake Geneva Public Access Guide",
          path: "/guides/lake-geneva-public-access-guide",
          blurb: "Beaches, boat launches, parks, and parking that locals use.",
        },
      ]}
    />
  );
}