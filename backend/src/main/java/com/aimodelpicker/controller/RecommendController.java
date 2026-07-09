package com.aimodelpicker.controller;

import com.aimodelpicker.engine.CostCalculator;
import com.aimodelpicker.engine.RecommendationEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/recommend")
@RequiredArgsConstructor
public class RecommendController {

    private final RecommendationEngine engine;
    private final CostCalculator calculator;

    public record AlternativeResponse(boolean present, RecommendationEngine.AlternativeAlert value) {}

    @GetMapping
    public Mono<RecommendationEngine.RecommendationResult> recommend(
            @RequestParam String useCase,
            @RequestParam(defaultValue = "3") int quality,
            @RequestParam(defaultValue = "0") double maxBudget) {
        return engine.recommend(useCase, quality, maxBudget);
    }

    @GetMapping("/alternative")
    public Mono<AlternativeResponse> checkAlternative(
            @RequestParam String modelId,
            @RequestParam String useCase) {
        return engine.checkForBetterAlternative(modelId, useCase)
                .map(opt -> new AlternativeResponse(opt.isPresent(), opt.orElse(null)));
    }

    /**
     * GET /api/cost?inputTokens=100000&outputTokens=5000
     * Returns projected costs for all models, sorted cheapest first.
     */
    @GetMapping("/cost")
    public Flux<CostCalculator.CostProjection> projectCosts(
            @RequestParam long inputTokens,
            @RequestParam long outputTokens) {
        return calculator.projectAll(inputTokens, outputTokens);
    }
}
