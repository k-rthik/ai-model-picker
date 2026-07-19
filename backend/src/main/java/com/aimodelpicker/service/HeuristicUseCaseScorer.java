package com.aimodelpicker.service;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.model.UseCaseScore;
import com.aimodelpicker.repository.ArenaScoreRepository;
import com.aimodelpicker.repository.ModelRepository;
import com.aimodelpicker.repository.UseCaseScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Fills use_case_scores for every active model from curated model-family quality
 * tiers plus objective metadata gates (vision capability, tool support, context
 * window). This is the baseline signal the RecommendationEngine ranks on; scores
 * derived from real benchmark data (ScraperOrchestrator) overwrite these when
 * benchmark rows exist.
 *
 * Family entries match on model id, first match wins — keep specific patterns
 * above general ones.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HeuristicUseCaseScorer {

    public static final List<String> USE_CASES = List.of(
            "coding", "writing", "analysis", "summarization",
            "rag", "agents", "vision", "long-context");

    /** Models that are not general-purpose text assistants: never scored, never recommended. */
    public static final Pattern NON_ASSISTANT = Pattern.compile(
            "embed|image|audio|lyria|voxtral|whisper|tts|guard|morph-v3|relace|switchpoint-router|openrouter-free");

    private record Family(Pattern pattern, double base, Map<String, Double> deltas) {
        static Family of(String regex, double base) {
            return new Family(Pattern.compile(regex), base, Map.of());
        }
        static Family of(String regex, double base, Map<String, Double> deltas) {
            return new Family(Pattern.compile(regex), base, deltas);
        }
    }

    private static final Map<String, Double> CODER =
            Map.of("coding", 0.8, "writing", -1.2, "summarization", -0.5);
    private static final Map<String, Double> REASONER =
            Map.of("analysis", 0.5, "summarization", -0.3);
    private static final Map<String, Double> WEB_RAG =
            Map.of("rag", 2.0, "analysis", 0.3);
    private static final Map<String, Double> RAG_TUNED =
            Map.of("rag", 1.3);
    private static final Map<String, Double> ROLEPLAY =
            Map.of("writing", 1.5, "coding", -2.0, "analysis", -1.5, "agents", -1.5, "rag", -1.0);

    private static final double DEFAULT_BASE = 5.0;

    private static final List<Family> FAMILIES = List.of(
            // Anthropic
            Family.of("claude-opus-4-[56]", 9.5, Map.of("coding", 0.3, "agents", 0.3)),
            Family.of("claude-opus", 8.5),
            Family.of("claude-sonnet-4-6", 9.2, Map.of("coding", 0.5, "agents", 0.4)),
            Family.of("claude-sonnet-4-5", 8.8, Map.of("coding", 0.4, "agents", 0.3)),
            Family.of("claude-sonnet|claude-3-7-sonnet", 8.0, Map.of("coding", 0.3)),
            Family.of("claude-haiku-4-5", 7.5),
            Family.of("claude-3-5-haiku|claude-3-haiku", 6.0),
            // OpenAI
            Family.of("gpt-5-4-pro", 9.6, REASONER),
            Family.of("gpt-5-4-mini", 8.2),
            Family.of("gpt-5-4-nano", 6.5),
            Family.of("gpt-5-4", 9.5),
            Family.of("gpt-5-3-codex", 9.3, CODER),
            Family.of("gpt-5-3", 9.2),
            Family.of("gpt-5-2-pro", 9.2, REASONER),
            Family.of("gpt-5-2-codex", 9.0, CODER),
            Family.of("gpt-5-2", 8.9),
            Family.of("gpt-5-1-codex-max", 8.9, CODER),
            Family.of("gpt-5-1-codex-mini", 7.5, CODER),
            Family.of("gpt-5-1-codex", 8.7, CODER),
            Family.of("gpt-5-1", 8.6),
            Family.of("gpt-5-pro", 8.9, REASONER),
            Family.of("gpt-5-codex", 8.5, CODER),
            Family.of("gpt-5-mini", 7.5),
            Family.of("gpt-5-nano", 6.0),
            Family.of("gpt-5", 8.4),
            Family.of("(^|-)o3-pro", 8.7, REASONER),
            Family.of("(^|-)o3-mini", 7.8, REASONER),
            Family.of("(^|-)o3", 8.5, REASONER),
            Family.of("(^|-)o4-mini", 8.0, REASONER),
            Family.of("(^|-)o1-pro", 8.0, REASONER),
            Family.of("(^|-)o1", 7.8, REASONER),
            Family.of("gpt-4-1-mini", 7.0),
            Family.of("gpt-4-1-nano", 5.8),
            Family.of("gpt-4-1", 7.8),
            Family.of("gpt-4o-mini", 6.2),
            Family.of("gpt-4o", 7.2),
            Family.of("gpt-4", 6.8),
            Family.of("gpt-oss-120b", 7.2),
            Family.of("gpt-oss-20b", 6.0),
            Family.of("gpt-3-5|gpt-3\\.5", 4.5),
            // Google
            Family.of("gemini-3-1-pro", 9.5),
            Family.of("gemini-3-pro", 9.3),
            Family.of("gemini-3-1-flash-lite", 7.5),
            Family.of("gemini-3-flash", 8.7),
            Family.of("gemini-2-5-pro", 8.6),
            Family.of("gemini-2-5-flash-lite", 7.0),
            Family.of("gemini-2-5-flash", 7.9),
            Family.of("gemini-2-0-flash-lite", 6.2),
            Family.of("gemini-2-0-flash", 6.8),
            Family.of("gemini-1-5-pro", 7.0),
            Family.of("gemini-1-5-flash", 6.0),
            Family.of("gemma-4", 6.8),
            Family.of("gemma-3n", 4.5),
            Family.of("gemma-3-27b", 6.3),
            Family.of("gemma-3-12b", 5.6),
            Family.of("gemma-3-4b", 4.6),
            Family.of("gemma-?2-27b", 5.8),
            Family.of("gemma-?2-9b", 5.0),
            Family.of("gemma-?2-2b", 4.0),
            Family.of("gemma", 5.0),
            // xAI
            Family.of("grok-4-20", 9.4),
            Family.of("grok-4-1-fast", 8.8),
            Family.of("grok-4-fast", 8.4),
            Family.of("grok-4", 8.8),
            Family.of("grok-code-fast", 7.8, CODER),
            Family.of("grok-3-mini", 7.0),
            Family.of("grok-3", 7.8),
            // DeepSeek
            Family.of("deepseek-v3-2", 8.8, Map.of("coding", 0.3)),
            Family.of("deepseek-(chat-)?v3-1|terminus", 8.4),
            Family.of("deepseek-chat-v3-0324", 8.0),
            Family.of("deepseek-chat", 7.8),
            Family.of("deepseek-r1-0528", 8.4, REASONER),
            Family.of("r1-distill-llama-70b", 7.2, REASONER),
            Family.of("r1-distill-qwen-32b", 6.8, REASONER),
            Family.of("deepseek-r1-70b", 7.2, REASONER),
            Family.of("deepseek-r1-32b", 6.5, REASONER),
            Family.of("deepseek-r1-(7|14)b", 5.5, REASONER),
            Family.of("deepseek-r1", 8.2, REASONER),
            Family.of("deepseek-coder", 6.8, CODER),
            Family.of("cogito", 8.2),
            Family.of("r1t2|chimera", 7.4, REASONER),
            // Meta
            Family.of("llama-4-maverick", 8.0),
            Family.of("llama-4-scout", 7.2),
            Family.of("llama-?3[-.]3-70b", 7.2),
            Family.of("llama-?3[-.]1-405b", 7.6),
            Family.of("llama-?3[-.]1-70b", 7.0),
            Family.of("llama-?3[-.]1-8b", 5.5),
            Family.of("llama-?3[-.]2-vision-90b|llama-3-2-90b", 6.5),
            Family.of("llama-?3[-.]2-vision-11b|llama-3-2-11b", 5.5),
            Family.of("llama-?3[-.]2-1b", 3.5),
            Family.of("llama-?3[-.]2-3b", 4.5),
            Family.of("llama-?3-70b", 6.5),
            Family.of("llama-?3-8b|llama-3-groq", 5.0),
            Family.of("codellama-34b", 5.5, CODER),
            Family.of("codellama", 4.8, CODER),
            // Qwen
            Family.of("qwen3-6", 9.2),
            Family.of("qwen3-5-397b|qwen3-5-plus", 9.0),
            Family.of("qwen3-5-122b", 8.6),
            Family.of("qwen3-5-flash", 8.0),
            Family.of("qwen3-5-35b", 7.8),
            Family.of("qwen3-5-27b", 7.5),
            Family.of("qwen3-5-9b", 6.5),
            Family.of("qwen3-max", 8.6),
            Family.of("qwen3-coder-(next|plus)", 8.4, CODER),
            Family.of("qwen3-coder-flash", 7.6, CODER),
            Family.of("qwen3-coder", 8.0, CODER),
            Family.of("qwen3-next-80b", 7.8),
            Family.of("qwen3-(vl-)?235b", 8.2),
            Family.of("qwen3-vl-3[02]b", 7.2),
            Family.of("qwen3-vl-8b", 6.0),
            Family.of("qwen3-3[02]b", 7.2),
            Family.of("qwen3-14b", 6.5),
            Family.of("qwen3-8b", 5.8),
            Family.of("qwq", 7.0, REASONER),
            Family.of("qwen-?2[-.]5-coder-32b", 6.8, CODER),
            Family.of("qwen-?2[-.]5-coder", 5.8, CODER),
            Family.of("qwen-?2[-.]5-(vl-)?72b", 7.0),
            Family.of("qwen-?2[-.]5-(vl-)?32b", 6.5),
            Family.of("qwen-?2[-.]5-14b", 6.0),
            Family.of("qwen-?2[-.]5-7b", 5.2),
            Family.of("qwen-max", 8.0),
            Family.of("qwen-plus", 7.5),
            Family.of("qwen-turbo", 6.2),
            Family.of("qwen-vl-max", 7.5),
            Family.of("qwen-vl-plus", 6.5),
            Family.of("qwen2-7b", 4.8),
            // Mistral
            Family.of("mistral-large-2512", 8.2),
            Family.of("mistral-large", 7.5),
            Family.of("mistral-medium-3", 7.8),
            Family.of("devstral-(2512|medium)", 7.8, CODER),
            Family.of("devstral", 7.0, CODER),
            Family.of("codestral", 7.2, CODER),
            Family.of("mistral-small-creative", 6.8, Map.of("writing", 0.8)),
            Family.of("mistral-small", 6.5),
            Family.of("ministral-14b", 6.0),
            Family.of("ministral-8b", 5.5),
            Family.of("ministral-3b", 4.5),
            Family.of("mistral-nemo", 5.5),
            Family.of("pixtral-large", 7.5),
            Family.of("mixtral-8x22b", 6.5),
            Family.of("mixtral", 5.8),
            Family.of("mistral-saba", 6.5),
            Family.of("mistral-7b", 4.8),
            // Chinese labs & others
            Family.of("kimi-k2-5", 9.0),
            Family.of("kimi-k2-thinking", 8.6, REASONER),
            Family.of("kimi-k2", 8.2),
            Family.of("glm-5-1", 9.1),
            Family.of("glm-5v", 8.6),
            Family.of("glm-5-turbo", 8.4),
            Family.of("glm-5", 8.9, Map.of("coding", 0.4)),
            Family.of("glm-4-7-flash", 7.6),
            Family.of("glm-4-7", 8.4, Map.of("coding", 0.4)),
            Family.of("glm-4-6", 8.2, Map.of("coding", 0.4)),
            Family.of("glm-4-5-air", 7.4),
            Family.of("glm-4-5", 7.9),
            Family.of("glm-4", 7.0),
            Family.of("minimax-m2-7", 8.8),
            Family.of("minimax-m2-5", 8.7),
            Family.of("minimax-m2", 8.2, Map.of("coding", 0.3)),
            Family.of("minimax-m1", 7.4),
            Family.of("minimax-01", 7.0),
            Family.of("command-a", 7.8, RAG_TUNED),
            Family.of("command-r-plus", 7.0, RAG_TUNED),
            Family.of("command-r7b", 5.5, RAG_TUNED),
            Family.of("command-r", 6.5, RAG_TUNED),
            Family.of("command-light", 4.5),
            Family.of("sonar-deep-research", 8.0, WEB_RAG),
            Family.of("sonar-reasoning-pro", 7.8, WEB_RAG),
            Family.of("sonar-reasoning", 7.4, WEB_RAG),
            Family.of("sonar-pro", 7.6, WEB_RAG),
            Family.of("sonar-large", 7.0, WEB_RAG),
            Family.of("sonar", 6.5, WEB_RAG),
            Family.of("nova-premier", 7.6),
            Family.of("nova-2-lite", 7.0),
            Family.of("nova-pro", 7.0),
            Family.of("nova-lite", 6.0),
            Family.of("nova-micro", 5.2),
            Family.of("phi-?4", 6.2),
            Family.of("phi-?3", 4.8),
            Family.of("dbrx", 6.0),
            Family.of("jamba", 6.8),
            Family.of("ernie-4-5-(300b|vl-424b)", 7.6),
            Family.of("ernie", 6.5),
            Family.of("hunyuan", 6.3),
            Family.of("solar-pro", 6.8),
            Family.of("palmyra", 6.8),
            Family.of("granite", 5.5),
            Family.of("olmo-3", 6.3),
            Family.of("olmo", 5.5),
            Family.of("seed-2-0", 8.0),
            Family.of("seed-1-6", 7.4),
            Family.of("step-3-5", 7.8),
            Family.of("mimo-v2-pro", 8.2),
            Family.of("mimo-v2", 7.6),
            Family.of("intellect-3", 7.2),
            Family.of("kat-coder", 7.8, CODER),
            Family.of("mercury", 7.0),
            Family.of("trinity-large", 7.8),
            Family.of("trinity-mini", 6.5),
            Family.of("maestro", 7.2, REASONER),
            Family.of("virtuoso", 7.0),
            Family.of("arcee", 6.5),
            Family.of("wizardlm", 6.0),
            Family.of("hermes-3-llama-3-1-405b", 7.2),
            Family.of("hermes", 6.2),
            Family.of("tongyi-deepresearch", 7.0, Map.of("rag", 1.0, "analysis", 0.4)),
            Family.of("aion", 6.5),
            Family.of("lfm", 5.5),
            Family.of("reka-flash", 6.0),
            Family.of("reka-edge", 4.8),
            Family.of("ui-tars", 6.0, Map.of("agents", 0.8)),
            Family.of("inflection", 6.0, Map.of("writing", 0.5)),
            // Roleplay / creative-writing fine-tunes
            Family.of("mythomax|euryale|lunaris|cydonia|rocinante|magnum|unslopnemo|skyfall"
                    + "|weaver|hanami|goliath|dolphin|venice|remm-slerp|mytho", 5.0, ROLEPLAY)
    );

    // Max share a live Arena ELO (normalized to 0–10) gets vs. the curated tier
    private static final double ARENA_BLEND = 0.5;

    // Votes at which an arena rating earns full blend weight; fewer votes taper
    // the weight logarithmically (a 50-vote rating is noise, a 5000-vote one isn't)
    private static final int ARENA_FULL_CONFIDENCE_VOTES = 2_000;

    /**
     * Which arena.ai category board carries signal for each use case.
     * agents → code: the agent board has no scrapeable data, and agentic
     * ability tracks the coding board closely. Anything unmapped falls back
     * to the general text board.
     */
    static final Map<String, String> USE_CASE_ARENA_CATEGORY = Map.of(
            "coding", "code",
            "agents", "code",
            "vision", "vision",
            "rag", "search",
            "summarization", "document",
            "long-context", "document",
            "writing", "text",
            "analysis", "text");

    private static final String FALLBACK_CATEGORY = "text";

    private final ModelRepository modelRepository;
    private final UseCaseScoreRepository useCaseScoreRepository;
    private final ArenaScoreRepository arenaScoreRepository;

    /**
     * Recomputes scores for all active models: curated family tier, blended
     * per use case with the matching LMArena category board where one exists
     * (vote count scales the blend weight), then metadata gates.
     * Returns rows written.
     */
    public Mono<Integer> recomputeAll() {
        String computedAt = LocalDateTime.now().toString();
        return modelRepository.findAll()
                .collectList()
                .zipWith(arenaScoreRepository.findLatestPerModel().collectList())
                .flatMap(tuple -> {
                    List<AiModel> models = tuple.getT1();
                    Map<String, Map<String, ArenaSignal>> arenaByCategory =
                            normalizeEloByCategory(tuple.getT2());
                    if (!arenaByCategory.isEmpty()) {
                        arenaByCategory.forEach((cat, byModel) -> log.info(
                                "Blending {} LMArena '{}' ELO scores into use-case ratings",
                                byModel.size(), cat));
                    }

                    List<UseCaseScore> scores = new ArrayList<>();
                    for (AiModel model : models) {
                        if (isNonAssistant(model)) continue;
                        for (String useCase : USE_CASES) {
                            ArenaSignal signal = arenaSignalFor(arenaByCategory, model.getId(), useCase);
                            UseCaseScore ucs = new UseCaseScore();
                            ucs.setModelId(model.getId());
                            ucs.setUseCase(useCase);
                            ucs.setScore(signal != null
                                    ? score(model, useCase, signal.score(), signal.votes())
                                    : score(model, useCase, null));
                            ucs.setComputedAt(computedAt);
                            scores.add(ucs);
                        }
                    }
                    return Flux.fromIterable(scores)
                            .flatMap(useCaseScoreRepository::upsert, 8)
                            .then(Mono.just(scores.size()));
                });
    }

    /** Normalized 0–10 arena rating plus the vote count backing it. */
    record ArenaSignal(double score, int votes) {}

    /** Category board mapped to the use case, falling back to the text board. */
    static ArenaSignal arenaSignalFor(Map<String, Map<String, ArenaSignal>> arenaByCategory,
                                      String modelId, String useCase) {
        String category = USE_CASE_ARENA_CATEGORY.getOrDefault(useCase, FALLBACK_CATEGORY);
        ArenaSignal signal = arenaByCategory.getOrDefault(category, Map.of()).get(modelId);
        if (signal == null && !FALLBACK_CATEGORY.equals(category)) {
            signal = arenaByCategory.getOrDefault(FALLBACK_CATEGORY, Map.of()).get(modelId);
        }
        return signal;
    }

    /**
     * Maps each category's ELO range linearly onto 2–10 (worst matched model
     * on that board → 2, best → 10). Boards with too few matched models to
     * define a scale are dropped.
     */
    static Map<String, Map<String, ArenaSignal>> normalizeEloByCategory(List<ArenaScore> arenaScores) {
        Map<String, List<ArenaScore>> byCategory = new HashMap<>();
        for (ArenaScore s : arenaScores) {
            String cat = s.getCategory() != null ? s.getCategory() : FALLBACK_CATEGORY;
            byCategory.computeIfAbsent(cat, k -> new ArrayList<>()).add(s);
        }

        Map<String, Map<String, ArenaSignal>> out = new HashMap<>();
        byCategory.forEach((category, scores) -> {
            if (scores.size() < 5) return;   // too few points to define a scale
            int min = Integer.MAX_VALUE, max = Integer.MIN_VALUE;
            for (ArenaScore s : scores) {
                min = Math.min(min, s.getEloScore());
                max = Math.max(max, s.getEloScore());
            }
            if (max <= min) return;
            Map<String, ArenaSignal> byModel = new HashMap<>();
            for (ArenaScore s : scores) {
                double normalized = 2.0 + 8.0 * (s.getEloScore() - min) / (max - min);
                int votes = s.getVotes() != null ? s.getVotes() : 0;
                byModel.put(s.getModelId(), new ArenaSignal(normalized, votes));
            }
            out.put(category, byModel);
        });
        return out;
    }

    public static boolean isNonAssistant(AiModel model) {
        if (Boolean.TRUE.equals(caps(model).get("embeddings"))) return true;
        return NON_ASSISTANT.matcher(model.getId().toLowerCase()).find();
    }

    /** Score 0–10 for one model and use case: family base + specialty delta + metadata gates. */
    public static double score(AiModel model, String useCase) {
        return score(model, useCase, null);
    }

    /** As above, with the curated base blended against a live Arena ELO (0–10) when present. */
    public static double score(AiModel model, String useCase, Double arena10) {
        return score(model, useCase, arena10, null);
    }

    /**
     * As above; when {@code votes} is known, low-vote arena ratings get
     * proportionally less blend weight (0 or null votes = trust fully,
     * for rows scraped before vote counts were captured).
     */
    public static double score(AiModel model, String useCase, Double arena10, Integer votes) {
        String id = model.getId().toLowerCase();
        double base = DEFAULT_BASE;
        Map<String, Double> deltas = Map.of();
        for (Family f : FAMILIES) {
            if (f.pattern().matcher(id).find()) {
                base = f.base();
                deltas = f.deltas();
                break;
            }
        }
        // Real-world ELO corrects the curated tier; gates below still apply
        if (arena10 != null) {
            double weight = ARENA_BLEND * arenaConfidence(votes);
            base = base * (1 - weight) + arena10 * weight;
        }
        double score = base + deltas.getOrDefault(useCase, 0.0);
        score = applyMetadataGates(model, useCase, score);
        return Math.round(clamp(score) * 10.0) / 10.0;
    }

    private static double applyMetadataGates(AiModel model, String useCase, double score) {
        Map<String, Object> caps = caps(model);
        int cw = model.getContextWindow() != null ? model.getContextWindow() : 0;

        switch (useCase) {
            case "vision" -> {
                // Hard gate: recommending a text-only model for vision is always wrong
                if (!Boolean.TRUE.equals(caps.get("vision"))) return 1.0;
            }
            case "agents" -> {
                // Soft penalty only: provider tool-support metadata is unreliable
                if (!Boolean.TRUE.equals(caps.get("function_calling"))) score -= 1.5;
            }
            case "rag" -> {
                if (Boolean.TRUE.equals(caps.get("web_search"))) score += 1.5;
                if (Boolean.TRUE.equals(caps.get("rag"))) score += 1.0;
                if (cw > 0 && cw < 16_384) score = Math.min(score, 4.0);
            }
            case "summarization" -> {
                if (cw > 0 && cw < 16_384) score = Math.min(score, 4.0);
            }
            case "long-context" -> {
                if (cw < 32_768) score = Math.min(score, 3.5);
                else if (cw < 131_072) score = Math.min(score, 6.0);
                else if (cw >= 1_000_000) score += 1.0;
                else if (cw >= 400_000) score += 0.5;
            }
            default -> { }
        }
        return score;
    }

    /** 0–1 confidence in an arena rating from its vote count (log taper). */
    static double arenaConfidence(Integer votes) {
        if (votes == null || votes <= 0) return 1.0;   // vote count unknown
        return Math.min(1.0, Math.log1p(votes) / Math.log1p(ARENA_FULL_CONFIDENCE_VOTES));
    }

    private static Map<String, Object> caps(AiModel model) {
        return model.getCapabilities() != null ? model.getCapabilities() : Map.of();
    }

    private static double clamp(double v) {
        return Math.max(0.0, Math.min(10.0, v));
    }
}
