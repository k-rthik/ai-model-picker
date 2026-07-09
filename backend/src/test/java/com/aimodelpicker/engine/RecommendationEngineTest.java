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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RecommendationEngineTest {

    private ModelRepository modelRepository;
    private UseCaseScoreRepository useCaseScoreRepository;
    private RecommendationEngine engine;

    @BeforeEach
    void setUp() {
        modelRepository = mock(ModelRepository.class);
        useCaseScoreRepository = mock(UseCaseScoreRepository.class);
        engine = new RecommendationEngine(modelRepository, useCaseScoreRepository);
    }

    private AiModel model(String id, double inPrice, double outPrice) {
        AiModel m = new AiModel();
        m.setId(id);
        m.setName(id);
        m.setProviderId("test");
        m.setInputPricePer1m(inPrice);
        m.setOutputPricePer1m(outPrice);
        m.setContextWindow(200_000);
        m.setCapabilities(new HashMap<>());
        m.setNotes(null);
        return m;
    }

    private UseCaseScore score(String modelId, String useCase, double value) {
        UseCaseScore s = new UseCaseScore();
        s.setModelId(modelId);
        s.setUseCase(useCase);
        s.setScore(value);
        return s;
    }

    private void stub(List<AiModel> models, List<UseCaseScore> scores) {
        when(modelRepository.findAll()).thenReturn(Flux.fromIterable(models));
        when(useCaseScoreRepository.findByUseCase(anyString())).thenReturn(Flux.fromIterable(scores));
    }

    @Test
    void highQualityTierPicksBestModelNotCheapest() {
        AiModel cheapWeak = model("cheap-weak", 0.05, 0.10);
        AiModel expensiveStrong = model("expensive-strong", 5.0, 25.0);
        stub(List.of(cheapWeak, expensiveStrong), List.of(
                score("cheap-weak", "coding", 5.0),
                score("expensive-strong", "coding", 9.5)));

        var result = engine.recommend("coding", 5, 0).block();

        assertNotNull(result);
        assertEquals("expensive-strong", result.topPick().getId());
    }

    @Test
    void lowQualityTierPrefersCheapModelWhenGoodEnough() {
        AiModel cheapDecent = model("cheap-decent", 0.10, 0.30);
        AiModel expensiveStrong = model("expensive-strong", 5.0, 25.0);
        stub(List.of(cheapDecent, expensiveStrong), List.of(
                score("cheap-decent", "coding", 7.0),
                score("expensive-strong", "coding", 9.5)));

        var result = engine.recommend("coding", 1, 0).block();

        assertNotNull(result);
        assertEquals("cheap-decent", result.topPick().getId());
    }

    @Test
    void unscoredModelsAreNeverRecommended() {
        AiModel unscored = model("mystery-model", 0.01, 0.01);
        AiModel scored = model("known-model", 2.0, 8.0);
        stub(List.of(unscored, scored), List.of(score("known-model", "writing", 8.0)));

        var result = engine.recommend("writing", 3, 0).block();

        assertNotNull(result);
        assertEquals("known-model", result.topPick().getId());
        assertNull(result.runnerUp());
    }

    @Test
    void budgetFilterAppliesAndRelaxationIsExplained() {
        AiModel onlyStrong = model("strong-but-pricey", 10.0, 40.0);
        stub(List.of(onlyStrong), List.of(score("strong-but-pricey", "analysis", 9.5)));

        var result = engine.recommend("analysis", 5, 1.0).block();

        assertNotNull(result);
        assertEquals("strong-but-pricey", result.topPick().getId());
        assertTrue(result.reasoning().contains("budget was relaxed"));
    }

    @Test
    void expensiveOutputPriceCountsAgainstModel() {
        // Same input price; wildly different output price. Low tier → cost matters.
        AiModel cheapOutput = model("cheap-output", 1.0, 1.0);
        AiModel pricedOutput = model("priced-output", 1.0, 60.0);
        stub(List.of(cheapOutput, pricedOutput), List.of(
                score("cheap-output", "summarization", 7.0),
                score("priced-output", "summarization", 7.0)));

        var result = engine.recommend("summarization", 1, 0).block();

        assertNotNull(result);
        assertEquals("cheap-output", result.topPick().getId());
    }

    @Test
    void alternativeAlertFiresForNearEqualCheaperModel() {
        AiModel pricey = model("pricey", 10.0, 40.0);
        AiModel bargain = model("bargain", 1.0, 4.0);
        stub(List.of(pricey, bargain), List.of(
                score("pricey", "coding", 9.0),
                score("bargain", "coding", 8.5)));

        var alert = engine.checkForBetterAlternative("pricey", "coding").block();

        assertNotNull(alert);
        assertTrue(alert.isPresent());
        assertEquals("bargain", alert.get().alternative().getId());
        assertTrue(alert.get().savingsPct() > 0.8);
    }

    @Test
    void excludeChinaFiltersChineseProviders() {
        AiModel chinese = model("deepseek-v3", 0.3, 0.4);
        chinese.setProviderId("deepseek");
        AiModel western = model("gpt-x", 2.0, 8.0);
        western.setProviderId("openai");
        stub(List.of(chinese, western), List.of(
                score("deepseek-v3", "coding", 9.0),
                score("gpt-x", "coding", 8.0)));

        var with = engine.recommend("coding", 3, 0, null, false).block();
        var without = engine.recommend("coding", 3, 0, null, true).block();

        assertNotNull(with);
        assertNotNull(without);
        assertEquals("deepseek-v3", with.topPick().getId());
        assertEquals("gpt-x", without.topPick().getId());
        assertNull(without.runnerUp());
    }

    @Test
    void alternativeAlertSkipsMuchWeakerModels() {
        AiModel pricey = model("pricey", 10.0, 40.0);
        AiModel weakBargain = model("weak-bargain", 0.1, 0.4);
        stub(List.of(pricey, weakBargain), List.of(
                score("pricey", "coding", 9.5),
                score("weak-bargain", "coding", 5.0)));

        var alert = engine.checkForBetterAlternative("pricey", "coding").block();

        assertNotNull(alert);
        assertTrue(alert.isEmpty());
    }
}
