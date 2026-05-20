-- 1) Fix weekday mismatches: roll event_date to next correct weekday
UPDATE content_queue SET event_date = event_date + ((
  CASE 
    WHEN title ~* '\mfriday\M' THEN 5
    WHEN title ~* '\msaturday\M' THEN 6
    WHEN title ~* '\msunday\M' THEN 0
    WHEN title ~* '\mmonday\M' THEN 1
    WHEN title ~* '\mtuesday\M' THEN 2
    WHEN title ~* '\mwednesday\M' THEN 3
    WHEN title ~* '\mthursday\M' THEN 4
  END - EXTRACT(DOW FROM event_date)::int + 7) % 7)::int
WHERE category='events' AND status IN ('published','auto_published') AND event_date >= CURRENT_DATE
  AND CASE 
    WHEN title ~* '\mfriday\M' THEN 5
    WHEN title ~* '\msaturday\M' THEN 6
    WHEN title ~* '\msunday\M' THEN 0
    WHEN title ~* '\mmonday\M' THEN 1
    WHEN title ~* '\mtuesday\M' THEN 2
    WHEN title ~* '\mwednesday\M' THEN 3
    WHEN title ~* '\mthursday\M' THEN 4
  END IS NOT NULL
  AND CASE 
    WHEN title ~* '\mfriday\M' THEN 5
    WHEN title ~* '\msaturday\M' THEN 6
    WHEN title ~* '\msunday\M' THEN 0
    WHEN title ~* '\mmonday\M' THEN 1
    WHEN title ~* '\mtuesday\M' THEN 2
    WHEN title ~* '\mwednesday\M' THEN 3
    WHEN title ~* '\mthursday\M' THEN 4
  END <> EXTRACT(DOW FROM event_date)::int;

-- 2) Recategorize news mislabeled as events
UPDATE content_queue 
SET category='news', 
    decision_path = COALESCE(decision_path,'') || '|recategorized_news_from_events'
WHERE category='events' AND status IN ('published','auto_published') AND event_date IS NULL
  AND metadata->>'source_name' IN (
    'TMJ4 Local News (Regional)','TMJ4 Walworth County',
    'Fox6 Walworth County','Lake Geneva School District News'
  );

-- 3) Hold dateless venue events
UPDATE content_queue 
SET status='pending', hold_reason='missing_event_date'
WHERE category='events' AND status IN ('published','auto_published') AND event_date IS NULL;

-- 4) Hold generic recurring slot titles
UPDATE content_queue 
SET status='pending', hold_reason='generic_recurring_title'
WHERE category='events' AND status IN ('published','auto_published')
  AND (title ~* '(Friday|Saturday|Thursday) Night Bar West Live Music'
       OR title ~* '^(240 West|Bar West|Waterfront) Live Music @'
       OR title ~* 'Saturday Night Waterfront Live Music @');