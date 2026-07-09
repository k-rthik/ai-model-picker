-- ================================================================
-- V2: Flexible provider + model ingestion
-- ================================================================

-- Providers table
CREATE TABLE IF NOT EXISTS providers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    base_url   TEXT,
    is_local   INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO providers (id, name, is_local) VALUES
    ('anthropic',   'Anthropic',     0),
    ('openai',      'OpenAI',        0),
    ('google',      'Google',        0),
    ('meta',        'Meta',          0),
    ('mistral',     'Mistral AI',    0),
    ('cohere',      'Cohere',        0),
    ('databricks',  'Databricks',    0),
    ('groq',        'Groq',          0),
    ('perplexity',  'Perplexity AI', 0),
    ('huggingface', 'HuggingFace',   0),
    ('ollama',      'Ollama',        1);

-- Migrate models to new schema
-- SQLite doesn't support ALTER COLUMN, so rename → recreate → migrate → drop
ALTER TABLE models RENAME TO models_v1;

CREATE TABLE models (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    provider_id         TEXT NOT NULL REFERENCES providers(id),
    pricing_model       TEXT NOT NULL DEFAULT 'per_token',
    input_price_per_1m  REAL NOT NULL DEFAULT 0,
    output_price_per_1m REAL NOT NULL DEFAULT 0,
    batch_input_per_1m  REAL,
    batch_output_per_1m REAL,
    request_price       REAL,
    context_window      INTEGER NOT NULL DEFAULT 0,
    max_output_tokens   INTEGER,
    speed_tier          TEXT NOT NULL DEFAULT 'medium',
    capabilities        TEXT NOT NULL DEFAULT '{}',
    source              TEXT NOT NULL DEFAULT 'manual',
    external_id         TEXT,
    notes               TEXT,
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_models_provider  ON models(provider_id);
CREATE INDEX IF NOT EXISTS idx_models_active    ON models(active);
CREATE INDEX IF NOT EXISTS idx_models_source    ON models(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_external_id ON models(external_id) WHERE external_id IS NOT NULL;

INSERT INTO models (
    id, name, provider_id, pricing_model,
    input_price_per_1m, output_price_per_1m,
    batch_input_per_1m, batch_output_per_1m,
    context_window, max_output_tokens, speed_tier,
    capabilities, source, notes, active, created_at, updated_at
)
SELECT
    id, name, LOWER(provider), 'per_token',
    input_price_per_1m, output_price_per_1m,
    batch_input_per_1m, batch_output_per_1m,
    context_window, max_output_tokens, speed_tier,
    json_object(
        'vision',           CASE supports_vision WHEN 1 THEN json('true') ELSE json('false') END,
        'streaming',        json('true'),
        'function_calling', json('true')
    ),
    'manual', notes, 1, datetime('now'), updated_at
FROM models_v1;

DROP TABLE models_v1;

-- Ingestion audit log
CREATE TABLE IF NOT EXISTS ingestion_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source          TEXT NOT NULL,
    status          TEXT NOT NULL,
    models_added    INTEGER DEFAULT 0,
    models_updated  INTEGER DEFAULT 0,
    models_skipped  INTEGER DEFAULT 0,
    error_message   TEXT,
    ran_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
