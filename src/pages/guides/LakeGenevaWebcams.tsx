import { GuideShell } from "@/components/guides/GuideShell";

/**
 * Evergreen SEO target: "lake geneva webcams", "lake geneva wi live cam",
 * "lake geneva weather cam". High repeat-visit potential — links to all
 * known public live cams covering Lake Geneva, WI. We don't embed cams
 * directly because most providers (Yacht Club, Riviera, Grand Geneva)
 * disallow iframing — we link out with clear context instead, which is
 * still better than what Google currently ranks for these terms.
 */
export default function LakeGenevaWebcams() {
  return (
    <GuideShell
      title="Lake Geneva Webcams — Live Views of the Lake"
      metaTitle="Lake Geneva Webcams: Live Lake & Weather Cams (2026)"
      metaDescription="A complete, regularly checked list of live webcams pointed at Lake Geneva, Wisconsin — the Riviera, Geneva Lake, downtown, and weather cams. Updated for 2026."
      path="/lake-geneva-webcams"
      dateModified={new Date().toISOString().slice(0, 10)}
      intro={
        <>
          <p>
            Lake watchers — boaters checking chop before launch, second-home
            owners checking on the ice, parents debating whether to drive up
            for the day — all end up looking for the same thing: a live look at
            the water. Here are the public webcams we've found pointed at Lake
            Geneva, Wisconsin, with notes on what each one shows and when it's
            most useful.
          </p>
          <p className="text-sm text-slate-500 italic">
            If a cam stops working or you know one we're missing, drop us a note
            at the tip line — we keep this list current.
          </p>
        </>
      }
      sections={[
        {
          id: "downtown",
          heading: "Downtown & Riviera cams",
          body: (
            <>
              <p>
                Best for: checking the crowd in Flat Iron Park, watching
                fireworks, or seeing whether the Riviera dock is iced in.
              </p>
              <ul>
                <li>
                  <a
                    href="https://www.visitlakegeneva.com/lake-geneva-webcam/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    Visit Lake Geneva — Riviera Live Cam
                  </a>{" "}
                  — points at the Riviera and Geneva Bay. The most reliable
                  daytime view of downtown.
                </li>
                <li>
                  <a
                    href="https://www.lakegenevawi.com/webcam/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    City of Lake Geneva cam
                  </a>{" "}
                  — when available. The City periodically rotates this feed for
                  events.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "weather",
          heading: "Weather & sky cams",
          body: (
            <>
              <p>
                Best for: spotting an incoming front before it hits, judging
                cloud cover for sunset, or just checking if it's actually
                raining at the lake when it's pouring 50 miles away.
              </p>
              <ul>
                <li>
                  <a
                    href="https://www.weatherbug.com/weather-camera/?cam=LKGNVWI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    WeatherBug — Lake Geneva WI cam
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.windy.com/-Webcams/cameras?42.591,-88.433,11"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    Windy.com — all public cams near Lake Geneva
                  </a>{" "}
                  — aggregator with multiple area angles.
                </li>
              </ul>
              <p>
                For numbers (temp, wind, humidity), see our{" "}
                <a href="/lake-geneva-weather" className="text-blue-700 hover:underline">
                  Lake Geneva weather page
                </a>
                .
              </p>
            </>
          ),
        },
        {
          id: "lake-conditions",
          heading: "What the cams can tell you (and what they can't)",
          body: (
            <>
              <p>
                A webcam is great for one thing — a real, current look at the
                sky and the water. They're less useful for the things people
                often want them for: whether boat launches are open, whether
                the Shore Path is clear, or whether parking lots are full.
              </p>
              <p>
                For those, the right move is our{" "}
                <a href="/today" className="text-blue-700 hover:underline">
                  daily Lake Report
                </a>{" "}
                — it pulls together weather, water temp, sunrise/sunset, and
                what's happening on the lake today, refreshed every morning.
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "Is there a live webcam of Lake Geneva, Wisconsin?",
          answer:
            "Yes. The most reliable public cam is Visit Lake Geneva's Riviera Live Cam, which points at the Riviera and Geneva Bay during daylight hours. WeatherBug also hosts a Lake Geneva, WI weather cam.",
        },
        {
          question: "Can I see the lake conditions in real time?",
          answer:
            "The Riviera cam shows the bay in real time. For numbers — water temperature, wind, wave forecast — see the Lake Geneva weather page; for what's happening on the lake today (events, launches, beach status), see the daily Lake Report.",
        },
        {
          question: "Are there webcams pointed at Big Foot Beach or Williams Bay?",
          answer:
            "Not consistently. Williams Bay has had a Yacht Club cam in past summers but it's not always public; Big Foot Beach State Park does not have a public live cam. We update this page whenever a new public feed comes online.",
        },
      ]}
      related={[
        {
          title: "Lake Geneva weather, today and this week",
          path: "/lake-geneva-weather",
          blurb: "Current temp, wind, sunrise/sunset, and the 7-day forecast — for the lake itself, not the nearest big city.",
        },
        {
          title: "The daily Lake Report",
          path: "/today",
          blurb: "What's on the lake today — weather, water temp, tonight's events, and the morning's top stories.",
        },
      ]}
    />
  );
}