-- Clean up junk entries with non-HTTP URLs (tel:, mailto:, urn:, etc.)
DELETE FROM content_queue 
WHERE original_url LIKE 'tel:%'
   OR original_url LIKE 'mailto:%'
   OR original_url LIKE 'javascript:%'
   OR original_url LIKE 'urn:%';