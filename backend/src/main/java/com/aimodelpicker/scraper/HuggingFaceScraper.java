package com.aimodelpicker.scraper;

import com.aimodelpicker.model.BenchmarkScore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scrapes the HuggingFace Open LLM Leaderboard v2 dataset API.
 * Dataset: open-llm-leaderboard/results
 * API endpoint returns JSONL with benchmark scores.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HuggingFaceScraper {

    private static final String HF_DATASET_API =
            "https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=0&length=100";

    private static final String SOURCE = "huggingface";

    // Maps leaderboard model name fragments to our internal model IDs
    private static final Map<String, String> MODEL_NAME_MAP = Map.of(
            "claude-3-5-sonnet",  "claude-sonnet-4-6",
            "claude-3-opus",      "claude-opus-4-6",
            "claude-3-haiku",     "claude-haiku-4-5",
            "gpt-4o-mini",        "gpt-4o-mini",
            "gpt-4o",             "gpt-4o",
            "gemini-1.5-pro",     "gemini-1-5-pro",
            "gemini-1.5-flash",   "gemini-1-5-flash",
            "mistral-large",      "mistral-large"
    );

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public Flux<BenchmarkScore> scrape() {
        log.info("Scraping HuggingFace Open LLM Leaderboard...");

        return webClient.get()
                .uri(HF_DATASET_API)
                .retrieve()
                .bodyToMono(String.class)
                .flatMapMany(this::parseLeaderboardData)
                .doOnError(e -> log.error("HuggingFace scrape failed: {}", e.getMessage()));
    }

    private Flux<BenchmarkScore> parseLeaderboardData(String json) {
        List<BenchmarkScore> scores = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode rows = root.path("rows");

            for (JsonNode row : rows) {
                JsonNode rowData = row.path("row");
                String modelName = rowData.path("model_name").asText("").toLowerCase();
                String resolvedId = resolveModelId(modelName);
                if (resolvedId == null) continue;

                String scrapedAt = LocalDateTime.now().toString();

                addIfPresent(scores, resolvedId, "MMLU",        rowData.path("Average").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "IFEval",      rowData.path("IFEval").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "BBH",         rowData.path("BBH").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "MATH",        rowData.path("MATH Lvl 5").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "GPQA",        rowData.path("GPQA").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "MuSR",        rowData.path("MuSR").asDouble(-1), scrapedAt);
                addIfPresent(scores, resolvedId, "MMLU-Pro",    rowData.path("MMLU-PRO").asDouble(-1), scrapedAt);
            }

            log.info("HuggingFace: parsed {} benchmark scores", scores.size());
        } catch (Exception e) {
            log.error("Failed to parse HuggingFace response: {}", e.getMessage());
        }
        return Flux.fromIterable(scores);
    }

    private void addIfPresent(List<BenchmarkScore> scores, String modelId,
                               String benchmarkName, double value, String scrapedAt) {
        if (value >= 0) {
            BenchmarkScore score = new BenchmarkScore();
            score.setModelId(modelId);
            score.setBenchmarkName(benchmarkName);
            score.setScore(value);
            score.setSource(SOURCE);
            score.setScrapedAt(scrapedAt);
            scores.add(score);
        }
    }

    private String resolveModelId(String modelName) {
        for (Map.Entry<String, String> entry : MODEL_NAME_MAP.entrySet()) {
            if (modelName.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }
}
