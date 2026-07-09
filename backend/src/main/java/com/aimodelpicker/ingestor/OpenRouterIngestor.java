package com.aimodelpicker.ingestor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ingests 200+ models from OpenRouter's public API.
 * No API key required.
 * Pricing is per-token in OpenRouter; we convert to per-1M.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenRouterIngestor implements ModelIngestor {

    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Override
    public String sourceId() {
        return "openrouter";
    }

    @Override
    public Flux<ModelRecord> ingest() {
        log.info("Ingesting models from OpenRouter...");

        return webClient.get()
                .uri(OPENROUTER_URL)
                .header("User-Agent", "AIModelPicker/1.0")
                .retrieve()
                .bodyToMono(String.class)
                .flatMapMany(this::parse)
                .doOnError(e -> log.error("OpenRouter ingest failed: {}", e.getMessage()));
    }

    private Flux<ModelRecord> parse(String json) {
        List<ModelRecord> records = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.path("data");

            for (JsonNode model : data) {
                try {
                    records.add(mapModel(model));
                } catch (Exception e) {
                    log.debug("Skipping model {}: {}", model.path("id").asText(), e.getMessage());
                }
            }
            log.info("OpenRouter: parsed {} models", records.size());
        } catch (Exception e) {
            log.error("OpenRouter parse error: {}", e.getMessage());
        }
        return Flux.fromIterable(records);
    }

    private ModelRecord mapModel(JsonNode model) {
        String externalId = model.path("id").asText();
        String name       = model.path("name").asText(externalId);

        // Derive provider from "provider/model-name" format, then normalize known slugs
        String providerId = externalId.contains("/")
                ? normalizeProvider(externalId.split("/")[0].toLowerCase().replaceAll("[^a-z0-9-]", "-"))
                : "unknown";

        // Internal id: sanitize external id
        String id = externalId.replaceAll("[^a-zA-Z0-9-]", "-").toLowerCase();

        // Pricing — OpenRouter gives per-token; multiply by 1M
        JsonNode pricing    = model.path("pricing");
        double promptPrice  = parsePrice(pricing.path("prompt").asText("0"));
        double completionP  = parsePrice(pricing.path("completion").asText("0"));
        double requestPrice = parsePrice(pricing.path("request").asText("0"));

        // OpenRouter uses -1 as sentinel for dynamic/variable pricing — treat as 0
        if (promptPrice  < 0) promptPrice  = 0;
        if (completionP  < 0) completionP  = 0;
        if (requestPrice < 0) requestPrice = 0;

        double inputPer1m  = promptPrice   * 1_000_000;
        double outputPer1m = completionP   * 1_000_000;

        String pricingModel = "per_token";
        Double reqPriceVal  = null;
        if (promptPrice == 0 && completionP == 0 && requestPrice == 0) {
            pricingModel = "free";
        } else if (requestPrice > 0 && promptPrice == 0) {
            pricingModel = "per_request";
            reqPriceVal  = requestPrice;
        }

        // Context
        int contextWindow     = model.path("context_length").asInt(0);
        JsonNode topProvider  = model.path("top_provider");
        Integer maxOutput     = topProvider.has("max_completion_tokens")
                ? topProvider.path("max_completion_tokens").asInt() : null;

        // Capabilities
        String modality = model.path("architecture").path("modality").asText("");
        Map<String, Object> caps = new HashMap<>();
        caps.put("vision",           modality.contains("image"));
        caps.put("streaming",        true);
        caps.put("function_calling", inferFunctionCalling(externalId, name));

        String speedTier = ModelRecord.inferSpeedTier(outputPer1m);

        return new ModelRecord(
                id, externalId, name, providerId, pricingModel,
                inputPer1m, outputPer1m, null, null, reqPriceVal,
                contextWindow, maxOutput, speedTier, caps,
                sourceId(), null
        );
    }

    private static final java.util.Map<String, String> PROVIDER_ALIASES = java.util.Map.ofEntries(
            java.util.Map.entry("mistralai",          "mistral"),
            java.util.Map.entry("meta-llama",         "meta"),
            java.util.Map.entry("google",             "google"),
            java.util.Map.entry("openai",             "openai"),
            java.util.Map.entry("anthropic",          "anthropic"),
            java.util.Map.entry("xai",                "x-ai"),
            java.util.Map.entry("x-ai",               "x-ai"),
            java.util.Map.entry("huggingfaceh4",      "huggingface"),
            java.util.Map.entry("huggingface",        "huggingface"),
            java.util.Map.entry("cohere",             "cohere"),
            java.util.Map.entry("databricks",         "databricks"),
            java.util.Map.entry("groq",               "groq"),
            java.util.Map.entry("perplexity",         "perplexity"),
            java.util.Map.entry("qwen",               "qwen"),
            java.util.Map.entry("deepseek",           "deepseek"),
            java.util.Map.entry("nvidia",             "nvidia"),
            java.util.Map.entry("microsoft",          "microsoft"),
            java.util.Map.entry("amazon",             "amazon")
    );

    private String normalizeProvider(String raw) {
        return PROVIDER_ALIASES.getOrDefault(raw, raw);
    }

    private double parsePrice(String s) {
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private boolean inferFunctionCalling(String id, String name) {
        String lower = (id + " " + name).toLowerCase();
        return lower.contains("gpt-4") || lower.contains("gpt-3.5")
                || lower.contains("claude") || lower.contains("gemini")
                || lower.contains("command") || lower.contains("mistral")
                || lower.contains("llama-3") || lower.contains("instruct");
    }
}
