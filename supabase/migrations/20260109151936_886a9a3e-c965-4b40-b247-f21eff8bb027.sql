-- Clear the poor quality image for the Winter Show story
UPDATE content_queue 
SET image_url = NULL 
WHERE id = 'e4212726-cf12-401b-a97f-6d26d725c2f3';