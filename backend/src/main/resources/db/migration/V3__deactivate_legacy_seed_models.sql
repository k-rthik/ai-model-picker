-- The V2 migration copies 10 legacy hardcoded models (source='manual') whose
-- prices are stale duplicates of live OpenRouter entries. Deactivate them so
-- a fresh database starts empty and StartupInitializer runs a full ingest.
UPDATE models
SET active = 0,
    updated_at = datetime('now')
WHERE source = 'manual';
