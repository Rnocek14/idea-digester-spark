-- Disable Walworth County Government source until we find a working feed
UPDATE sources 
SET status = 'inactive'
WHERE name = 'Walworth County Government';

-- Note: Walworth County Community News (already active) covers county civic content
-- It's already producing 5+ stories/day