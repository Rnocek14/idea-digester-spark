-- Add Facebook sources to sources table for tracking (using type='scrape')
INSERT INTO sources (name, url, type, category, status, metadata, default_geo_tier) VALUES
-- Fire Departments
('Lake Geneva Fire - Facebook', 'https://www.facebook.com/CityOfLakeGenevaFireDepartment', 'scrape', 'civic', 'active', 
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Fontana Fire - Facebook', 'https://www.facebook.com/FontanaFireRescue', 'scrape', 'civic', 'active',
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Town of Linn Fire - Facebook', 'https://www.facebook.com/TownOfLinnFire', 'scrape', 'civic', 'active',
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Delavan Fire - Facebook', 'https://www.facebook.com/DelavanFire', 'scrape', 'civic', 'active',
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 2),
('Walworth Fire - Facebook', 'https://www.facebook.com/WalworthFireRescue', 'scrape', 'civic', 'active',
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 2),
('Elkhorn Fire - Facebook', 'https://www.facebook.com/ElkhornAreaFireDept', 'scrape', 'civic', 'active',
 '{"content_type": "incidents", "fb_category": "fire", "priority": "high", "scrape_method": "facebook"}'::jsonb, 2),

-- Schools
('Lake Geneva Schools - Facebook', 'https://www.facebook.com/LakeGenevaSchools', 'scrape', 'schools', 'active',
 '{"content_type": "alerts", "fb_category": "schools", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Badger High School - Facebook', 'https://www.facebook.com/BadgerHighSchoolLG', 'scrape', 'schools', 'active',
 '{"content_type": "alerts", "fb_category": "schools", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Williams Bay Schools - Facebook', 'https://www.facebook.com/WilliamsBaySchools', 'scrape', 'schools', 'active',
 '{"content_type": "alerts", "fb_category": "schools", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),
('Fontana School - Facebook', 'https://www.facebook.com/FontanaElementary', 'scrape', 'schools', 'active',
 '{"content_type": "alerts", "fb_category": "schools", "priority": "high", "scrape_method": "facebook"}'::jsonb, 1),

-- Municipal
('City of Lake Geneva - Facebook', 'https://www.facebook.com/CityofLakeGenevaWI', 'scrape', 'civic', 'active',
 '{"content_type": "news", "fb_category": "municipal", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Village of Fontana - Facebook', 'https://www.facebook.com/VillageOfFontanaOnGenevaLake', 'scrape', 'civic', 'active',
 '{"content_type": "news", "fb_category": "municipal", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Village of Williams Bay - Facebook', 'https://www.facebook.com/WilliamsBayWI', 'scrape', 'civic', 'active',
 '{"content_type": "news", "fb_category": "municipal", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Walworth County - Facebook', 'https://www.facebook.com/WalworthCountyWI', 'scrape', 'civic', 'active',
 '{"content_type": "news", "fb_category": "municipal", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 2),

-- Tourism & Chambers
('Visit Lake Geneva - Facebook', 'https://www.facebook.com/VisitLakeGeneva', 'scrape', 'community', 'active',
 '{"content_type": "events", "fb_category": "tourism", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Downtown Lake Geneva - Facebook', 'https://www.facebook.com/DowntownLakeGeneva', 'scrape', 'community', 'active',
 '{"content_type": "events", "fb_category": "tourism", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Geneva Lake West Chamber - Facebook', 'https://www.facebook.com/GenevaLakeWestChamber', 'scrape', 'community', 'active',
 '{"content_type": "events", "fb_category": "tourism", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),

-- Community
('Lake Geneva Now - Facebook', 'https://www.facebook.com/LakeGenevaNow', 'scrape', 'community', 'active',
 '{"content_type": "news", "fb_category": "community", "priority": "medium", "scrape_method": "facebook"}'::jsonb, 1),
('Walworth County Scanner - Facebook', 'https://www.facebook.com/WalworthCountyScanner', 'scrape', 'community', 'active',
 '{"content_type": "incidents", "fb_category": "community", "priority": "high", "scrape_method": "facebook"}'::jsonb, 2),

-- Nightlife Venues (new additions)
('Gordy''s Boat House - Facebook', 'https://www.facebook.com/GordysBoatHouse', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Pier 290 - Facebook', 'https://www.facebook.com/Pier290', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Geneva Tap House - Facebook', 'https://www.facebook.com/GenevaTapHouse', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Grand Geneva - Facebook', 'https://www.facebook.com/GrandGeneva', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Abbey Resort - Facebook', 'https://www.facebook.com/TheAbbeyResort', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Crafted Americana - Facebook', 'https://www.facebook.com/CraftedLG', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Lake City Social - Facebook', 'https://www.facebook.com/LakeCitySocialWI', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1),
('Thumbs Up Pub - Facebook', 'https://www.facebook.com/ThumbsUpPub', 'scrape', 'nightlife', 'active',
 '{"content_type": "events", "fb_category": "nightlife", "priority": "low", "scrape_method": "facebook"}'::jsonb, 1)
ON CONFLICT (url) DO UPDATE SET
  status = 'active',
  metadata = EXCLUDED.metadata,
  updated_at = now();