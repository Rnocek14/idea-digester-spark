import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const PUBLISHED = "2026-06-05";
const UPDATED = "2026-07-29";

/**
 * District structure at a glance. Every cell restates something explained
 * in the prose below — nothing new is asserted here.
 */
const DISTRICTS: {
  district: string;
  grades: string;
  highSchool: string;
  notes: string;
}[] = [
  {
    district: "Lake Geneva-Genoa City J1",
    grades: "K-8",
    highSchool: "Badger High School",
    notes:
      "The district most people mean by \"Lake Geneva schools.\" Covers the city, Genoa City, and much of the surrounding rural area.",
  },
  {
    district: "Lake Geneva-Genoa City Union High School District",
    grades: "9-12",
    highSchool: "Badger High School (operates it)",
    notes:
      "A separate district from J1. It runs Badger, the area's single comprehensive public high school.",
  },
  {
    district: "Williams Bay",
    grades: "K-12",
    highSchool: "Williams Bay High School (its own)",
    notes:
      "One campus near the lake. The only local district that keeps students K-12 with no handoff at ninth grade.",
  },
  {
    district: "Fontana Joint 8",
    grades: "K-8",
    highSchool: "Badger High School",
    notes:
      "Small K-8 district. The elementary and middle years are the decision; the high school is shared.",
  },
  {
    district: "Linn J4",
    grades: "K-8",
    highSchool: "Badger High School",
    notes:
      "Township district. A Lake Geneva mailing address does not automatically mean J1.",
  },
  {
    district: "Faith Christian School (private)",
    grades: "K-12",
    highSchool: "Its own, in Williams Bay",
    notes:
      "The area's largest private option. Several parochial elementaries serve nearby towns.",
  },
];

/**
 * Official sources. URLs were looked up and verified rather than guessed —
 * these are the districts' own sites and the state's own portals.
 */
const OFFICIAL_SOURCES: { name: string; url: string; covers: string }[] = [
  {
    name: "Lake Geneva J1 School District & Badger High School",
    url: "https://www.lakegenevaschools.com/",
    covers:
      "Serves both the J1 K-8 district and the Union High School District that operates Badger.",
  },
  {
    name: "Williams Bay School District",
    url: "https://www.williamsbayschools.org/",
    covers: "The K-12 single-campus district — enrollment, calendar, contacts.",
  },
  {
    name: "Fontana J8 School District",
    url: "https://www.fontana.k12.wi.us/",
    covers: "The Fontana K-8 district.",
  },
  {
    name: "Linn J4 School District (Traver School)",
    url: "http://www.traverschool.org/",
    covers: "The Linn J4 K-8 district.",
  },
  {
    name: "Wisconsin DPI — School & District Report Cards",
    url: "https://apps6.dpi.wi.gov/reportcards",
    covers:
      "State accountability data for every publicly funded school and district in Wisconsin.",
  },
  {
    name: "Wisconsin DPI — Public School Open Enrollment",
    url: "https://dpi.wi.gov/open-enrollment",
    covers: "Statewide open enrollment rules, the current window, and the application.",
  },
];

const linkClass = "text-blue-700 hover:underline font-medium";

export default function LakeGenevaSchools() {
  return (
    <GuideShell
      title="A Parent's Guide to Schools in the Lake Geneva Area"
      metaTitle="Schools in the Lake Geneva Area — A Parent's Guide"
      metaDescription="An overview of public, private, and surrounding-district schools families consider when moving to the Lake Geneva, Wisconsin area — Lake Geneva-Genoa City J1, Williams Bay, Fontana, Linn, Faith Christian, and more."
      path="/guides/lake-geneva-schools"
      datePublished={PUBLISHED}
      dateModified={UPDATED}
      intro={
        <>
          <p>
            School research is one of the most common reasons families
            reach out about moving to the Lake Geneva area. The system is
            more layered than the name suggests — multiple districts share
            the shoreline, each with its own elementary feeder pattern,
            and a handful of private and parochial options sit alongside.
          </p>
          <p>
            The thing to understand up front: the district that runs your
            child's elementary school is usually not the district that
            runs their high school. Several small K-8 districts operate
            independently, then hand students off to a shared high school.
            Every district's official site is linked near the bottom of
            this page.
          </p>
        </>
      }
      sections={[
        {
          id: "at-a-glance",
          heading: "The districts at a glance",
          body: (
            <>
              <p className="mb-4">
                Each of these is unpacked below. If you read one thing
                here, read the table — it answers the two questions that
                come first: what grades a district actually serves, and
                where its students go to high school.
              </p>
              <div className="not-prose overflow-x-auto rounded-sm border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] text-sm border-collapse">
                  <caption className="sr-only">
                    Lake Geneva area school districts by grades served and
                    the high school their students feed into.
                  </caption>
                  <thead>
                    <tr className="bg-stone-100 border-b border-slate-200">
                      <th
                        scope="col"
                        className="w-[24%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        District
                      </th>
                      <th
                        scope="col"
                        className="w-[12%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        Grades
                      </th>
                      <th
                        scope="col"
                        className="w-[22%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        High school
                      </th>
                      <th
                        scope="col"
                        className="w-[42%] px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500"
                      >
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DISTRICTS.map((row) => (
                      <tr
                        key={row.district}
                        className="border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-stone-50"
                      >
                        <th
                          scope="row"
                          className="px-3 py-3 text-left align-top font-semibold text-slate-900"
                        >
                          {row.district}
                        </th>
                        <td className="px-3 py-3 align-top text-slate-700 font-mono text-xs whitespace-nowrap">
                          {row.grades}
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700 leading-snug">
                          {row.highSchool}
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700 leading-snug">
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 italic mt-3">
                Nothing appears here that isn't explained in the prose.
                Districts set their own boundaries and can change them —
                confirm before acting on it.
              </p>
            </>
          ),
        },
        {
          id: "lgjsd",
          heading: "Lake Geneva-Genoa City J1 School District",
          body: (
            <>
              <p>
                The district most families mean when they say "Lake Geneva
                schools." J1 serves the City of Lake Geneva, Genoa City, and
                much of the surrounding rural area, with a K-8 structure
                that feeds into Badger High School in the separate Lake
                Geneva-Genoa City Union High School District.
              </p>
              <p>
                Because J1 covers both the city and a wide band of rural
                territory, it is where the gap between the town on your
                mail and the school you're assigned to is widest — families
                buying outside the city limits are the ones who most often
                find their address belongs somewhere else. District
                planning has also included facility consolidation
                conversations, which matters for one practical reason: a
                feeder school is a district-level decision, not a fixed
                feature of an address. Check current updates before locking
                onto a building.
              </p>
            </>
          ),
        },
        {
          id: "badger",
          heading: "Badger High School",
          body: (
            <>
              <p>
                Badger High School is the single comprehensive public high
                school for Lake Geneva, Genoa City, and Linn — drawing from
                the J1 K-8 district and several others. The campus is
                substantial for the population it serves; sports, arts, and
                a wide AP slate are all part of the offering.
              </p>
              <p>
                The structural detail worth internalizing is that Badger
                sits in its own district, with its own board, separate from
                J1. That union high school arrangement explains what
                otherwise looks like a contradiction: you can live in one
                K-8 district, attend another district's high school, and
                never have moved. Because several small K-8 districts
                converge here, a child from a very small building arrives
                alongside classmates from several townships — for some
                families that widening is the appeal, and for others it is
                the reason they look hard at Williams Bay.
              </p>
            </>
          ),
        },
        {
          id: "williams-bay",
          heading: "Williams Bay School District",
          body: (
            <>
              <p>
                Williams Bay runs its own K-12 district on a small,
                single-campus model — elementary, middle, and high school
                in one tight footprint near the lake. Class sizes are
                small, and the community engagement around the school is
                noticeably high.
              </p>
              <p>
                It is the structural outlier here, and the difference isn't
                cosmetic: one enrollment relationship, one calendar, no
                handoff at ninth grade, siblings across a wide age range on
                the same campus. For a family expecting to stay through
                graduation, that continuity is the argument. The tradeoff
                is the mirror image of Badger's — a small high school means
                fewer sections and a narrower catalog. Whether that reads
                as a limitation or as the reason to choose it depends on
                the child. The{" "}
                <Link to="/guides/lake-geneva-vs-williams-bay" className={linkClass}>
                  Lake Geneva vs. Williams Bay comparison
                </Link>{" "}
                covers the rest of that decision.
              </p>
            </>
          ),
        },
        {
          id: "fontana-linn",
          heading: "Fontana and Linn districts",
          body: (
            <>
              <p>
                Fontana Joint 8 and Linn J4 are smaller K-8 districts that
                feed into Badger High School (and, in some cases, other
                area high schools via open enrollment). Both are small,
                community-rooted, and frequently part of the appeal of
                choosing those townships.
              </p>
              <p>
                Choosing Fontana or Linn is a decision about the elementary
                and middle years, not about high school — that outcome is
                the one most of the lake shares. These two are also where
                the address problem bites hardest: both townships wrap
                around the city and the shoreline, and homes in them can
                carry mailing addresses that read like other towns
                entirely. Never infer a district from a postal address. If
                Fontana is on your list, the{" "}
                <Link to="/guides/fontana-vs-lake-geneva" className={linkClass}>
                  Fontana and Lake Geneva comparison
                </Link>{" "}
                covers how the two differ beyond schools.
              </p>
            </>
          ),
        },
        {
          id: "private",
          heading: "Private and parochial options",
          body: (
            <>
              <p>
                The area's private options are smaller in number but
                meaningful. Faith Christian School (K-12, in Williams Bay)
                is the largest. Several parochial elementary schools serve
                Lake Geneva and surrounding towns. For Montessori or
                specialized programs, families sometimes commute toward
                Delavan, Burlington, or the northern Illinois border.
              </p>
              <p>
                Two practical notes. Private schools aren't bound by
                district boundaries, which makes them a genuine fallback if
                the attendance-area answer for a house you love turns out
                to be the wrong one. And the parochial elementaries
                generally end before high school, so choosing one still
                leaves a separate high school decision a few years out.
                Tuition and admission requirements vary and change — ask
                each school directly.
              </p>
            </>
          ),
        },
        {
          id: "open-enrollment",
          heading: "Open enrollment, in plain terms",
          body: (
            <>
              <p>
                Open enrollment is the mechanic parents ask about right
                after boundaries. Wisconsin's public school open enrollment
                program lets families apply to attend a public district
                other than the one they live in. You don't have to move to
                apply, and it doesn't require a hardship.
              </p>
              <p>
                The qualifier is that it's an application, not an
                entitlement. Each district decides annually how many seats
                it can accept at each grade level, and space in a
                particular grade in a particular year is usually what
                decides the outcome. The application window runs on an
                annual statewide cycle, so missing it generally means
                waiting a year.
              </p>
              <p>
                Worth asking before you count on it: whether the grade you
                need has space, how transportation works for non-resident
                students, how siblings are treated, and whether an approved
                transfer continues in later years. Those answers come from
                the districts and the state — the{" "}
                <a
                  href="https://dpi.wi.gov/open-enrollment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Wisconsin DPI open enrollment page
                </a>{" "}
                publishes the current rules and window. Treat it as a
                bonus, not a plan: if a specific district is the reason
                you're moving here, buy inside it.
              </p>
            </>
          ),
        },
        {
          id: "verify-address",
          heading: "How to verify a specific address's school assignment",
          body: (
            <>
              <p>
                This is the step families skip, and the one that causes the
                most regret. Because boundaries can change, and because
                several districts overlap a single postal geography here,
                the only reliable answer is the one a district gives you
                about your exact address.
              </p>
              <ol>
                <li>
                  <strong>Start with the district's attendance-area map.</strong>{" "}
                  Confirm the address actually falls inside the district
                  you think it does.
                </li>
                <li>
                  <strong>Call the district office with the street address</strong>{" "}
                  — not the town, not the ZIP. Registrars answer this
                  question constantly.
                </li>
                <li>
                  <strong>Get it in writing before you sign.</strong> An
                  email naming the address and its assigned schools takes
                  minutes to request and settles the question.
                </li>
                <li>
                  <strong>Ask whether anything is under review.</strong>{" "}
                  Consolidation and boundary adjustments are district
                  decisions — ask directly whether the assignment is
                  expected to hold.
                </li>
              </ol>
              <p>
                The trap: a Lake Geneva mailing address does not guarantee
                a J1 attendance area, because Linn and Fontana townships
                surround the city. Listings and third-party school-match
                widgets get this wrong often enough to treat both as a
                starting point, never as confirmation.
              </p>
            </>
          ),
        },
        {
          id: "timing",
          heading: "Timing a move around the school year",
          body: (
            <>
              <p>
                Most families relocating for schools try to close in
                summer, and the reasoning holds up. A summer close means
                starting in September with everyone else, joining a grade
                when friendships are re-forming anyway, and hitting sports
                and activity sign-ups on the normal calendar.
              </p>
              <p>
                Mid-year moves are workable — districts here enroll
                year-round — but they carry friction worth planning for.
                Curriculum sequencing rarely lines up between districts, so
                a transfer can land in the middle of a unit. High school
                course placement may need to wait for a semester boundary.
                Activity rosters are frequently set before a season starts.
              </p>
              <p>
                Paperwork needs lead time too. Districts typically ask for
                proof of residency, immunization records, and records from
                the prior school, and records requests move at the sending
                district's pace, not yours. Ask the registrar for the exact
                document list early. If the budget question is running
                alongside the school question, the{" "}
                <Link to="/guides/cost-of-living-lake-geneva" className={linkClass}>
                  cost-of-living guide
                </Link>{" "}
                and the broader{" "}
                <Link to="/guides/moving-to-lake-geneva" className={linkClass}>
                  moving to Lake Geneva guide
                </Link>{" "}
                are the companion reads.
              </p>
            </>
          ),
        },
        {
          id: "deciding",
          heading: "How families actually choose",
          body: (
            <>
              <p>
                In practice the decision resolves along one of three lines.
                This is a framing rather than a survey, but it is a useful
                way to work out which question you're actually answering.
              </p>
              <ul>
                <li>
                  <strong>Williams Bay specifically.</strong> The K-12
                  single-campus structure is usually part of the reason
                  rather than a coincidence.
                </li>
                <li>
                  <strong>Flexible on town.</strong> Families optimizing
                  for proximity to schools and downtown tend to land in or
                  near the city, which puts them on the J1 and Badger path
                  by default.
                </li>
                <li>
                  <strong>Wanting a small K-8 feel.</strong> Fontana and
                  Linn fit, with Badger shared later — a decision about the
                  elementary years, high school already answered.
                </li>
              </ul>
              <p>
                If you're scouting neighborhoods around a school choice,
                the{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className={linkClass}>
                  neighborhoods guide
                </Link>{" "}
                covers what each shoreline town feels like day to day.
              </p>
            </>
          ),
        },
        {
          id: "official",
          heading: "Official sources to verify",
          body: (
            <>
              <p className="mb-4">
                Always confirm specifics — boundaries, enrollment
                deadlines, and report-card data shift year to year. These
                are the primary sources, not aggregators:
              </p>
              <div className="not-prose rounded-sm border border-slate-200 bg-white divide-y divide-slate-100">
                {OFFICIAL_SOURCES.map((s) => (
                  <div key={s.url} className="p-4">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {s.name}
                    </a>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {s.covers}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                GreatSchools, Niche, and US News publish parent-facing
                profiles of these districts. They're useful for
                orientation, but they are secondary — where they disagree
                with a district or with DPI, the district and DPI are
                right.
              </p>
            </>
          ),
        },
        {
          id: "limits",
          heading: "What this guide can't tell you",
          body: (
            <>
              <p>
                Deliberately absent from this page: report-card scores,
                enrollment deadlines, class sizes, tuition figures, and
                seat counts. All of those reset annually, and a guide that
                printed them would be quietly wrong within a year while
                still reading as authoritative. What's stable is the
                structure — which districts exist, what grades each serves,
                and where students go next. The numbers belong to the
                districts and to{" "}
                <a
                  href="https://apps6.dpi.wi.gov/reportcards"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  the state's report card portal
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
      bottomExtra={
        <>
          <GuideNewsletterCTA />
          <SoftRealEstateCTA variant="housing" />
        </>
      }
      related={[
        {
          title: "Moving to Lake Geneva",
          path: "/guides/moving-to-lake-geneva",
          blurb: "The full relocation guide — what year-round life here actually feels like.",
        },
        {
          title: "Lake Geneva Neighborhoods",
          path: "/guides/lake-geneva-neighborhoods",
          blurb: "What each shoreline town actually feels like, once you've picked a district.",
        },
        {
          title: "Lake Geneva vs. Williams Bay",
          path: "/guides/lake-geneva-vs-williams-bay",
          blurb: "The two towns side by side — the comparison behind the K-12 question.",
        },
        {
          title: "Fontana vs. Lake Geneva",
          path: "/guides/fontana-vs-lake-geneva",
          blurb: "How the west-shore village differs from the city, beyond the K-8 district.",
        },
        {
          title: "Cost of Living in Lake Geneva",
          path: "/guides/cost-of-living-lake-geneva",
          blurb: "What it costs to live here year-round — the other half of the decision.",
        },
      ]}
      faqs={[
        {
          question: "What school district is Lake Geneva, Wisconsin in?",
          answer:
            "The City of Lake Geneva is primarily served by Lake Geneva-Genoa City J1 School District (K-8) and Badger High School in the Lake Geneva-Genoa City Union High School District. Williams Bay, Fontana, and Linn each have their own K-8 districts, with most feeding into Badger for high school.",
        },
        {
          question: "Is Williams Bay School District different from Lake Geneva?",
          answer:
            "Yes — Williams Bay runs its own K-12 district on a small single-campus model, separate from Lake Geneva-Genoa City J1. Families choosing Williams Bay often cite the school as part of the reason.",
        },
        {
          question: "Where do most Lake Geneva area kids go to high school?",
          answer:
            "Most public-school families in Lake Geneva, Fontana, and Linn attend Badger High School. Williams Bay students attend Williams Bay High School. Private options include Faith Christian School and several parochial elementaries.",
        },
        {
          question: "Does Fontana have its own high school?",
          answer:
            "No. Fontana Joint 8 is a K-8 district, and its students go on to Badger High School. Choosing Fontana is a decision about the elementary and middle years.",
        },
        {
          question: "Is Badger the only public high school in the Lake Geneva area?",
          answer:
            "Badger is the single comprehensive public high school serving Lake Geneva, Genoa City, and Linn, operated by the separate Lake Geneva-Genoa City Union High School District. Williams Bay is the exception — it runs its own high school.",
        },
        {
          question: "What grades does Williams Bay School District serve?",
          answer:
            "K-12, on a single campus near the lake. It is the only local district that keeps students from kindergarten through graduation with no handoff to a separate high school district.",
        },
        {
          question: "Do Linn students go to Badger High School?",
          answer:
            "Yes. Linn J4 is a K-8 district that feeds into Badger. In some cases students attend other area high schools through Wisconsin's public school open enrollment program.",
        },
        {
          question: "Are there private schools in the Lake Geneva area?",
          answer:
            "Faith Christian School (K-12, in Williams Bay) is the largest, and several parochial elementary schools serve Lake Geneva and surrounding towns. For Montessori or specialized programs, families sometimes commute toward Delavan, Burlington, or the northern Illinois border.",
        },
        {
          question: "Does a Lake Geneva mailing address mean my child attends Lake Geneva J1 schools?",
          answer:
            "Not necessarily. Linn and Fontana townships surround the City of Lake Geneva, so a home can carry a Lake Geneva mailing address while sitting in a different K-8 district. Check the street address against the district's attendance-area map and get the assignment in writing before signing.",
        },
      ]}
    />
  );
}
