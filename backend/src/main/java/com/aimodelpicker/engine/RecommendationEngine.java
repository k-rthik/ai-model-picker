package com.aimodelpicker.engine;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.UseCaseScore;
import com.aimodelpicker.repository.ModelRepository;
import com.aimodelpicker.repository.UseCaseScoreRepository;
import com.aimodelpicker.service.HeuristicUseCaseScorer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.*;

/**
 * Scores models based on use case, quality requirement, and budget constraint.
 *
 * Score formula:
 *   total = (useCaseScore * qualityWeight) + (budgetScore * budgetWeight)
 * where the quality tier (1–5) shifts weight between quality and cost:
 * tier 1 leans heavily on price, tier 5 almost ignores it.
 *
 * Cost is blended input/output price at a 3:1 input:output token ratio —
 * ranking on input price alone hides models with expensive output.
 * Budget score uses log scale so free/cheap models don't flatten the field.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RecommendationEngine {

    // Quality tier (1–5) → weight given to cost vs. use-case quality
    private static final double[] BUDGET_WEIGHTS = { 0.0, 0.45, 0.35, 0.25, 0.12, 0.05 };

    // Quality tier (1–5) → minimum useCaseScore required to pass the filter
    private static final double[] QUALITY_THRESHOLDS = { 0.0, 4.0, 5.5, 7.0, 8.0, 9.0 };

    // Better-alternative threshold: flag if alternative is ≥40% cheaper AND within 1.0 use-case points
    private static final double CHEAPER_THRESHOLD   = 0.40;
    private static final double SCORE_GAP_TOLERANCE = 1.0;

    // Assumed input:output token mix for blending per-token prices
    private static final double INPUT_SHARE = 0.75;

    /** Providers headquartered in China — excludable for data-residency reasons. */
    public static final Set<String> CHINA_PROVIDERS = Set.of(
            "alibaba", "baidu", "bytedance", "bytedance-seed", "deepseek", "kwaipilot",
            "minimax", "moonshotai", "qwen", "stepfun", "tencent", "xiaomi", "z-ai");

    private final ModelRepository modelRepository;
    private final UseCaseScoreRepository useCaseScoreRepository;

    public record RecommendationResult(
            AiModel topPick,
            double topScore,
            AiModel runnerUp,
            double runnerUpScore,
            String reasoning
    ) {}

    public record AlternativeAlert(
            AiModel selected,
            AiModel alternative,
            double savingsPct,
            double scoreDelta
    ) {}

    public Mono<RecommendationResult> recommend(String useCase, int qualityTier, double maxBudgetPer1M) {
        return recommend(useCase, qualityTier, maxBudgetPer1M, null, false);
    }

    public Mono<RecommendationResult> recommend(String useCase, int qualityTier,
                                                double maxBudgetPer1M, Persona persona) {
        return recommend(useCase, qualityTier, maxBudgetPer1M, persona, false);
    }

    /** Persona overrides quality tier and budget weighting, and hard-filters candidates. */
    public Mono<RecommendationResult> recommend(String useCase, int qualityTier,
                                                double maxBudgetPer1M, Persona persona,
                                                boolean excludeChina) {
        int tier = persona != null ? persona.qualityTier : Math.max(1, Math.min(qualityTier, 5));

        return modelRepository.findAll()
                .collectList()
                .flatMap(models -> useCaseScoreRepository.findByUseCase(useCase)
                        .collectList()
                        .map(useCaseScores -> rank(models, useCaseScores, useCase, tier,
                                maxBudgetPer1M, persona, excludeChina)));
    }

    private RecommendationResult rank(List<AiModel> models, List<UseCaseScore> useCaseScores,
                                       String useCase, int qualityTier, double maxBudgetPer1M,
                                       Persona persona, boolean excludeChina) {
        Map<String, Double> scoreMap = new HashMap<>();
        for (UseCaseScore s : useCaseScores) {
            scoreMap.put(s.getModelId(), s.getScore());
        }

        double qualityThreshold = QUALITY_THRESHOLDS[qualityTier];

        // Models with no score are unknown quantities — never recommend them.
        List<AiModel> scored = models.stream()
                .filter(m -> scoreMap.containsKey(m.getId()))
                .filter(m -> !HeuristicUseCaseScorer.isNonAssistant(m))
                .filter(m -> persona == null || persona.accepts(m))
                .filter(m -> !excludeChina || !CHINA_PROVIDERS.contains(m.getProviderId()))
                .toList();

        // Budget gate uses the same blended 3:1 price the ranking scores on —
        // filtering on input price alone lets expensive-output models sneak past.
        List<AiModel> candidates = scored.stream()
                .filter(m -> scoreMap.get(m.getId()) >= qualityThreshold)
                .filter(m -> maxBudgetPer1M <= 0 || blendedPricePer1m(m) <= maxBudgetPer1M)
                .toList();

        boolean budgetRelaxed = false;
        boolean qualityRelaxed = false;
        if (candidates.isEmpty()) {
            budgetRelaxed = maxBudgetPer1M > 0;
            candidates = scored.stream()
                    .filter(m -> scoreMap.get(m.getId()) >= qualityThreshold)
                    .toList();
        }
        if (candidates.isEmpty()) {
            qualityRelaxed = true;
            candidates = scored.isEmpty() ? models : scored;
        }
        if (candidates.isEmpty()) {
            return new RecommendationResult(null, 0, null, 0,
                    "No models available for this use case.");
        }

        double budgetWeight  = persona != null ? persona.budgetWeight : BUDGET_WEIGHTS[qualityTier];
        double qualityWeight = 1.0 - budgetWeight;

        double maxBlended = candidates.stream()
                .mapToDouble(this::blendedPricePer1m)
                .max()
                .orElse(1.0);

        List<Map.Entry<AiModel, Double>> ranked = new ArrayList<>();
        for (AiModel model : candidates) {
            double ucScore    = scoreMap.getOrDefault(model.getId(), 0.0);
            double normUc     = ucScore / 10.0;
            double normBudget = maxBlended > 0
                    ? 1.0 - Math.log1p(blendedPricePer1m(model)) / Math.log1p(maxBlended)
                    : 1.0;
            double total = (normUc * qualityWeight) + (normBudget * budgetWeight);
            ranked.add(Map.entry(model, total));
        }

        ranked.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        AiModel topPick       = ranked.get(0).getKey();
        double  topScore      = ranked.get(0).getValue();

        // Runner-up must be a genuine alternative, not a sibling variant of the
        // top pick (e.g. "Grok 4.20" vs "Grok 4.20 Multi-Agent").
        AiModel runnerUp      = null;
        double  runnerUpScore = 0;
        String topFamily = familyKey(topPick);
        for (int i = 1; i < ranked.size(); i++) {
            if (!familyKey(ranked.get(i).getKey()).equals(topFamily)) {
                runnerUp = ranked.get(i).getKey();
                runnerUpScore = ranked.get(i).getValue();
                break;
            }
        }
        if (runnerUp == null && ranked.size() > 1) {
            runnerUp = ranked.get(1).getKey();
            runnerUpScore = ranked.get(1).getValue();
        }

        String reasoning = buildReasoning(topPick, useCase,
                scoreMap.getOrDefault(topPick.getId(), 0.0), budgetRelaxed, qualityRelaxed, maxBudgetPer1M, persona);

        return new RecommendationResult(topPick, topScore, runnerUp, runnerUpScore, reasoning);
    }

    /**
     * Model family = first two id tokens after the provider prefix
     * ("x-ai-grok-4-20" → "grok-4"), so version/variant siblings group together.
     */
    static String familyKey(AiModel model) {
        String id = model.getId();
        String provider = model.getProviderId() == null ? "" : model.getProviderId();
        String bare = id.startsWith(provider + "-") ? id.substring(provider.length() + 1) : id;
        String[] tokens = bare.split("-");
        return provider + ":" + tokens[0] + (tokens.length > 1 ? "-" + tokens[1] : "");
    }

    /** Blended $/1M tokens assuming a 3:1 input:output mix. */
    double blendedPricePer1m(AiModel model) {
        double in  = model.getInputPricePer1m()  != null ? model.getInputPricePer1m()  : 0;
        double out = model.getOutputPricePer1m() != null ? model.getOutputPricePer1m() : 0;
        return in * INPUT_SHARE + out * (1.0 - INPUT_SHARE);
    }

    public Mono<Optional<AlternativeAlert>> checkForBetterAlternative(String selectedModelId, String useCase) {
        return modelRepository.findAll()
                .collectList()
                .flatMap(models -> useCaseScoreRepository.findByUseCase(useCase)
                        .collectList()
                        .map(scores -> detectAlternative(selectedModelId, models, scores)));
    }

    private Optional<AlternativeAlert> detectAlternative(String selectedModelId,
                                                           List<AiModel> models,
                                                           List<UseCaseScore> useCaseScores) {
        Map<String, Double> scoreMap = new HashMap<>();
        for (UseCaseScore s : useCaseScores) scoreMap.put(s.getModelId(), s.getScore());

        AiModel selected = models.stream()
                .filter(m -> m.getId().equals(selectedModelId))
                .findFirst()
                .orElse(null);

        if (selected == null || !scoreMap.containsKey(selectedModelId)) return Optional.empty();

        double selectedScore = scoreMap.get(selectedModelId);
        double selectedCost  = blendedPricePer1m(selected);
        if (selectedCost <= 0) return Optional.empty();

        // Best alternative = highest use-case score among models that are
        // ≥40% cheaper and within tolerance; ties broken by lower cost.
        AiModel best = null;
        double bestScore = -1, bestCost = 0, bestSavings = 0;

        for (AiModel candidate : models) {
            if (candidate.getId().equals(selectedModelId)) continue;
            if (!scoreMap.containsKey(candidate.getId())) continue;
            if (HeuristicUseCaseScorer.isNonAssistant(candidate)) continue;

            double candidateCost  = blendedPricePer1m(candidate);
            double candidateScore = scoreMap.get(candidate.getId());
            if (candidateCost <= 0) continue; // free/local models aren't a like-for-like swap

            double savingsPct = (selectedCost - candidateCost) / selectedCost;
            double scoreDelta = selectedScore - candidateScore;
            if (savingsPct < CHEAPER_THRESHOLD || scoreDelta > SCORE_GAP_TOLERANCE) continue;

            if (candidateScore > bestScore
                    || (candidateScore == bestScore && candidateCost < bestCost)) {
                best = candidate;
                bestScore = candidateScore;
                bestCost = candidateCost;
                bestSavings = savingsPct;
            }
        }

        if (best == null) return Optional.empty();
        return Optional.of(new AlternativeAlert(selected, best, bestSavings, selectedScore - bestScore));
    }

    private String buildReasoning(AiModel model, String useCase, double useCaseScore,
                                  boolean budgetRelaxed, boolean qualityRelaxed, double maxBudget,
                                  Persona persona) {
        StringBuilder sb = new StringBuilder();
        if (persona != null) {
            sb.append(persona.label).append(" pick (").append(persona.description).append("): ");
        }
        sb.append(String.format(
                "%s scores %.1f/10 for %s at $%.2f/1M input and $%.2f/1M output tokens.",
                model.getName(), useCaseScore, useCase,
                model.getInputPricePer1m(), model.getOutputPricePer1m()));

        if (budgetRelaxed) {
            sb.append(String.format(
                    " Note: no model meeting the quality bar fits your $%.2f/1M budget, so the budget was relaxed.",
                    maxBudget));
        }
        if (qualityRelaxed) {
            sb.append(" Note: no model met the requested quality bar; showing the best available.");
        }
        if (model.getNotes() != null && !model.getNotes().isBlank()) {
            sb.append(' ').append(model.getNotes());
        }
        return sb.toString();
    }
}
