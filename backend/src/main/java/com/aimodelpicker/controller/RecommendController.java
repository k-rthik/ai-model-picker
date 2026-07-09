package com.aimodelpicker.controller;

import com.aimodelpicker.engine.CostCalculator;
import com.aimodelpicker.engine.NlQueryParser;
import com.aimodelpicker.engine.Persona;
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

    public record NlResponse(
            String useCase, int quality, double maxBudget, String persona, String personaLabel,
            RecommendationEngine.RecommendationResult result) {}

    public record PersonaInfo(String id, String label, String description) {}

    @GetMapping
    public Mono<RecommendationEngine.RecommendationResult> recommend(
            @RequestParam String useCase,
            @RequestParam(defaultValue = "3") int quality,
            @RequestParam(defaultValue = "0") double maxBudget,
            @RequestParam(required = false) String persona) {
        return engine.recommend(useCase, quality, maxBudget, Persona.fromString(persona));
    }

    /** GET /api/recommend/nl?q=cheap+chatbot+over+our+docs — free-text recommendation. */
    @GetMapping("/nl")
    public Mono<NlResponse> recommendFromText(@RequestParam String q) {
        NlQueryParser.Parsed p = NlQueryParser.parse(q);
        return engine.recommend(p.useCase(), p.quality(), p.maxBudget(), p.persona())
                .map(result -> new NlResponse(
                        p.useCase(), p.quality(), p.maxBudget(),
                        p.persona() != null ? p.persona().name() : null,
                        p.persona() != null ? p.persona().label : null,
                        result));
    }

    /** Lists available personas for the UI. */
    @GetMapping("/personas")
    public Flux<PersonaInfo> personas() {
        return Flux.fromArray(Persona.values())
                .map(p -> new PersonaInfo(p.name(), p.label, p.description));
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
