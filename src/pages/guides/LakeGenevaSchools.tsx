import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function LakeGenevaSchools() {
  return (
    <GuideShell
      title="A Parent's Guide to Schools in the Lake Geneva Area"
      metaTitle="Schools in the Lake Geneva Area — A Parent's Guide"
      metaDescription="An overview of public, private, and surrounding-district schools families consider when moving to the Lake Geneva, Wisconsin area — Lake Geneva-Genoa City J1, Williams Bay, Fontana, Linn, Faith Christian, and more."
      path="/guides/lake-geneva-schools"
      datePublished={TODAY}
      dateModified={TODAY}
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
            This guide is the parent-to-parent overview. For official
            enrollment, calendars, and curriculum, every district links to
            its own site below. For the numbers, GreatSchools, Niche, and
            the Wisconsin DPI report cards are the standard references.
          </p>
        </>
      }
      sections={[
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
                Strengths families consistently mention: small-town class
                sizes, strong elementary programs, and the after-school
                activity scene. Recent district planning has included
                facility consolidation conversations — worth checking the
                district's current updates before locking on a feeder
                school.
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
                For most families relocating into the City of Lake Geneva
                or the immediate area, Badger is the assumed high school
                unless you're choosing private.
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
                For families specifically choosing Williams Bay over Lake
                Geneva proper, the school is often part of the reason.
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
                Families relocating to the Fontana or Linn area typically
                research the K-8 experience separately from the high
                school question, since the high school is shared.
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
            </>
          ),
        },
        {
          id: "deciding",
          heading: "How families actually choose",
          body: (
            <>
              <p>
                Three patterns we hear most often:
              </p>
              <ul>
                <li>
                  <strong>"We want to be in Williams Bay specifically."</strong>{" "}
                  Almost always the school is part of the answer.
                </li>
                <li>
                  <strong>"We're flexible on town."</strong> Most J1 +
                  Badger families end up in or near the City of Lake
                  Geneva for proximity to schools and downtown.
                </li>
                <li>
                  <strong>"We want a small K-8 feel."</strong> Fontana
                  or Linn often fit, with Badger as the shared high
                  school later.
                </li>
              </ul>
              <p>
                If you're scouting neighborhoods around a school choice,
                the{" "}
                <Link to="/guides/lake-geneva-neighborhoods" className="text-blue-700 hover:underline font-medium">
                  neighborhoods guide
                </Link>{" "}
                is the companion read.
              </p>
            </>
          ),
        },
        {
          id: "official",
          heading: "Official sources to verify",
          body: (
            <>
              <p>
                Always confirm specifics — boundaries, enrollment
                deadlines, and report-card data shift year to year:
              </p>
              <ul>
                <li>Lake Geneva-Genoa City J1 (K-8) and Union High School District (Badger)</li>
                <li>Williams Bay School District (K-12)</li>
                <li>Fontana Joint 8 and Linn J4 (K-8)</li>
                <li>Wisconsin DPI School Report Cards for state metrics</li>
                <li>GreatSchools, Niche, and US News for parent-facing comparisons</li>
              </ul>
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
          blurb: "Lake Geneva, Fontana, Williams Bay, and the rest — what each shoreline town actually feels like.",
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
      ]}
    />
  );
}