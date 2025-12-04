-- Delete duplicate House of Bogini entries, keeping the newest one
DELETE FROM content_queue 
WHERE id IN (
  'bb4eb55e-aa5a-4b00-8af5-f2ef1eacf294',
  'ec1f1937-14ff-49c7-9392-4186cf95337c'
);