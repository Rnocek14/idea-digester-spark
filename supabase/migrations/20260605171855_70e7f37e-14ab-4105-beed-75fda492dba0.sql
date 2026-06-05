-- Reposition shore path stops to match a more accurate Geneva Lake silhouette.
-- Coordinates are now in viewBox units: x in 0-200, y in 0-100 (2:1 aspect),
-- which matches the new ShorePathMap viewBox.
UPDATE public.shore_path_stops SET map_x_pct=185, map_y_pct=50 WHERE slug='library-park';
UPDATE public.shore_path_stops SET map_x_pct=180, map_y_pct=46 WHERE slug='flat-iron-park';
UPDATE public.shore_path_stops SET map_x_pct=183, map_y_pct=42 WHERE slug='riviera-beach';
UPDATE public.shore_path_stops SET map_x_pct=170, map_y_pct=38 WHERE slug='lake-geneva-public-beach';
UPDATE public.shore_path_stops SET map_x_pct=145, map_y_pct=33 WHERE slug='maple-lawn-area';
UPDATE public.shore_path_stops SET map_x_pct=122, map_y_pct=62 WHERE slug='black-point-estate';
UPDATE public.shore_path_stops SET map_x_pct=92,  map_y_pct=80 WHERE slug='south-shore-club-area';
UPDATE public.shore_path_stops SET map_x_pct=62,  map_y_pct=82 WHERE slug='linn-pier';
UPDATE public.shore_path_stops SET map_x_pct=26,  map_y_pct=74 WHERE slug='fontana-beach';
UPDATE public.shore_path_stops SET map_x_pct=18,  map_y_pct=64 WHERE slug='reid-park';
UPDATE public.shore_path_stops SET map_x_pct=32,  map_y_pct=52 WHERE slug='abbey-harbor-view';
UPDATE public.shore_path_stops SET map_x_pct=55,  map_y_pct=40 WHERE slug='kishwauketoe-edge';
UPDATE public.shore_path_stops SET map_x_pct=78,  map_y_pct=28 WHERE slug='edgewater-park';
UPDATE public.shore_path_stops SET map_x_pct=88,  map_y_pct=22 WHERE slug='williams-bay-lakefront';
UPDATE public.shore_path_stops SET map_x_pct=72,  map_y_pct=33 WHERE slug='yerkes-area';
UPDATE public.shore_path_stops SET map_x_pct=108, map_y_pct=46 WHERE slug='cedar-point-park';