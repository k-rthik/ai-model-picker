-- Models registry
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER,
    speed_tier TEXT NOT NULL,        -- fast | medium | slow
    supports_vision INTEGER NOT NULL DEFAULT 0,
    input_price_per_1m REAL NOT NULL,
    output_price_per_1m REAL NOT NULL,
    batch_input_per_1m REAL,
    batch_output_per_1m REAL,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Benchmark scores per model (MMLU, ARC, HellaSwag, etc.)
CREATE TABLE IF NOT EXISTS benchmark_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    benchmark_name TEXT NOT NULL,    -- e.g. MMLU, ARC, HellaSwag, TruthfulQA, MATH
    score REAL NOT NULL,
    source TEXT NOT NULL,            -- e.g. huggingface, lmsys, artificialanalysis
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE(model_id, benchmark_name, source)
);

-- LMSYS Chatbot Arena ELO scores
CREATE TABLE IF NOT EXISTS arena_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    model_name_on_leaderboard TEXT NOT NULL,
    elo_score INTEGER NOT NULL,
    rank_position INTEGER,
    votes INTEGER,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Computed use-case scores (derived from benchmarks + heuristics)
CREATE TABLE IF NOT EXISTS use_case_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    use_case TEXT NOT NULL,          -- coding | writing | analysis | summarization | rag | agents | vision | long-context
    score REAL NOT NULL,             -- 0.0 - 10.0
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE(model_id, use_case)
);

-- Scraper job audit log
CREATE TABLE IF NOT EXISTS scrape_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,            -- success | error
    records_upserted INTEGER DEFAULT 0,
    error_message TEXT,
    ran_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed base model data
INSERT OR REPLACE INTO models (id, name, provider, context_window, max_output_tokens, speed_tier, supports_vision, input_price_per_1m, output_price_per_1m, batch_input_per_1m, batch_output_per_1m, notes) VALUES
('claude-opus-4-6',   'Claude Opus 4.6',    'anthropic', 200000, 32000,  'slow',   1, 15.00, 75.00, 7.50, 37.50, 'Best for complex reasoning and agents'),
('claude-sonnet-4-6', 'Claude Sonnet 4.6',  'anthropic', 200000, 16000,  'medium', 1,  3.00, 15.00, 1.50,  7.50, 'Best balance of capability and cost'),
('claude-haiku-4-5',  'Claude Haiku 4.5',   'anthropic', 200000,  8000,  'fast',   1,  0.80,  4.00, 0.40,  2.00, 'High throughput, low latency tasks'),
('gpt-4o',            'GPT-4o',             'openai',    128000, 16384,  'medium', 1,  2.50, 10.00, 1.25,  5.00, 'Best OpenAI vision model'),
('gpt-4o-mini',       'GPT-4o mini',        'openai',    128000, 16384,  'fast',   1,  0.15,  0.60, 0.075, 0.30, 'Cheapest OpenAI option with vision'),
('gpt-o1',            'GPT-o1',             'openai',    128000, 32768,  'slow',   1, 15.00, 60.00, NULL,  NULL, 'Best for hard reasoning and math'),
('gemini-1-5-pro',    'Gemini 1.5 Pro',     'google',   2000000,  8192,  'medium', 1,  1.25,  5.00, NULL,  NULL, 'Best for very long context tasks'),
('gemini-1-5-flash',  'Gemini 1.5 Flash',   'google',   1000000,  8192,  'fast',   1,  0.075, 0.30, NULL,  NULL, 'Best value long-context summarization'),
('llama-3-groq',      'Llama 3 (Groq)',     'meta',        8192,  8192,  'fast',   0,  0.59,  0.79, NULL,  NULL, 'Ultra-low latency via Groq hardware'),
('mistral-large',     'Mistral Large',      'mistral',  128000,  8192,  'medium', 0,  2.00,  6.00, NULL,  NULL, 'Strong European alternative');
