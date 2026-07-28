import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { PageMeta } from "@/components/PageMeta";
import { useCityConfig } from "@/hooks/useCityConfig";

/**
 * The trust layer: About (radical transparency about how an AI-assisted local
 * brief works), Privacy, and Terms. All config-driven so every city gets them
 * for free. For an AI-assisted outlet, publishing exactly how the sausage is
 * made IS the trust play — this is deliberately more disclosure than most
 * local sites offer.
 */

function Shell({ title, description, path, children }: {
  title: string;
  description: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta title={title} description={description} path={path} />
      <PublicHeader />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-10 prose prose-slate prose-sm sm:prose-base">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

export function About() {
  const city = useCityConfig();
  const name = city.site_name;
  return (
    <Shell
      title={`About ${name} — how this works`}
      description={`How ${name} is made: our sources, how automation and editors work together, and how to reach us.`}
      path="/about"
    >
      <h1>About {name}</h1>
      <p>
        {name} is a five-minute daily brief for {city.city_name} — city hall, schools, events,
        dining, safety, and the small stuff that makes a town a town. It is independent,
        locally focused, and built to be read in the time it takes to drink half a coffee.
      </p>

      <h2>How the Brief is made (the honest version)</h2>
      <p>
        We monitor dozens of public sources around the clock: official city and county feeds,
        the National Weather Service, state traffic systems, local news outlets, venue
        calendars, and community submissions. Software does the watching; that is how a small
        team can cover a whole town every day.
      </p>
      <p>
        AI helps us summarize and organize. Every story links to its original source, and our
        pipeline enforces editorial rules that machines follow better than tired humans:
        sensitive matters (arrests, deaths, anything involving minors) are automatically
        withheld or stripped of personal details until an official release exists; unverified
        reports are always labeled <em>Unconfirmed</em>; aggregated content can never publish
        without a primary source. When something is quiet, we say it is quiet — we do not
        invent news to fill space.
      </p>

      <h2>Corrections</h2>
      <p>
        We fix mistakes fast and visibly. If we got something wrong, email{" "}
        <a href={`mailto:${"newsletter@citybrief.info"}`}>newsletter@citybrief.info</a> with a
        link to the story. Corrections are applied to the story itself, not buried.
      </p>

      <h2>Support &amp; advertising</h2>
      <p>
        The Brief is free for readers and supported by local sponsors and community
        advertisers. Sponsored placements are always labeled. Sponsors never see stories
        before publication and have no say in coverage.
      </p>

      <h2>Tips</h2>
      <p>
        See something happening? <a href="/submit">Send a tip</a> — or use the quick-report
        button on the live incidents panel. We read everything.
      </p>
    </Shell>
  );
}

export function Privacy() {
  const city = useCityConfig();
  return (
    <Shell
      title={`Privacy — ${city.site_name}`}
      description={`What ${city.site_name} collects, why, and your choices.`}
      path="/privacy"
    >
      <h1>Privacy Policy</h1>
      <p><em>Last updated: July 2026</em></p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Email address</strong> — if you subscribe to the newsletter, join a
          waitlist, or contact us. Used only to send you what you asked for.
        </li>
        <li>
          <strong>Zip code / approximate location</strong> — only when you use the city
          finder and only after you tap the location button or type a zip. Location is used
          in your browser to match you to the nearest city; it is stored only if you join a
          waitlist (with your email and zip) so we know where to launch next.
        </li>
        <li>
          <strong>Reading activity</strong> — anonymous, aggregate signals (opens, clicks,
          which stories get read) that tell us what coverage matters. We use a random
          session identifier, not an account or profile of you.
        </li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>Sell or rent your personal information.</li>
        <li>Track your location in the background — location is only read when you tap the button.</li>
        <li>Require an account to read anything.</li>
      </ul>

      <h2>Email</h2>
      <p>
        Every email we send includes a one-click unsubscribe. Unsubscribing takes effect
        immediately.
      </p>

      <h2>Your choices</h2>
      <p>
        Want your email or waitlist entry deleted? Send a request to{" "}
        <a href="mailto:newsletter@citybrief.info">newsletter@citybrief.info</a> and we will
        remove it.
      </p>
    </Shell>
  );
}

export function Terms() {
  const city = useCityConfig();
  return (
    <Shell
      title={`Terms of Use — ${city.site_name}`}
      description={`Terms of use for ${city.site_name}.`}
      path="/terms"
    >
      <h1>Terms of Use</h1>
      <p><em>Last updated: July 2026</em></p>
      <p>
        Welcome to {city.site_name}. By using this site you agree to these terms.
      </p>
      <h2>Content</h2>
      <p>
        Our summaries link to and credit original sources; underlying reporting belongs to
        its publishers. Incident information is provided for community awareness, is not an
        official record, and may be unverified or change as situations develop — do not rely
        on it for emergencies. In an emergency, call 911.
      </p>
      <h2>Submissions</h2>
      <p>
        By submitting tips, events, or community posts you grant us the right to publish and
        edit them. Do not submit content that is false, unlawful, or infringes others'
        rights.
      </p>
      <h2>No warranties</h2>
      <p>
        The site is provided "as is" without warranties of any kind. We are not liable for
        decisions made based on the information here.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:newsletter@citybrief.info">newsletter@citybrief.info</a>
      </p>
    </Shell>
  );
}
