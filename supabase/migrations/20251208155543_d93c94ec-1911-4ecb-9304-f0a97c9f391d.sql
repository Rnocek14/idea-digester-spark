
-- Fix garbage performer values
UPDATE content_queue SET performer = 'Karen Shook' WHERE id = '97f9e0e4-02d3-4929-a20c-065b92fbe578';
UPDATE content_queue SET performer = NULL WHERE id = '754d3878-0b21-47bf-8b3c-6e496ce9db3e'; -- "family and friends." is garbage
UPDATE content_queue SET performer = NULL WHERE id = 'ee376d5e-b5d3-4db0-a216-bce5c3a6a2d7'; -- "at PIER 290!" is garbage
UPDATE content_queue SET performer = NULL WHERE id = 'f24a6271-f319-4f53-9b0c-cb9069838a9b'; -- "DJ Hollywood the first Wednesday..." is garbage
UPDATE content_queue SET performer = NULL WHERE id = 'c622a189-d648-4302-80c6-540c7ffe50fc'; -- "some great food..." is garbage
UPDATE content_queue SET performer = 'Ladies Night' WHERE performer = 'Ladies Night' AND id = 'cc12a41d-41df-46b5-88b6-7a09927b27cb'; -- Keep but it's an event, not performer
UPDATE content_queue SET performer = NULL WHERE id = 'cc12a41d-41df-46b5-88b6-7a09927b27cb'; -- Actually clear "Ladies Night" as it's not a performer
UPDATE content_queue SET performer = NULL WHERE id = 'a9710529-9df9-4961-aae0-fb99e3c3b8f2'; -- "Thursday Throwdown" is event name not performer
