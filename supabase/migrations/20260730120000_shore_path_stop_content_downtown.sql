-- Sourced write-ups for the five downtown Lake Geneva stops, plus four more
-- corrections to the original seed.
--
-- Same research caveat as the west-end migration: findings come from web research
-- against the publishers named in each stop's `sources` array, cross-checked
-- across independent results, but the research environment could not open primary
-- pages directly. history_confidence is set accordingly and volatile facts (fees,
-- hours, season dates) are written so they can go stale without misleading
-- anyone. The Riviera's National Register nomination in particular would firm up
-- the construction chronology and should be read before this is treated as final.
--
-- CORRECTIONS THIS MIGRATION MAKES
-- 1. The Riviera is NOT at Flat Iron Park. They are separate sites a short walk
--    apart: the Riviera stands out over the water on pilings at 812 Wrigley
--    Drive, while Flat Iron Park is at 201 Wrigley Drive, separated from the lake
--    by the road. The seed had the Riviera "anchoring the lakefront" at Flat Iron.
-- 2. The farmers market is NOT at Flat Iron Park. It is at Horticultural Hall on
--    Broad Street. Flat Iron hosts Concerts in the Park — also on Thursdays,
--    which is almost certainly where the confusion came from.
-- 3. "Lake Geneva Public Beach" and "Riviera Beach" are the SAME BEACH. Every
--    source points to one city-operated downtown beach carried under both names;
--    the city's own page is simply titled "The Beach." Rather than invent a
--    second beach or silently drop a stop, these two are rewritten as what they
--    honestly are: the Riviera building and its working pier, then the sand and
--    swim operation beside it. EDITORIAL DECISION STILL OPEN — see the note on
--    the public-beach stop below.
-- 4. "Continuously open since the 1870s" is not supported by any source found,
--    and it also undersells the path. No source asserts continuous openness, and
--    the route long predates the 1870s: the Historic Indian Trail marker in
--    Library Park dates Native use from 2500 BC to 1836 AD. What the 1870s
--    brought was the railroad, the steamboat era, and the post-fire influx of
--    Chicago families. Note also that path length is genuinely inconsistent
--    across sources — the Library Park marker says 26 miles where the village and
--    tourism bodies say 21.

-- ---------------------------------------------------------------------------
-- Library Park
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'The most common place to start, and the easiest. Library Park wraps the Lake Geneva Public Library on the 900 block of Main Street, and the city keeps it as a passive park with a fishing pier and public restrooms. The surface here is paved and close to flat, so you can walk out a mile in either direction and turn back without committing to anything. No bikes, skates or motorised vehicles are permitted on the path, and a stroller will not get far — the surface degrades quickly once you leave the downtown blocks.',
  look_for =
    'The Historic Indian Trail marker in the park. It dates use of the lakeside trail by Native cultures from 2500 BC to 1836 AD, records that Chief Big Foot''s Potawatomi walked between villages at what are now Fontana, Williams Bay and Lake Geneva — and notes that one of those villages stood in this park.',
  story_long =
    'From 1897 to 1954 the library occupied the Farr-Sturges house, built on this site in 1859 by the area attorney Asa W. Farr. The property later belonged to George and Mary Sturges, and Mary gave it to the city in 1894. The Farr-Sturges house was demolished in 1954 to make room for the present building, designed by James R. Dresser, a Wisconsin native who had trained under Frank Lloyd Wright; sources describe it variously as mid-century modern and as Prairie style, and it has been renovated in recent years with attention to Dresser''s original design. Worth knowing while you stand here: the marker''s 26-mile figure for the trail is longer than the 21 miles the village and tourism bodies give for the modern path, and this desk has not reconciled the two.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.visitlakegeneva.com/listing/library-elm-park/1643/", "publisher": "VISIT Lake Geneva", "supports": "Location on the 900 block of Main Street, fishing pier, restrooms, Shore Path access"},
    {"url": "https://www.hmdb.org/m.asp?m=271506", "publisher": "Historical Marker Database", "supports": "Historic Indian Trail marker text: 2500 BC to 1836 AD, Big Foot''s Potawatomi, a village in this park, 26 miles"},
    {"url": "https://www.cbs58.com/news/historical-lake-geneva-public-library-renovated-with-history-in-mind", "publisher": "CBS 58", "supports": "Farr-Sturges house 1859, library 1897-1954, Mary Sturges''s 1894 gift, 1954 demolition, James R. Dresser"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "No bikes, skates or motorised vehicles; strollers not recommended"}
  ]'::jsonb
WHERE slug = 'library-park';

-- ---------------------------------------------------------------------------
-- Flat Iron Park — Riviera and farmers market claims both corrected
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'A triangular green at 201 Wrigley Drive, and the city''s main downtown event lawn — Art in the Park, the Venetian Festival, Oktoberfest, Winterfest, the snow sculpting invitational, and the free Concerts in the Park series on summer Thursday evenings at the Brunk Pavilion. The restrooms here are open year-round, which makes it the most reliable stop on the downtown stretch. Two corrections to what this guide used to say: the Riviera is not here, it is a short walk east at 812 Wrigley Drive, out over the water; and the farmers market is not here either, it is at Horticultural Hall on Broad Street, also on a Thursday, which is probably how the two got crossed.',
  look_for =
    'Andy Gump — a chinless, moustachioed cartoon figure with one foot up on a globe, facing the lake — and, separately, the Three Graces fountain, showing Beauty, Charm and Joy.',
  story_long =
    'The park is named for its resemblance to a vintage flat iron, which is what everyone here will tell you and what no primary record this desk found confirms. The Three Graces fountain came from a $5,000 bequest by Reinette Lester McCrea, a Chicagoan who summered on the north shore in a William Le Baron Jenney house called Blacktoft; her will directed that the money be spent "for a fountain, and for no other purpose... in the memory of some of the good women I have known at the Lake." The Beautification Committee and the Jaycees restored it in 2007. The Andy Gump statue honours the cartoonist Sidney Smith, a Lake Geneva resident from 1922 until he was killed in a car accident on 20 October 1935; Andy Gump first appeared in the Chicago Tribune in 1917, and The Gumps became the first syndicated comic strip in 1919. The original statue went up on Smith''s estate in 1924 and moved here after his death — it was destroyed in 1967, replaced, stolen in 1989, and replaced again. The eight-sided Bertil and Ulla Brunk Pavilion, styled after the Riviera''s Mediterranean look, was dedicated on 20 June 2015 on a lead gift of $150,000.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://www.cityoflakegeneva.gov/Facilities/Facility/Details/Flat-Iron-Park-6", "publisher": "City of Lake Geneva", "supports": "Location between Wrigley Drive and Center Street, year-round restrooms, events"},
    {"url": "https://www.visitlakegeneva.com/events/concerts-park/", "publisher": "VISIT Lake Geneva", "supports": "Concerts in the Park at the Brunk Pavilion, 201 Wrigley Drive"},
    {"url": "https://www.horticulturalhall.com/index.php/farmers-market", "publisher": "Horticultural Hall", "supports": "The farmers market is at Horticultural Hall on Broad Street, not Flat Iron Park"},
    {"url": "https://lakegenevanews.net/news/local/patrick-quinn-on-lake-genevas-three-graces-statue-the-womens-activist-behind-it/article_d7433a52-6450-11ed-bd11-23a2df9db990.html", "publisher": "Lake Geneva Regional News", "supports": "The McCrea bequest and the text of her will; Blacktoft; Jenney"},
    {"url": "https://en.wikipedia.org/wiki/The_Gumps", "publisher": "Wikipedia", "supports": "1917 Tribune debut, first syndicated strip 1919, Sidney Smith''s death 20 October 1935"},
    {"url": "https://www.wibandshellsandstands.com/lake-geneva.html", "publisher": "Wisconsin Bandshells & Stands", "supports": "Brunk Pavilion dedicated 2015, eight-sided, $150,000 lead gift"}
  ]'::jsonb
WHERE slug = 'flat-iron-park';

-- ---------------------------------------------------------------------------
-- The Riviera — the building and the working pier
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  name = 'The Riviera & Cruise Line Docks',
  short_label = 'The Riviera',
  description =
    'The Riviera stands out over the lake on pilings at 812 Wrigley Drive, surrounded by water on three sides, with the Lake Geneva Cruise Line working out of the docks beneath it from May through October — including the U.S. Mailboat run. The building is the reason this stretch of shoreline looks the way it does. The sand and the swim operation are covered at the next stop.',
  look_for =
    'The west-facing loggia — the long open arcade above the ground floor, set directly over the Cruise Line docks, with the ballroom''s twenty-foot windows behind it.',
  story_long =
    'In January 1932, in the depths of the Depression, the city voted to sell bonds for a recreation centre and ballroom to pull tourists in. The first pilings went into the lake bottom that March, because the building was designed to stand over the water. James Roy Allen, a Chicago architect who had moved to Lake Geneva, drew it in an Italian Renaissance idiom: shop stalls and a bathhouse with locker rooms below, ballroom and west-facing loggia above. The exterior was finished by 1 September 1932, when an informal preview drew more than a thousand dancers to Ralph Williams''s orchestra; the formal opening came on 22 May 1933 with Wayne King. Through the 1930s, 40s and 50s the ballroom booked Glenn Miller, Tommy Dorsey, Louis Armstrong and Ella Fitzgerald, and later Chubby Checker, Herman''s Hermits and Stevie Wonder. It joined the National Register on 3 April 1986, cited as the most intact historic building associated with transportation in the Geneva Lake area — this lakefront had been the lake''s water-transport hub since the steamboat era of the 1870s and the Whiting House Hotel.',
  history_confidence = 'documented',
  sources = '[
    {"url": "https://en.wikipedia.org/wiki/The_Riviera_(Lake_Geneva,_Wisconsin)", "publisher": "Wikipedia", "supports": "National Register listing 3 April 1986, James Roy Allen, Italian Renaissance, construction from March 1932, formal opening 22 May 1933 with Wayne King, transportation significance"},
    {"url": "https://www.hhhistory.com/2019/07/the-riviera-lake-geneva-wisconsins.html", "publisher": "Heroes, Heroines & History", "supports": "January 1932 bond decision, March 1932 pilings, Allen''s plan, the 1 September 1932 preview with Ralph Williams"},
    {"url": "https://www.lakegenevariviera.com/", "publisher": "The Riviera", "supports": "812 Wrigley Drive, surrounded by water on three sides, twenty-foot windows, veranda above the docks"},
    {"url": "https://theclio.com/entry/16986", "publisher": "Clio", "supports": "The big-band and later performer bookings"},
    {"url": "https://www.visitlakegeneva.com/listing/lake-geneva-cruise-line/83/", "publisher": "VISIT Lake Geneva", "supports": "Cruise Line operating from the Riviera Docks, May through October"}
  ]'::jsonb
WHERE slug = 'riviera-beach';

-- ---------------------------------------------------------------------------
-- The public beach
-- ---------------------------------------------------------------------------
-- EDITORIAL DECISION STILL OPEN. Research could find no second, separate city
-- beach: "Riviera Beach" and "Lake Geneva Public Beach" are two names for one
-- operation, and the city's own page is titled simply "The Beach." Rather than
-- invent a beach or quietly delete a stop and leave the passport with fifteen
-- boxes, this is rewritten to cover the thing the previous stop does not — the
-- sand, the swim area and what it costs — and says plainly that it is the same
-- lakefront. Editorial should decide whether to merge these two stops or to
-- substitute a genuinely separate site. The obvious candidate is Big Foot Beach
-- State Park, which IS a Shore Path access point, but it sits about a mile south
-- of downtown rather than west along the walking order, and the DNR currently
-- reports its beach area closed for safety — so it cannot simply be swapped in.
UPDATE public.shore_path_stops SET
  name = 'The Public Beach',
  short_label = 'Public Beach',
  description =
    'The city''s downtown swimming beach, immediately beside the Riviera and part of the same operation — you will see it called both Riviera Beach and Lake Geneva Public Beach, and it is one place, not two. Roughly 600 feet of sand with a beach house and boardwalk. Admission is charged per person during operating hours at kiosks near the entrance, with a much cheaper resident pass, and lifeguards are on duty through the core of the summer. Season dates, hours and rates are all set annually — check the city''s beach page rather than trusting a figure printed anywhere, this guide included.',
  look_for =
    'Where the boardwalk meets the sand is the boundary you actually care about: the Shore Path continues along the public walkway, and the paid swim area is the sand inside the kiosks.',
  story_long =
    'This beach sits on what was the lake''s transport hub long before it was a place to swim. The Broad Street lakefront handled Geneva Lake''s water traffic from the 1870s steamboat era onward, with the Whiting House Hotel bringing Chicago visitors down to the water, and the Cruise Line traces its own line back to an 1873 steamboat company. The bathhouse built into the Riviera''s ground floor in 1932 is the direct ancestor of the beach house here — the city put changing rooms under a ballroom because the lakefront was already where everyone went.',
  history_confidence = 'traditional',
  sources = '[
    {"url": "https://www.cityoflakegeneva.gov/326/The-Beach", "publisher": "City of Lake Geneva", "supports": "The city operates one downtown beach; fees, hours, season, kiosks, resident passes"},
    {"url": "https://www.travelwisconsin.com/outdoors/on-the-water/riviera-beach-lake-geneva", "publisher": "Travel Wisconsin", "supports": "About 600 feet of sand, beach house, boardwalk"},
    {"url": "https://www.cruiselakegeneva.com/about/", "publisher": "Lake Geneva Cruise Line", "supports": "Origins as an 1873 steamboat company"},
    {"url": "https://www.hhhistory.com/2019/07/the-riviera-lake-geneva-wisconsins.html", "publisher": "Heroes, Heroines & History", "supports": "The bathhouse and locker rooms built into the Riviera''s ground floor in 1932"}
  ]'::jsonb
WHERE slug = 'lake-geneva-public-beach';

-- ---------------------------------------------------------------------------
-- Maple Lawn
-- ---------------------------------------------------------------------------
UPDATE public.shore_path_stops SET
  description =
    'West of downtown the path narrows and the surface starts changing under you as it crosses the frontage of private homes. This stretch runs through what were the grounds of Maple Lawn, the first great estate on Geneva Lake. You are on a public easement across private land here: each owner maintains their own section, and the standing request is to stay on the path and off lawns, gardens, piers and boathouses. Leashed dogs are fine. There are no restrooms, benches or water on this stretch, so use the downtown parks before you set out.',
  look_for =
    'The change itself. The paved downtown walkway gives way to narrow grass and dirt, pinched between the water''s edge and mown private lawn. Nothing of the original Maple Lawn house survives to see.',
  story_long =
    'Shelton Sturges, heir to a Chicago grain-elevator fortune, finished Maple Lawn in the summer of 1871 — a few weeks before the Chicago-to-Lake Geneva rail line was completed, and in the same year the Great Chicago Fire sent wealthy Chicago families out to their Geneva Lake summer places for the duration of the rebuild. It was a Queen Anne house with deep verandas and something like 1,280 feet of shoreline, and it is generally described as the first mansion on the lake — a claim repeated widely enough locally that this desk will pass it on, while noting no primary record for it surfaced. Three Sturges brothers were in the Chicago grain-elevator business, and the family also farmed land running west from Forest Street toward Williams Bay. The grounds were later subdivided into the houses standing there now, and the original mansion was demolished in 2004.',
  history_confidence = 'traditional',
  sources = '[
    {"url": "https://atthelakemagazine.com/a-lasting-legacy/", "publisher": "At The Lake Magazine", "supports": "Completion in summer 1871 just before the rail line, subdivision of the grounds, 2004 demolition"},
    {"url": "https://shepherdexpress.com/culture/milwaukee-history/lake-genevas-gilded-age-history/", "publisher": "Shepherd Express", "supports": "Shelton Sturges as grain-elevator heir; Maple Lawn as the lake''s first major mansion"},
    {"url": "https://townofgenevawi.com/about-the-town/", "publisher": "Town of Geneva", "supports": "Sturges family farm acreage west of Forest Street toward Williams Bay"},
    {"url": "https://www.visitlakegeneva.com/things-to-do/shore-path/", "publisher": "VISIT Lake Geneva", "supports": "Stay-on-the-path etiquette, owner maintenance, leashed dogs"}
  ]'::jsonb
WHERE slug = 'maple-lawn-area';

-- ---------------------------------------------------------------------------
-- Guard: fail loudly if a slug did not match
-- ---------------------------------------------------------------------------
-- See the note in the west-end migration. These statements correct the Riviera's
-- location, the farmers-market claim and the duplicate beach; a silently skipped
-- UPDATE would leave the wrong version in front of readers.
DO $$
DECLARE
  expected text[] := ARRAY[
    'library-park', 'flat-iron-park', 'riviera-beach',
    'lake-geneva-public-beach', 'maple-lawn-area'
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
