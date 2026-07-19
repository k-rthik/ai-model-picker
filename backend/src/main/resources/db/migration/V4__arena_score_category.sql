-- Arena scores become category-aware: each row records which arena.ai
-- leaderboard (text, code, vision, search, document) the ELO came from.
-- Pre-existing rows all came from the overall/text board.
ALTER TABLE arena_scores ADD COLUMN category TEXT NOT NULL DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_arena_scores_model_category
    ON arena_scores (model_id, category);
