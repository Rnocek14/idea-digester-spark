import { GuideShell } from "@/components/guides/GuideShell";
import { GuideNewsletterCTA } from "@/components/guides/GuideNewsletterCTA";
import { SoftRealEstateCTA } from "@/components/guides/SoftRealEstateCTA";
import { Link } from "react-router-dom";

const TODAY = "2026-06-05";

export default function ThisWeekendLakeGeneva() {
  return (
    <GuideShell
      title="Things to Do in Lake Geneva This Weekend"
      metaTitle="Things to Do in Lake Geneva This Weekend — A Local's Picks"
      metaDescription="A local's shortlist of what's worth your weekend in Lake Geneva, Wisconsin — events, food, the lake, the shore path, and the quieter corners most visitors miss."
      path="/guides/things-to-do-lake-geneva-this-weekend"
      datePublished={TODAY}
      dateModified={TODAY}
      intro={
        <>
          <p>
            Weekend in Lake Geneva is a planning game more than a what-to-do
            game — the lake, the shore path, and a downtown you can cross on
            foot mean the bones of a great weekend are already here. The
            question is mostly which order, and which corners to skip.
          </p>
          <p>
            This is the page The Brief editors hand a friend texting on a
            Friday morning. The{" "}
            <Link to="/events" className="text-blue-700 hover:underline font-medium">
              live events calendar
            </Link>{" "}
            tracks specific dates; this guide is the evergreen frame around it.
          </p>
        </>
      }
      introExtra={
        <div className="not-prose rounded-md border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            What's on right now
          </p>
          <p className="text-slate-700 text-base">
            For dated specifics — concerts, farmers markets, festivals, kid
            programming — see the{" "}
            <Link to="/events" className="text-blue-700 hover:underline font-medium">
              full events calendar
            </Link>
            . This guide is the part that doesn't change week to week.
          </p>
        </div>
      }
      sections={[
        {
          id: "friday",
          heading: "Friday night",
          body: (
            <>
              <p>
                Friday in Lake Geneva is a fish fry, almost without exception.
                It's a Wisconsin contract more than a meal. Our running{" "}
                <Link to="/eats/fish-fry" className="text-blue-700 hover:underline font-medium">
                  fish fry guide
                </Link>{" "}
                tracks who's serving and the current Friday rotation.
              </p>
              <p>
                If a fish fry isn't the move, the supper clubs north of town
                are the second answer — old-school, slow, generous pours.
                Lakeside seating at the Pier 290 patio in Williams Bay or the
                Grand Geneva is the third.
              </p>
              <p>
                After dinner: the Riviera ballroom often has a concert or
                event; downtown stays lively well past sunset in summer. In
                winter, most Fridays are quieter — that's part of the appeal.
              </p>
            </>
          ),
        },
        {
          id: "saturday",
          heading: "Saturday: the full day",
          body: (
            <>
              <p>
                Mornings on the lake belong to the early risers. A coffee from
                a downtown roaster, a bench in Library Park, and the mailboat
                heading out for its 10am run is one of the best free hours in
                town.
              </p>
              <p>
                <strong>The boat decision</strong>: the U.S. Mailboat tour is
                the signature pick (the jumpers actually deliver mail at
                speed). A general lake tour from the Riviera Docks is the
                shorter alternative. Renting your own boat from the Riviera or
                Gage Marine is more doable than people think — call by
                Thursday in summer.
              </p>
              <p>
                <strong>The walk decision</strong>: the Geneva Lake Shore Path
                is 21 miles around the whole lake. Most people do a 2–4 mile
                section. Library Park toward Black Point is the classic
                introduction — historic estates, lake views, public-access
                tradition older than the state.
              </p>
              <p>
                Lunch is downtown or lakeside. Saturday afternoon is for
                independent shops on Main and Broad. Save dinner for a real
                sit-down — book it Friday at the latest in summer.
              </p>
            </>
          ),
        },
        {
          id: "sunday",
          heading: "Sunday: slow it down",
          body: (
            <>
              <p>
                Sundays are quieter on purpose. A long breakfast, the farmers
                market when it's in season, and a drive to{" "}
                <strong>Fontana or Williams Bay</strong> for a different
                shoreline before heading home.
              </p>
              <p>
                Yerkes Observatory in Williams Bay runs Sunday tours and is
                worth the detour. Big Foot Beach State Park is the easier swim
                and picnic answer if Saturday was a marathon. The Geneva Lake
                Museum is the rainy-Sunday save.
              </p>
            </>
          ),
        },
        {
          id: "weather",
          heading: "If the weather turns",
          body: (
            <>
              <p>
                Rainy weekends pivot to the Riviera ballroom (if there's an
                event), the magic theatre downtown, the Geneva Lake Museum,
                Yerkes, and a long lunch somewhere with a view of the lake
                instead of on it. The breweries and tap rooms have grown
                noticeably in the last few years; an afternoon flight is a
                reasonable rain plan.
              </p>
            </>
          ),
        },
        {
          id: "skip",
          heading: "A few honest skips",
          body: (
            <>
              <p>
                If you only have one weekend: skip the inland chains, skip
                trying to drive between every stop downtown (park once, walk
                everywhere), and skip Saturday afternoon at Riviera Beach in
                July unless you arrived by 10am. Edgewater Park in Williams
                Bay is the better afternoon swim answer that week.
              </p>
            </>
          ),
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
          title: "Things to Do in Lake Geneva",
          path: "/guides/things-to-do-lake-geneva",
          blurb:
            "The full evergreen guide — boats, the shore path, downtown, food, and what changes by season.",
        },
        {
          title: "Things to Do With Kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb:
            "Family-friendly weekend planning, from beaches to Yerkes Observatory to the magic theatre downtown.",
        },
      ]}
      faqs={[
        {
          question: "What's the best free thing to do in Lake Geneva on a weekend?",
          answer:
            "Walking a section of the 21-mile Geneva Lake Shore Path. The stretch from Library Park toward Black Point is the easiest introduction and one of the best free experiences in town.",
        },
        {
          question: "Can you do Lake Geneva as a day trip from Chicago or Milwaukee?",
          answer:
            "Yes — Lake Geneva is roughly 90 minutes from both. A focused day with a boat tour, a downtown lunch, and a stretch of the shore path is very doable.",
        },
        {
          question: "Do I need to book a boat tour in advance?",
          answer:
            "In summer, yes — especially the U.S. Mailboat tour and weekend afternoons. Off-season you can often walk up. Renting your own boat is easier with a few days of lead time.",
        },
      ]}
    />
  );
}