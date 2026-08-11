import { Link } from "react-router-dom";
import { GuideShell } from "@/components/guides/GuideShell";
import { localBusinessJsonLd } from "@/lib/seo/jsonLd";

/**
 * Business page — targets the directory query "yogeeze lake geneva", which
 * already shows up in Search Console impressions with nothing of ours to land
 * on. Facts here are limited to what's on the business's own site and the
 * visitor bureau listing; hours are described as seasonal because downtown
 * shops change them and we won't publish a number we can't stand behind.
 */
export default function YogeezeFrozenYogurt() {
  return (
    <GuideShell
      title="Yogeeze Frozen Yogurt, Lake Geneva"
      metaTitle="Yogeeze Frozen Yogurt, Lake Geneva WI — Hours & What to Know"
      metaDescription="Yogeeze Frozen Yogurt on Center Street in downtown Lake Geneva: self-serve flavors, 75+ toppings, yogurt pies, dairy-free options, address and phone."
      path="/businesses/yogeeze-frozen-yogurt"
      dateModified={new Date().toISOString().slice(0, 10)}
      extraJsonLd={[
        localBusinessJsonLd({
          type: "IceCreamShop",
          name: "Yogeeze Frozen Yogurt",
          description:
            "Self-serve frozen yogurt shop in downtown Lake Geneva with rotating flavors, a large topping bar, dairy-free sorbet and made-to-order yogurt pies.",
          streetAddress: "253 Center St, Suite 300",
          telephone: "+1-262-203-5550",
          url: "https://yogeeze.com/",
          path: "/businesses/yogeeze-frozen-yogurt",
        }),
      ]}
      intro={
        <>
          <p>
            Yogeeze is the self-serve frozen yogurt shop in the Lake Geneva Town
            Centre on Center Street — a half block off the busiest stretch of
            downtown, which is exactly why it works as the after-dinner stop.
            You weigh your own cup, the flavor list rotates, and the topping bar
            is the real draw for anyone walking in with kids.
          </p>
          <p className="text-sm text-slate-600">
            253 Center St, Suite 300, Lake Geneva ·{" "}
            <a href="tel:+12622035550" className="text-blue-700 hover:underline">
              (262) 203-5550
            </a>{" "}
            ·{" "}
            <a
              href="https://yogeeze.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              yogeeze.com
            </a>
          </p>
        </>
      }
      sections={[
        {
          id: "what-it-is",
          heading: "What it is",
          body: (
            <>
              <p>
                Self-serve, by weight. The shop lists roughly fifteen rotating
                yogurt flavors and more than seventy-five toppings — fresh
                fruit, candy, nuts, sauces — plus non-dairy sorbet, custard and
                gelato. Gluten-free and no-sugar-added options are part of the
                regular lineup rather than a special request.
              </p>
              <p>
                The thing locals order ahead is the yogurt pie. They can be
                pre-ordered by phone or picked up in store, which is why they
                turn up at a lot of Lake Geneva birthday parties in July.
              </p>
            </>
          ),
        },
        {
          id: "hours-parking",
          heading: "Hours and parking",
          body: (
            <>
              <p>
                Yogeeze keeps long summer evening hours — generally mid-morning
                until 9 or 10pm, later on Fridays and Saturdays. Like most of
                downtown, the off-season schedule tightens up, so call ahead
                between November and April rather than trusting a listing.
              </p>
              <p>
                Parking is the usual downtown situation: metered street spots on
                Center and Broad, with the larger public lots a short walk off.
                On a warm Saturday the walk is shorter than the hunt for a
                closer space.
              </p>
            </>
          ),
        },
        {
          id: "nearby",
          heading: "What's nearby",
          body: (
            <p>
              It's a two-minute walk to Flat Iron Park and the lakefront, which
              makes the natural version of this stop a walk down to the water
              with a cup in hand. If you're building a whole evening around it,
              the{" "}
              <Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline">
                Shore Path
              </Link>{" "}
              starts a block away, and the{" "}
              <Link to="/best-of/restaurants-lake-geneva" className="text-blue-700 hover:underline">
                downtown restaurant list
              </Link>{" "}
              covers dinner first.
            </p>
          ),
        },
      ]}
      faqs={[
        {
          question: "Where is Yogeeze in Lake Geneva?",
          answer:
            "Yogeeze Frozen Yogurt is at 253 Center St, Suite 300, in the Lake Geneva Town Centre in downtown Lake Geneva, Wisconsin — about two blocks from the lakefront.",
        },
        {
          question: "Does Yogeeze have dairy-free options?",
          answer:
            "Yes. Alongside frozen yogurt, Yogeeze lists non-dairy sorbet, plus gluten-free and no-sugar-added options.",
        },
        {
          question: "Can you order a yogurt pie from Yogeeze?",
          answer:
            "Yes. Yogeeze yogurt pies can be pre-ordered by phone at (262) 203-5550 or bought in store when available.",
        },
      ]}
      related={[
        {
          title: "Lake Geneva with kids",
          path: "/guides/things-to-do-lake-geneva-with-kids",
          blurb: "Family-friendly stops across the lake, including the dessert ones.",
        },
        {
          title: "Local businesses",
          path: "/businesses",
          blurb: "The shops, groceries and everyday places people actually ask about.",
        },
      ]}
    />
  );
}