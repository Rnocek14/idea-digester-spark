import { GuideShell } from "@/components/guides/GuideShell";
import WeatherWidget from "@/components/WeatherWidget";
import WeatherForecast from "@/components/WeatherForecast";

/**
 * Evergreen SEO target: "lake geneva weather", "lake geneva wi weather",
 * "lake geneva water temperature", "weather lake geneva wisconsin".
 * Pulls the existing WeatherWidget + 7-day forecast into a dedicated,
 * indexable page with proper schema and on-page content so Google can
 * rank it for local-weather intent against Weather.com / AccuWeather.
 */
export default function LakeGenevaWeather() {
  return (
    <GuideShell
      title="Lake Geneva Weather — Today, Tonight & 7-Day Forecast"
      metaTitle="Lake Geneva, WI Weather — Today, Hourly & 7-Day (2026)"
      metaDescription="Live Lake Geneva, Wisconsin weather: current temperature, wind, sunrise and sunset, and the 7-day forecast — for the lake itself, not the nearest big city."
      path="/lake-geneva-weather"
      dateModified={new Date().toISOString().slice(0, 10)}
      intro={
        <>
          <p>
            Most "Lake Geneva weather" pages on the web actually show you
            Milwaukee or Madison and call it close enough. They're not. The lake
            sits in its own little microclimate — wind comes off the water,
            mornings stay cooler longer, and a summer storm can roll across the
            bay 20 minutes before it reaches the highway. The numbers below are
            for Lake Geneva, Wisconsin (42.59°N, -88.43°W), refreshed live.
          </p>
        </>
      }
      introExtra={
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
            Right now at the lake
          </p>
          <WeatherWidget />
        </div>
      }
      sections={[
        {
          id: "forecast",
          heading: "7-day forecast",
          body: (
            <>
              <p>
                The week ahead, pulled from Open-Meteo for the Lake Geneva
                coordinates. Best read alongside our daily{" "}
                <a href="/today" className="text-blue-700 hover:underline">
                  Lake Report
                </a>{" "}
                — that's where weather meets what's actually happening on the
                lake today.
              </p>
              <div className="not-prose mt-4">
                <WeatherForecast />
              </div>
            </>
          ),
        },
        {
          id: "water-temp",
          heading: "Water temperature & lake conditions",
          body: (
            <>
              <p>
                Geneva Lake is spring-fed and deep (135 ft at its deepest), so
                surface temperature lags the air by weeks in both directions.
                Typical seasonal ranges, based on long-running NOAA and DNR
                observations:
              </p>
              <ul>
                <li><strong>Late May:</strong> 55–62°F — cold for swimming, fine for boating in a wetsuit.</li>
                <li><strong>June:</strong> 65–72°F — swimmable by month's end at shallow beaches.</li>
                <li><strong>July–August:</strong> 75–80°F — peak swim season; warmest at Big Foot Beach and the south shore.</li>
                <li><strong>September:</strong> 70–74°F — often the most pleasant swimming of the year.</li>
                <li><strong>October:</strong> 55–62°F — boating only; the lake holds heat longer than the air.</li>
                <li><strong>December–March:</strong> Lake typically freezes by mid-January in a normal winter; check{" "}
                  <a href="/lake-geneva-webcams" className="text-blue-700 hover:underline">live cams</a>{" "}
                  before driving up for ice fishing.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "when-to-visit",
          heading: "When the weather's best (and worst) at the lake",
          body: (
            <>
              <p>
                <strong>Best stretch:</strong> mid-June through mid-September —
                warm air, warm water, long daylight. The window most locals
                quietly love is the first two weeks of September: lake's still
                swimmable, crowds have thinned, sunsets get dramatic.
              </p>
              <p>
                <strong>Toughest stretch:</strong> February — average highs in
                the low 30s°F, frequent lake-effect cloud cover off the water,
                wind that bites along the Shore Path. Cozy from the inside of a
                tavern; brutal on the boat.
              </p>
              <p>
                <strong>The shoulder weeks worth planning around:</strong> late
                April (Shore Path opens but lake is still 45°F), and the first
                hard freeze in November (boats come out, ice fishing prep
                begins).
              </p>
            </>
          ),
        },
      ]}
      faqs={[
        {
          question: "What's the weather like at Lake Geneva, WI right now?",
          answer:
            "The live conditions box at the top of this page shows the current temperature, wind, and sky conditions for Lake Geneva, Wisconsin — pulled from Open-Meteo for coordinates 42.59°N, -88.43°W, refreshed each time the page loads.",
        },
        {
          question: "How warm is the water in Lake Geneva, Wisconsin?",
          answer:
            "Geneva Lake typically warms to 65–72°F by late June, peaks at 75–80°F in July and August, and stays swimmable into mid-September. It's spring-fed and deep, so it lags air temperature by several weeks in both directions.",
        },
        {
          question: "When does Lake Geneva freeze over?",
          answer:
            "In a normal winter, Geneva Lake freezes by mid-January and stays iced through early March. Some recent mild winters have skipped a full freeze. Ice fishermen track the freeze week-to-week — our daily Lake Report posts ice updates from late December onward.",
        },
        {
          question: "Is there a live weather cam for Lake Geneva?",
          answer:
            "Yes — see our Lake Geneva webcams page for the current list of public cams pointed at the lake, including the Riviera and WeatherBug feeds.",
        },
      ]}
      related={[
        {
          title: "Lake Geneva webcams",
          path: "/lake-geneva-webcams",
          blurb: "Live public cams pointed at the Riviera, the bay, and the sky over Lake Geneva.",
        },
        {
          title: "The daily Lake Report",
          path: "/today",
          blurb: "Weather, water, what's happening on the lake today — refreshed every morning.",
        },
        {
          title: "This weekend at the lake",
          path: "/guides/things-to-do-lake-geneva-this-weekend",
          blurb: "What to do at Lake Geneva this weekend, weather permitting.",
        },
      ]}
    />
  );
}