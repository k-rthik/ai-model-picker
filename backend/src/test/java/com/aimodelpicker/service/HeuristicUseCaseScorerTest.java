package com.aimodelpicker.service;

import com.aimodelpicker.model.AiModel;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
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
        assertFalse(HeuristicUseCaseScorer.isNonAssistant(
                model("anthropic-claude-sonnet-4-6", 1_000_000, Map.of())));
    }

    @Test
    void unknownModelGetsConservativeDefault() {
        AiModel unknown = model("essentialai-rnj-1-instruct", 32_768, Map.of());
        assertEquals(5.0, HeuristicUseCaseScorer.score(unknown, "coding"));
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
