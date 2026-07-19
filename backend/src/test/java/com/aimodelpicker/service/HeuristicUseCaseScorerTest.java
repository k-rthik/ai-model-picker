package com.aimodelpicker.service;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.ArenaScore;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HeuristicUseCaseScorerTest {

    private AiModel model(String id, int contextWindow, Map<String, Object> caps) {
        AiModel m = new AiModel();
        m.setId(id);
        m.setName(id);
        m.setContextWindow(contextWindow);
        m.setCapabilities(new HashMap<>(caps));
        m.setInputPricePer1m(1.0);
        m.setOutputPricePer1m(2.0);
        return m;
    }

    @Test
    void frontierModelOutscoresTinyModelForCoding() {
        AiModel opus = model("anthropic-claude-opus-4-6", 1_000_000,
                Map.of("vision", true, "function_calling", true));
        AiModel tiny = model("meta-llama-llama-3-2-1b-instruct", 128_000, Map.of());

        assertTrue(HeuristicUseCaseScorer.score(opus, "coding")
                > HeuristicUseCaseScorer.score(tiny, "coding") + 3.0);
    }

    @Test
    void textOnlyModelIsGatedOutOfVision() {
        AiModel textOnly = model("deepseek-deepseek-v3-2", 163_840, Map.of("vision", false));
        assertEquals(1.0, HeuristicUseCaseScorer.score(textOnly, "vision"));

        AiModel visionModel = model("google-gemini-3-1-pro-preview", 1_048_576, Map.of("vision", true));
        assertTrue(HeuristicUseCaseScorer.score(visionModel, "vision") > 8.0);
    }

    @Test
    void smallContextWindowCapsLongContextScore() {
        AiModel smallCtx = model("ollama-gemma2-27b", 8_192, Map.of());
        assertTrue(HeuristicUseCaseScorer.score(smallCtx, "long-context") <= 3.5);

        AiModel bigCtx = model("x-ai-grok-4-20", 2_000_000, Map.of("vision", true));
        assertTrue(HeuristicUseCaseScorer.score(bigCtx, "long-context") > 9.0);
    }

    @Test
    void coderSpecialistBoostedForCodingPenalizedForWriting() {
        AiModel codex = model("openai-gpt-5-3-codex", 400_000, Map.of());
        AiModel general = model("openai-gpt-5-3-chat", 400_000, Map.of());

        assertTrue(HeuristicUseCaseScorer.score(codex, "coding")
                > HeuristicUseCaseScorer.score(general, "coding"));
        assertTrue(HeuristicUseCaseScorer.score(codex, "writing")
                < HeuristicUseCaseScorer.score(general, "writing"));
    }

    @Test
    void webSearchModelsBoostedForRag() {
        AiModel sonar = model("perplexity-sonar-pro", 200_000, Map.of("web_search", true));
        assertTrue(HeuristicUseCaseScorer.score(sonar, "rag") > 9.0);
    }

    @Test
    void embeddingsAndMediaModelsAreExcluded() {
        assertTrue(HeuristicUseCaseScorer.isNonAssistant(
                model("cohere-embed-english-v3", 512, Map.of("embeddings", true))));
        assertTrue(HeuristicUseCaseScorer.isNonAssistant(
                model("google-gemini-2-5-flash-image", 32_768, Map.of())));
        assertTrue(HeuristicUseCaseScorer.isNonAssistant(
                model("meta-llama-llama-guard-4-12b", 128_000, Map.of())));
        // meta-router, not a model — free pricing would let it win budget tiers
        assertTrue(HeuristicUseCaseScorer.isNonAssistant(
                model("openrouter-auto-beta", 2_000_000, Map.of())));
        assertFalse(HeuristicUseCaseScorer.isNonAssistant(
                model("anthropic-claude-sonnet-4-6", 1_000_000, Map.of())));
    }

    @Test
    void unknownModelGetsConservativeDefault() {
        AiModel unknown = model("essentialai-rnj-1-instruct", 32_768, Map.of());
        assertEquals(5.0, HeuristicUseCaseScorer.score(unknown, "coding"));
    }

    private ArenaScore arena(String modelId, String category, int elo, int votes) {
        ArenaScore s = new ArenaScore();
        s.setModelId(modelId);
        s.setCategory(category);
        s.setEloScore(elo);
        s.setVotes(votes);
        return s;
    }

    @Test
    void eloNormalizesPerCategoryNotAcrossBoards() {
        // Code board runs 1300–1500, text board 1000–1200; the same model should
        // land at the top of each board's own 2–10 scale, not a shared one.
        List<ArenaScore> scores = new java.util.ArrayList<>();
        for (int i = 0; i < 5; i++) {
            scores.add(arena("code-" + i, "code", 1300 + i * 50, 1000));
            scores.add(arena("text-" + i, "text", 1000 + i * 50, 1000));
        }

        var byCategory = HeuristicUseCaseScorer.normalizeEloByCategory(scores);

        assertEquals(10.0, byCategory.get("code").get("code-4").score(), 0.01);
        assertEquals(10.0, byCategory.get("text").get("text-4").score(), 0.01);
        assertEquals(2.0, byCategory.get("code").get("code-0").score(), 0.01);
    }

    @Test
    void boardsWithTooFewMatchesAreDropped() {
        var byCategory = HeuristicUseCaseScorer.normalizeEloByCategory(List.of(
                arena("a", "vision", 1400, 100),
                arena("b", "vision", 1300, 100)));
        assertTrue(byCategory.isEmpty());
    }

    @Test
    void useCasePullsFromMappedCategoryWithTextFallback() {
        Map<String, Map<String, HeuristicUseCaseScorer.ArenaSignal>> arena = Map.of(
                "code", Map.of("m1", new HeuristicUseCaseScorer.ArenaSignal(9.0, 500)),
                "text", Map.of("m1", new HeuristicUseCaseScorer.ArenaSignal(6.0, 500),
                               "m2", new HeuristicUseCaseScorer.ArenaSignal(7.0, 500)));

        // coding maps to the code board
        assertEquals(9.0, HeuristicUseCaseScorer.arenaSignalFor(arena, "m1", "coding").score());
        // writing maps to text
        assertEquals(6.0, HeuristicUseCaseScorer.arenaSignalFor(arena, "m1", "writing").score());
        // m2 has no code-board entry → falls back to its text rating
        assertEquals(7.0, HeuristicUseCaseScorer.arenaSignalFor(arena, "m2", "coding").score());
        // no data anywhere → null
        assertNull(HeuristicUseCaseScorer.arenaSignalFor(arena, "m3", "coding"));
    }

    @Test
    void lowVoteArenaRatingsMoveTheScoreLess() {
        AiModel m = model("anthropic-claude-sonnet-4-6", 1_000_000, Map.of());
        double baseline = HeuristicUseCaseScorer.score(m, "coding");

        // A terrible arena rating (2.0) with many votes should drag the score
        // down much further than the same rating with 20 votes.
        double manyVotes = HeuristicUseCaseScorer.score(m, "coding", 2.0, 50_000);
        double fewVotes  = HeuristicUseCaseScorer.score(m, "coding", 2.0, 20);

        assertTrue(manyVotes < fewVotes);
        assertTrue(fewVotes < baseline);
        // unknown vote count keeps the legacy full 50/50 blend
        assertEquals(HeuristicUseCaseScorer.score(m, "coding", 2.0),
                HeuristicUseCaseScorer.score(m, "coding", 2.0, 0));
    }

    @Test
    void arenaConfidenceTapersWithVotes() {
        assertEquals(1.0, HeuristicUseCaseScorer.arenaConfidence(null));
        assertEquals(1.0, HeuristicUseCaseScorer.arenaConfidence(0));
        assertEquals(1.0, HeuristicUseCaseScorer.arenaConfidence(1_000_000));
        double c50 = HeuristicUseCaseScorer.arenaConfidence(50);
        double c500 = HeuristicUseCaseScorer.arenaConfidence(500);
        assertTrue(c50 > 0 && c50 < c500 && c500 < 1.0);
    }

    @Test
    void scoresAlwaysWithinRange() {
        AiModel m = model("perplexity-sonar-pro", 200_000, Map.of("web_search", true, "rag", true));
        for (String uc : HeuristicUseCaseScorer.USE_CASES) {
            double s = HeuristicUseCaseScorer.score(m, uc);
            assertTrue(s >= 0.0 && s <= 10.0, uc + " score out of range: " + s);
        }
    }
}
