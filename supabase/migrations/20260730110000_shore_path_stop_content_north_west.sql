-- Sourced write-ups for the west-end and north-shore Shore Path stops, plus
-- five factual corrections to the original seed.
--
-- HOW THIS WAS RESEARCHED, AND WHAT THAT MEANS FOR THE READER
-- Facts here come from web research against the publishers named in each stop's
-- `sources` array. The research environment could not open primary pages
-- directly (egress policy blocked every fetch), so findings rest on search
-- summaries cross-checked across independent results. That is good enough to
-- draft from and NOT good enough to call verified, so:
--   * history_confidence is set honestly per stop, and 'traditional' is used for
--     material that is widely repeated locally with no primary record reproduced
--   * every volatile fact (fees, hours, season dates, tour prices) is written so
--     it can be wrong without misleading anyone, or omitted entirely
--   * anything a source could not establish was left out rather than inferred
-- Before this runs in front of readers it wants one verification pass: the
-- village clerks for park facts and fees, the Yerkes Future Foundation for tour
-- pricing, NPS/WHS for register dates.
--
-- CORRECTIONS THIS MIGRATION MAKES
-- 1. Cedar Point is NOT a public park. It is a private residential subdivision
--    (Cedar Point Park Association, 481 lots, eight association-owned lakefront
--    "parkways" and shared piers). The Shore Path crosses it as a public
--    easement; the lawns, parks and piers are private. The seed called it "a
--    wooded public park," which would have directed readers onto private
--    residential property — the precise error that costs a community its
--    goodwill and, eventually, its easement. Rewritten, and renamed.
-- 2. Kishwauketoe is 231 acres, not 230.
-- 3. "Williams Bay Lakefront Park" is not an official village park name. The
--    lakefront is Edgewater Park plus the adjacent Williams Bay Beach with the
--    municipal pier. Renamed to what the village actually calls it.
-- 4. The village concert series does NOT happen at the lakefront park. "Music by
--    the Lake" is staged at the Ferro Pavilion on the George Williams College
--    (Aurora University) campus, and its listing currently shows the venue as
--    closed. Claim removed rather than relocated, since a 2026 season could not
--    be confirmed either way.
-- 5. The Abbey harbor is not "one of the largest inland marinas in the Midwest."
--    No source makes that claim. The marina's own narrower claim — the only
--    protected harbor on Geneva Lake — is attributed as its claim, and the
--    concrete sourced facts replace the superlative.
-- Also softened: Fontana Beach's "longest unbroken sightline" (geometrically
-- reasonable, documented nowhere) and the Abbey "public sidewalk" routing, which
-- the official village map indicates is the Abbey Harbor Bridge.

-- ---------------------------------------------------------------------------
-- Fontana Beach
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'Fontana''s public swimming beach at the west end of Geneva Lake, a wide sand beach with a broad grassy area, a beach house with changing rooms, restrooms and concessions, and a pay-station lot behind it. Lifeguards are on duty daily from Memorial Day weekend through Labor Day. It is a paid beach — day passes are sold at the beach house, and season passes cost residents a small fraction of the non-resident rate. Walkers should note the restrooms sit inside the paid gate; Reid Park, a block away, has free public ones.',
  look_for =
    'The swimming pier reaching out from the sand — it marks the edge of the guarded water, with the beach house and pay station directly behind the grass.',
  story_long =
    'The village around this beach was organised strikingly late compared with the lakefront it sits on. On 15 April 1924 more than a hundred people packed Fontana''s Woodman Hall for a town meeting, and by that September the village was independently governed, electing L. G. Buckles its first president on 9 September 1924. The name is far older: seven families from the present townships of Walworth and Sharon met at the home of Matthias Mohr on 25 September 1839 and organised under the name Fontana, and although the territorial legislature renamed the township Walworth in 1842 without consulting anyone, Fontana survived attached to the village. Accounts of the name''s origin disagree — Italian for fountain, French for a place of many springs, or a Potawatomi word — but all of them point at the springs feeding the lake''s west end. The year before incorporation, twenty citizens of Fontana, Walworth and Harvard bought a 690-acre lakefront tract from the estate of Chicago businessman Levi Z. Leiter, a former partner of Marshall Field, who had run the west-end land as a farm and fish hatchery fed by those same springs.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://vi.fontana.wi.gov/visit-fontana/beach/", "publisher": "Village of Fontana", "supports": "Hours, lifeguard season, day rates, beach house facilities"},
    {"url": "https://vi.fontana.wi.gov/about/history/", "publisher": "Village of Fontana", "supports": "1924 incorporation, Woodman Hall meeting, first village president"},
    {"url": "https://atthelakemagazine.com/from-past-to-present-100-years-in-fontana/", "publisher": "At The Lake Magazine", "supports": "1839 Mohr meeting, name origin accounts, Leiter tract"},
    {"url": "https://www.visitlakegeneva.com/listing/village-of-fontana-beach/946/", "publisher": "VISIT Lake Geneva", "supports": "West shore location, beach facilities, pay-station lot"}
  ]'::jsonb
WHERE slug = 'fontana-beach';

-- ---------------------------------------------------------------------------
-- Reid Park
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'A small lakefront village park off Fontana Boulevard at Third Avenue, a block from the beach and across from the Abbey harbour. There is a pirate-ship playground, a softball diamond, picnic tables and a lakefront gazebo the village rents out. For walkers this is the practical base at the Fontana end of the path: it is a listed access point, it is free, and it has public restrooms and drinking water — which the beach''s facilities, inside the paid gate, do not offer you.',
  look_for =
    'The bronze "One Last Glance" by Jay and Barbara Brost, showing Chief Big Foot looking back at Geneva Lake. It stands in the open, in full view from the path.',
  story_long =
    'The ground under this park is among the longest-used on the lake: a Potawatomi village stood at the west end as early as 1695, and the Shore Path follows a route the Potawatomi under Chief Big Foot used between their villages long before European settlement. The Potawatomi signed the Treaty of Chicago in 1833, and Big Foot''s band was forcibly removed by the United States government in 1836 and resettled toward Kansas — the departure the Brosts'' sculpture commemorates. After the Great Chicago Fire of 1871 the same shoreline route became the working path serving the summer estates of wealthy Chicago families, and it survives as a walkable loop because the early settlers established that roughly the first twenty feet up from the water be kept in public use, with each landowner maintaining the stretch crossing their own frontage.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://vi.fontana.wi.gov/visit-fontana/local-parks/", "publisher": "Village of Fontana", "supports": "Location, playground, gazebo rental, facilities"},
    {"url": "https://www.visitlakegeneva.com/listing/reid-park/288/", "publisher": "VISIT Lake Geneva", "supports": "Potawatomi village at the west end by 1695; the Brost sculpture"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "Potawatomi route, post-1871 estate path, the twenty-foot public reservation"},
    {"url": "https://en.wikipedia.org/wiki/Big_Foot_Beach_State_Park", "publisher": "Wikipedia", "supports": "Treaty of Chicago 1833 and the 1836 removal"}
  ]'::jsonb
WHERE slug = 'reid-park';

-- ---------------------------------------------------------------------------
-- Abbey Harbor — superlative removed, routing softened
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'Here the path reaches the mouth of Abbey Harbor, cut into the shoreline for The Abbey Resort. The village''s own Shore Path map routes walkers over the Abbey Harbor Bridge rather than along a village sidewalk, and the crossing is free and open at any hour — but the marina, its clubhouse and its bars are private and not for path users, and the docks are patrolled overnight. Stay on the marked crossing. Reid Park, a minute west, is the nearest public restroom.',
  look_for =
    'The Abbey''s 80-foot A-frame lodge roofline rising above the harbour — the most recognisable silhouette at the lake''s west end, and a deliberate echo of the European abbeys the resort was named for.',
  story_long =
    'The harbour you are looking at did not exist before 1962. The Abbey was built by Project Fontana, Inc., a group of investors headed by Fred Gartz of Lake Geneva, and designed by the Chicago architecture and engineering firm Epstein; Wisconsin governor Gaylord Nelson presided over the groundbreaking in 1962, launching a roughly four-million-dollar project. Making the harbour meant hydraulically dredging some 242,000 cubic yards of earth, which was pumped back onto the resort grounds and raised the land about six feet. The resort opened year-round in May 1963 with 225 rooms and a marina of 250 planned slips; the marina opened with 300 and now reports more than 400, and its original docks were replaced with galvanised steel floating docks in 2017 and 2018. The name was taken from the great abbeys of Europe, regarded in the Middle Ages as havens of hospitality and good food — which is where the lodge''s quasi-ecclesiastical roofline comes from. The marina describes itself as the only protected harbour on Geneva Lake.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.theabbeyresort.com/resort/history/", "publisher": "The Abbey Resort", "supports": "1962 groundbreaking, Gov. Nelson, Project Fontana Inc., Fred Gartz, May 1963 opening, 225 rooms, 242,000 cubic yards dredged, six-foot fill, name origin"},
    {"url": "https://www.epsteinglobal.com/news/throwback-thursday-the-abbey", "publisher": "Epstein", "supports": "Epstein as architect and engineer"},
    {"url": "https://abbeymarina.com/abbey-marina/history/", "publisher": "Abbey Marina", "supports": "Marina opened 1963 with 300 slips; the only-protected-harbour claim, as the marina''s own"},
    {"url": "https://maricorp.com/the-abbey-marina/", "publisher": "MariCorp US", "supports": "2017-2018 dock replacement"},
    {"url": "https://www.williamsbay.org/1344/Geneva-Lake-Shore-Path-Map", "publisher": "Williams Bay Recreation Department", "supports": "Abbey Harbor Bridge as the path access point"}
  ]'::jsonb
WHERE slug = 'abbey-harbor-view';

-- ---------------------------------------------------------------------------
-- Kishwauketoe — acreage corrected to 231
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'A 231-acre village-owned nature preserve on the north side of the lake, protecting wetland, restored tall-grass prairie, oak savanna, woodland and two small creeks. More than four miles of trail, including a boardwalk over the wetland, are open dawn to dusk year-round with no fee, and leashed dogs are welcome. Shore Path walkers usually enter from Geneva Street, across from the beach or the boat launch; the main entrance is at 251 Elkhorn Road, with parking across the road at the Lion''s Club Field House.',
  look_for =
    'The raised wooden boardwalk running out over the wetland — the one built structure on the trail system, and the clearest sign you have left the lakefront.',
  story_long =
    'After the area''s rail line was decommissioned, developers pursued this tract for a proposed boat lagoon, hotels, shopping and a golf community. The Williams Bay village board bought it instead, for $1,575,000 in 1990, and on 1 July 1990 dedicated it as a protected conservancy under the motto "Dedicated to the Children of Tomorrow." The ground was historically tall-grass prairie threaded with wetland and oak savanna, and the site is now recognised by the Old-Growth Forest Network. The name comes from Potawatomi and is usually rendered locally as "Clear Water" or "Lake of the Sparkling Water" — a translation this desk has seen repeated widely but has not been able to check against a linguistic authority.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.friendsofknc.org/about-history", "publisher": "Friends of Kishwauketoe", "supports": "231 acres, the $1,575,000 purchase, 1 July 1990 dedication, the motto, the development that was proposed instead"},
    {"url": "https://www.friendsofknc.org/trails-maps", "publisher": "Friends of Kishwauketoe", "supports": "Entrances, parking, dawn-to-dusk access, no fee, leashed dogs"},
    {"url": "https://www.williamsbay.org/1209/Kishwauketoe-Nature-Conservancy", "publisher": "Village of Williams Bay", "supports": "Village ownership"},
    {"url": "https://www.oldgrowthforest.net/wi-kishwauketoe-nature-conservancy", "publisher": "Old-Growth Forest Network", "supports": "Network designation"}
  ]'::jsonb
WHERE slug = 'kishwauketoe-edge';

-- ---------------------------------------------------------------------------
-- Edgewater Park — honest about having no sourced history
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'The village''s public lakefront green, next to Williams Bay Beach, and the standard north-shore access point for the Shore Path — route guides label it Access Point A. Playground, picnic areas, grilling, a veterans'' memorial, shaded lawn, and a shelter with public restrooms. The park itself is free; the swimming beach next door charges. This is one of only a handful of places on the whole 21-mile path with both public restrooms and water, so fill your bottle here.',
  look_for =
    'The veterans'' memorial on the lawn between the playground and the water — the one commemorative marker in the park, and a useful landmark for finding where the path begins.',
  story_long =
    'This desk could not find a sourced founding history for Edgewater Park — no acquisition date, donor or dedication — and would rather say so than invent one. Its significance here is functional: it is the north-shore trailhead for a public easement that predates the village''s modern parks and runs roughly twenty-one miles around Geneva Lake. If you know the park''s history, we would genuinely like to hear from you.',
  history_confidence = 'thin',
  sources = '[
    {"url": "https://www.visitlakegeneva.com/listing/edgewater-park/286/", "publisher": "VISIT Lake Geneva", "supports": "Playground, shelter with public restrooms, grilling, adjacency to the beach"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "Edgewater Park as Access Point A; where restrooms and water exist along the path"},
    {"url": "https://www.williamsbay.org/1344/Geneva-Lake-Shore-Path-Map", "publisher": "Williams Bay Recreation Department", "supports": "The village''s own Shore Path map and access points"}
  ]'::jsonb
WHERE slug = 'edgewater-park';

-- ---------------------------------------------------------------------------
-- Williams Bay Beach — renamed; concert claim removed; sailing school kept
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  name = 'Williams Bay Beach & Municipal Pier',
  short_label = 'Williams Bay Beach',
  description =
    'The village''s main public swimming beach, alongside Edgewater Park: sand, shaded lawn, a bath house with showers, the municipal pier and the boat launch. Lifeguards are on duty Memorial Day through Labor Day, and there is a beach fee for anyone twelve and over. Hours and rates are set annually, so check with the village rather than trusting a number you read anywhere — including here.',
  look_for =
    'The sailing school fleet off the pier — Optimists, Club 420s, Sonars, and the distinctive Class X scows, a class raced almost nowhere outside the Geneva Lake area. On a summer morning the small-boat traffic is the liveliest sight on this stretch.',
  story_long =
    'The Geneva Lake Sailing School has taught out of Williams Bay since 1938 and still runs junior and adult programmes here, taking beginners from about age five; its fleet is why the water off this pier is usually full of small boats. One correction to what this guide previously said: the village concert series does not happen at the lakefront. "Music by the Lake" is staged at the Ferro Pavilion on the George Williams College campus, and at the time of writing that venue''s listing shows it closed, so we have removed the claim rather than move it — we could not confirm a current season either way.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.glss.org/", "publisher": "Geneva Lake Sailing School", "supports": "Teaching at Williams Bay since 1938, programmes, fleet"},
    {"url": "https://www.travelwisconsin.com/beaches-pools/williams-bay-beach-330487", "publisher": "Travel Wisconsin", "supports": "Sand beach, bath house with showers, lifeguards Memorial Day to Labor Day"},
    {"url": "https://www.wibandshellsandstands.com/williams-bay-ferro-pavilion.html", "publisher": "Wisconsin Bandshells & Stands", "supports": "Music by the Lake is at the Ferro Pavilion on the George Williams College campus"}
  ]'::jsonb
WHERE slug = 'williams-bay-lakefront';

-- ---------------------------------------------------------------------------
-- Yerkes Observatory
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'The 1897 observatory sits on a rise above the lake, a short climb up from the path. It is a University of Chicago foundation widely called the birthplace of modern astrophysics, and it holds the 40-inch Great Refractor — still the largest refracting telescope ever built for practical astronomical use. The grounds and arboretum are free and open sunrise to sunset except during private events, so a walker can see the building and its landscape without a ticket. The interior is open by booked tour only, tickets online, and prices and days change by season.',
  look_for =
    'The great dome — 280,000 pounds of rotating steel over the Great Refractor, the tallest thing on the hill — above Henry Ives Cobb''s round-arched, Romanesque-influenced facade.',
  story_long =
    'George Ellery Hale, then a young University of Chicago astronomer, talked the Chicago transit magnate Charles Tyson Yerkes into paying for it, and the observatory was dedicated on 21 October 1897 with a founding conference of astronomers. Hale''s real innovation was architectural: he paired the observing domes with machine, optical and photographic laboratories and a research library, which is what made Yerkes an astrophysics institute rather than a shed with a telescope in it. The Great Refractor''s two 40-inch lenses, one crown glass and one flint, each weigh about 500 pounds and were figured by Alvan Clark & Sons of Cambridge, Massachusetts; they hang in a tube some sixty feet long weighing about six tons. E. E. Barnard used it in 1916 to establish the record proper motion of the star now called Barnard''s Star, a record that still stands. Under Otto Struve''s direction from 1932 to 1947 the staff included Subrahmanyan Chandrasekhar and Gerard Kuiper, both later household names in their fields, and W. W. Morgan, co-author of the spectral classification system still in use; Edwin Hubble did his graduate work on faint nebulae here before leaving for Mount Wilson. The University ceased operations on site on 1 October 2018; the nonprofit Yerkes Future Foundation took ownership on 1 May 2020 and reopened the building to the public in May 2022.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://yerkesobservatory.org/visit/plan-a-visit/", "publisher": "Yerkes Future Foundation", "supports": "Grounds free sunrise to sunset; interior by ticketed tour, booked online"},
    {"url": "https://news.uchicago.edu/story/uchicago-activities-yerkes-observatory-end-2018", "publisher": "University of Chicago", "supports": "Operations ceased on site 1 October 2018"},
    {"url": "https://www.wpr.org/science-and-technology/todays-big-day-wisconsins-yerkes-observatory-has-new-ownership", "publisher": "Wisconsin Public Radio", "supports": "Ownership transfer to the Yerkes Future Foundation, 1 May 2020"},
    {"url": "https://sah-archipedia.org/buildings/WI-01-WL9", "publisher": "SAH Archipedia", "supports": "Henry Ives Cobb as architect, built from Hale''s plans, Romanesque influence"},
    {"url": "https://wi101.wisc.edu/yerkes-telescope-construction/", "publisher": "University of Wisconsin", "supports": "Lens specifications, Alvan Clark & Sons, tube dimensions and weight"},
    {"url": "https://en.wikipedia.org/wiki/List_of_largest_optical_refracting_telescopes", "publisher": "Wikipedia", "supports": "Largest refractor ever built for practical use; surpassed as largest telescope of any kind in 1908"},
    {"url": "https://physicstoday.aip.org/news/the-scientific-legacy-of-yerkes-observatory", "publisher": "Physics Today", "supports": "Struve directorship, Chandrasekhar, Kuiper, Morgan, Hubble''s graduate work"},
    {"url": "https://earthsky.org/astronomy-essentials/barnards-star-closest-stars-famous-stars/", "publisher": "EarthSky", "supports": "Barnard, 1916, the still-standing proper motion record"}
  ]'::jsonb
WHERE slug = 'yerkes-area';

-- ---------------------------------------------------------------------------
-- Cedar Point — the correction that matters most
-- ---------------------------------------------------------------------------
-- Renamed away from "Park". The slug stays so existing links and the sitemap
-- keep working.
UPDATE public.shore_path_stops SET
  name = 'Cedar Point Path Stretch',
  short_label = 'Cedar Point',
  is_public_landmark = false,
  description =
    'Cedar Point is a private lakefront subdivision, not a public park — an earlier version of this guide had that wrong. The Cedar Point Park Association holds 481 lots, and its eight lakefront "parkways" and shared piers are amenities for residents. What is public is the Shore Path itself, crossing as an easement over private land: stay on the path, and treat the lawns, piers and beaches as what they are, which is somebody''s home. This is also one of the harder stretches — the Chapin Road to Williams Bay leg runs about 3.5 miles and the ground around Cedar Point is steep. No restrooms, water or parking; the nearest are back at Edgewater Park.',
  look_for =
    'The elevation. The path climbs well above the waterline here, opening a long view down the lake instead of the hedge-and-lawn corridor you get along most of the shoreline — some of the best vantage on the loop.',
  story_long =
    'Cedar Point stayed largely undeveloped until the 1920s, when a convenient rail route and the spread of the automobile started bringing people to Williams Bay in numbers. In 1922 the village approved a plan to subdivide the land into roughly 480 quarter-acre lots across about 120 acres, laid out in horseshoes around shared lakefront parks with communal lake facilities. Some of the earliest buyers were the people who worked the lake''s large estates through the summer and needed somewhere nearby to house their own families. Enough lots had sold that by 1925 control of the homeowners'' association passed to the residents, and the horseshoe plats, shared parkways and community piers are still what define the neighbourhood.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.cedarpointpark.org/about-cppa", "publisher": "Cedar Point Park Association", "supports": "481 lots, eight parkways, roughly 1,800 feet of shoreline, shared piers for residents"},
    {"url": "https://atthelakemagazine.com/cedar-point-park-association/", "publisher": "At The Lake Magazine", "supports": "1922 subdivision approval, layout, estate-staff buyers, 1925 handover to residents"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "Chapin Road to Williams Bay distance, steep terrain at Cedar Point, the high vantage point"}
  ]'::jsonb
WHERE slug = 'cedar-point-park';

-- ---------------------------------------------------------------------------
-- Black Point Estate
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'A 20-room Queen Anne summer house of about 8,000 square feet, built in 1888 for the Chicago brewer Conrad Seipp and now a Wisconsin Historical Society museum site on the National Register. It is the best-preserved Gilded Age summer house on Geneva Lake, still holding original family furnishings from four generations of Seipp ownership. There is no visitor parking and no public road access: the standard visit is a Lake Geneva Cruise Line boat from the Riviera Docks. Walkers pass below the house on the easement, but passing on foot does not admit you — though there is a walk-in option, which is more than this guide used to say.',
  look_for =
    'The four-story nautical observation tower at the corner of the house, rising above the tree line and identifiable from well out on the water, with the second-floor veranda facing the lake above a long run of undeveloped shoreline.',
  story_long =
    'Conrad Seipp, a German immigrant who built Chicago''s largest brewery, commissioned the house and hired the German-born Chicago architect Adolph Cudell, who also designed for the Schoenhofen brewery. Construction ran through 1887 and 1888 on a promontory on the south shore. Seipp died in 1890 and the house — also known as the Conrad and Catherine Seipp Summer House, and as Die Loreley — stayed in the family for four generations. It was listed on the National Register in September 1994. In September 2005 Seipp''s great-grandson William O. Petersen gave the house, grounds and furnishings to the State of Wisconsin, and after a $1.9 million state-funded restoration it opened for public tours in June 2007. If you want to arrive on foot rather than by boat, the Abbey Resort and the Historical Society run a guided programme that walks about four miles of the Shore Path from Fontana to Black Point, with lunch on the veranda and a tour of the first floor before a shuttle back — booked in advance, seasonal, and not wheelchair accessible.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://doa.wi.gov/Pages/AboutDOA/Black-Point-Estate-Historic-Home.aspx", "publisher": "Wisconsin Department of Administration", "supports": "State ownership, the Petersen donation, $1.9 million restoration, June 2007 opening, National Register listing September 1994"},
    {"url": "https://blackpointestate.wisconsinhistory.org/plan/", "publisher": "Wisconsin Historical Society", "supports": "No visitor parking; arrival by boat"},
    {"url": "https://www.cruiselakegeneva.com/public-tours/black-point-estate/", "publisher": "Lake Geneva Cruise Line", "supports": "Departure from the Riviera Docks"},
    {"url": "https://en.wikipedia.org/wiki/Black_Point_(Linn,_Wisconsin)", "publisher": "Wikipedia", "supports": "1888, Adolph Cudell, Queen Anne, alternate names"},
    {"url": "https://lakegenevanews.net/community/article_c50a389d-bd19-4831-b71a-7e89bd6f6c65.html", "publisher": "Lake Geneva Regional News", "supports": "1887-88 construction, four generations, 20 rooms, about 8,000 square feet"},
    {"url": "https://www.theabbeyresort.com/things-to-do-lake-geneva/summer-at-the-lake/lakeside-stroll-estate-tour/", "publisher": "The Abbey Resort", "supports": "The guided walk-in tour from Fontana, roughly four miles, first floor only, not wheelchair accessible"}
  ]'::jsonb
WHERE slug = 'black-point-estate';

-- ---------------------------------------------------------------------------
-- South Shore stretch
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'The quietest and most committing stretch on the loop: a three-foot easement between the water and a near-continuous line of private lakefront, with the longest gaps between public exits anywhere on the lake. By the official village map it is 2.3 miles Fontana to Shadow Lane and 2.9 miles Shadow Lane to Linn Road — about 5.2 miles of south shore with a single intermediate access. Assume no restrooms and no drinking water for the whole stretch. Carry your own, and pick your turnaround before you start rather than after.',
  look_for =
    'The path surface itself. It changes underfoot from poured concrete to flagstone to bare packed dirt at each property line, because each owner maintains the segment crossing their own land — you are reading property boundaries through paving material.',
  story_long =
    'The route follows a footpath used by Chief Big Foot''s Potawatomi between village sites at what are now Fontana, Williams Bay and Lake Geneva, in use until the removal of 1836. Settlement was sparse until the railroad reached the lake in the 1870s, and after the Great Chicago Fire of 1871 wealthy Chicago families built summer estates along this shoreline, with the older trail becoming the service path linking them. The early settlers established that roughly the first twenty feet up from the water be kept in public use, each landowner responsible for the upkeep of their own frontage — the arrangement that still keeps the loop walkable, and free, today.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.williamsbay.org/1344/Geneva-Lake-Shore-Path-Map", "publisher": "Williams Bay Recreation Department", "supports": "Official segment distances: Fontana to Shadow Lane 2.3 miles, Shadow Lane to Linn Road 2.9 miles"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "The public easement, the Potawatomi origin, owner-maintained segments, surface variety"},
    {"url": "https://discoverwisconsin.com/geneva-lake-shore-path-hidden-gems-history/", "publisher": "Discover Wisconsin", "supports": "Big Foot''s villages, the 1871 fire and the estate era, the twenty-foot public reservation"}
  ]'::jsonb
WHERE slug = 'south-shore-club-area';

-- ---------------------------------------------------------------------------
-- Linn Pier
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'The Town of Linn''s boat launch at the north end of Linn Pier Road is the eastern public gateway to the south shore and the practical trailhead for this side of the lake. It is a paid launch with a card-reading pay machine, and parking is limited — a small apron sized for boat trailers, not a trailhead lot, so arrive early on a summer weekend. Expect a portable toilet at best and no reliable drinking water. From here it is about 2.9 miles west to Shadow Lane and 5.2 to Fontana, your next real parking, so treat Linn Pier as a commit point rather than a rest stop.',
  look_for =
    'The pay-station kiosk on the launch apron. The easement leaves the lot right at the water''s edge beside it and immediately narrows to a footpath between the shoreline and private frontage.',
  story_long =
    'The launch is a municipal facility established by the Town of Linn on the Geneva Lake shore at the north end of Linn Pier Road, governed under the town''s boating regulations. Linn operates more than one access to the lake — a second town ramp sits at Hillside Road — and the town extends free or reduced-price launch passes to veterans and active-duty military, with resident veterans able to collect annual free launch cards at Town Hall on proof of residency and service. The Linn Pier area sits at the eastern end of the south shore near ground the Potawatomi occupied; nearby Button''s Bay is described as former Potawatomi habitation.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://townoflinn.wi.gov/boat-launch/", "publisher": "Town of Linn", "supports": "Launch location, paid status, payment methods, veteran and military passes"},
    {"url": "https://ecode360.com/8814296", "publisher": "Town of Linn Code, Ch. 13", "supports": "Boating regulations governing the launch"},
    {"url": "https://www.williamsbay.org/1344/Geneva-Lake-Shore-Path-Map", "publisher": "Williams Bay Recreation Department", "supports": "2.9 miles to Shadow Lane, about 5.2 to Fontana"},
    {"url": "https://www.visitlakegeneva.com/blog/post/the-geneva-lake-shore-path/", "publisher": "VISIT Lake Geneva", "supports": "Button''s Bay Potawatomi association"}
  ]'::jsonb
WHERE slug = 'linn-pier';

-- ---------------------------------------------------------------------------
-- Guard: fail loudly if a slug did not match
-- ---------------------------------------------------------------------------
-- An UPDATE ... WHERE slug = '...' that matches nothing succeeds silently. That
-- is tolerable for adding copy and NOT tolerable here, because several of these
-- statements are factual corrections — a silently skipped one leaves a reader
-- being told Cedar Point is a public park. So assert the work actually landed.
DO $$
DECLARE
  expected text[] := ARRAY[
    'fontana-beach', 'reid-park', 'abbey-harbor-view', 'kishwauketoe-edge',
    'edgewater-park', 'williams-bay-lakefront', 'yerkes-area', 'cedar-point-park',
    'black-point-estate', 'south-shore-club-area', 'linn-pier'
  ];
  missed text[];
BEGIN
  SELECT array_agg(s) INTO missed
    FROM unnest(expected) s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.shore_path_stops st
      WHERE st.slug = s AND jsonb_array_length(st.sources) > 0
    );
  IF missed IS NOT NULL THEN
    RAISE EXCEPTION 'shore path content did not apply to: %', array_to_string(missed, ', ');
  END IF;
END $$;
