package com.aimodelpicker.engine;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.UseCaseScore;
import com.aimodelpicker.repository.ModelRepository;
import com.aimodelpicker.repository.UseCaseScoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RunnerUpFamilyTest {

    private ModelRepository modelRepository;
    private UseCaseScoreRepository useCaseScoreRepository;
    private RecommendationEngine engine;

    @BeforeEach
    void setUp() {
        modelRepository = mock(ModelRepository.class);
        useCaseScoreRepository = mock(UseCaseScoreRepository.class);
        engine = new RecommendationEngine(modelRepository, useCaseScoreRepository);
    }

    private AiModel model(String id, String provider, double price) {
        AiModel m = new AiModel();
        m.setId(id);
        m.setName(id);
        m.setProviderId(provider);
        m.setInputPricePer1m(price);
        m.setOutputPricePer1m(price * 3);
        m.setContextWindow(200_000);
        m.setCapabilities(new HashMap<>());
        return m;
    }

    private UseCaseScore score(String modelId, double value) {
        UseCaseScore s = new UseCaseScore();
        s.setModelId(modelId);
        s.setUseCase("analysis");
        s.setScore(value);
        return s;
    }

    @Test
    void runnerUpSkipsSiblingVariantOfTopPick() {
        AiModel grok      = model("x-ai-grok-4-20", "x-ai", 2.0);
        AiModel grokMulti = model("x-ai-grok-4-20-multi-agent", "x-ai", 2.0);
        AiModel gemini    = model("google-gemini-3-1-pro-preview", "google", 2.0);

        when(modelRepository.findAll()).thenReturn(Flux.just(grok, grokMulti, gemini));
        when(useCaseScoreRepository.findByUseCase(anyString())).thenReturn(Flux.just(
                score("x-ai-grok-4-20", 9.5),
                score("x-ai-grok-4-20-multi-agent", 9.4),
                score("google-gemini-3-1-pro-preview", 9.0)));

        var result = engine.recommend("analysis", 4, 0).block();

        assertNotNull(result);
        assertEquals("x-ai-grok-4-20", result.topPick().getId());
        // sibling grok variant skipped — gemini is the genuine alternative
        assertEquals("google-gemini-3-1-pro-preview", result.runnerUp().getId());
    }

    @Test
    void siblingIsFallbackWhenNothingElseExists() {
        AiModel grok      = model("x-ai-grok-4-20", "x-ai", 2.0);
        AiModel grokMulti = model("x-ai-grok-4-20-multi-agent", "x-ai", 2.0);

        when(modelRepository.findAll()).thenReturn(Flux.just(grok, grokMulti));
        when(useCaseScoreRepository.findByUseCase(anyString())).thenReturn(Flux.just(
                score("x-ai-grok-4-20", 9.5),
                score("x-ai-grok-4-20-multi-agent", 9.4)));

        var result = engine.recommend("analysis", 4, 0).block();

        assertNotNull(result);
        assertNotNull(result.runnerUp());
        assertEquals("x-ai-grok-4-20-multi-agent", result.runnerUp().getId());
    }

    @Test
    void familyKeyGroupsVariantsAndSeparatesFamilies() {
        assertEquals(
                RecommendationEngine.familyKey(model("x-ai-grok-4-20", "x-ai", 1)),
                RecommendationEngine.familyKey(model("x-ai-grok-4-fast", "x-ai", 1)));
        assertNotEquals(
                RecommendationEngine.familyKey(model("x-ai-grok-4-20", "x-ai", 1)),
                RecommendationEngine.familyKey(model("x-ai-grok-3", "x-ai", 1)));
        assertNotEquals(
                RecommendationEngine.familyKey(model("anthropic-claude-sonnet-4-6", "anthropic", 1)),
                RecommendationEngine.familyKey(model("google-gemini-3-flash-preview", "google", 1)));
    }
}
