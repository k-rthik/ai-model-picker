package com.aimodelpicker.scraper;

import com.aimodelpicker.model.BenchmarkScore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scrapes Artificial Analysis leaderboard for quality index, speed (tokens/sec),
 * and latency scores across major commercial models.
 * URL: https://artificialanalysis.ai/models
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ArtificialAnalysisScraper {

    private static final String AA_URL = "https://artificialanalysis.ai/models";
    private static final String SOURCE = "artificialanalysis";

    private static final Map<String, String> MODEL_NAME_MAP = Map.ofEntries(
            Map.entry("claude 3.5 sonnet",   "claude-sonnet-4-6"),
            Map.entry("claude 3 opus",        "claude-opus-4-6"),
            Map.entry("claude 3 haiku",       "claude-haiku-4-5"),
            Map.entry("gpt-4o",               "gpt-4o"),
            Map.entry("gpt-4o mini",          "gpt-4o-mini"),
            Map.entry("o1",                   "gpt-o1"),
            Map.entry("gemini 1.5 pro",       "gemini-1-5-pro"),
            Map.entry("gemini 1.5 flash",     "gemini-1-5-flash"),
            Map.entry("llama 3",              "llama-3-groq"),
            Map.entry("mistral large",        "mistral-large")
    );

    private final WebClient webClient;

    public Flux<BenchmarkScore> scrape() {
        log.info("Scraping Artificial Analysis leaderboard...");

        return webClient.get()
                .uri(AA_URL)
                .header("User-Agent", "Mozilla/5.0 (compatible; AIModelPicker/1.0)")
                .retrieve()
                .bodyToMono(String.class)
                .flatMapMany(this::parseHtml)
                .doOnError(e -> log.error("Artificial Analysis scrape failed: {}", e.getMessage()));
    }

    private Flux<BenchmarkScore> parseHtml(String html) {
        List<BenchmarkScore> scores = new ArrayList<>();
        String scrapedAt = LocalDateTime.now().toString();

        try {
            Document doc = Jsoup.parse(html);

            // Find the main model comparison table
            Elements rows = doc.select("table tbody tr");

            for (Element row : rows) {
                Elements cells = row.select("td");
                if (cells.size() < 4) continue;

                String modelName = cells.get(0).text().toLowerCase().trim();
                String resolvedId = resolveModelId(modelName);
                if (resolvedId == null) continue;

                // Column order varies, look for data attributes or known patterns
                // Typical columns: Model | Quality Index | Speed (t/s) | Latency (s) | Context | Price
                tryAddScore(scores, resolvedId, "Quality Index",    cells, 1, scrapedAt);
                tryAddScore(scores, resolvedId, "Speed (tokens/s)", cells, 2, scrapedAt);
                tryAddScore(scores, resolvedId, "Latency (s)",      cells, 3, scrapedAt);
            }

            // Also try data-* attributes if table is JS-rendered and partially visible
            Elements modelCards = doc.select("[data-model-name]");
            for (Element card : modelCards) {
                String modelName = card.attr("data-model-name").toLowerCase();
                String resolvedId = resolveModelId(modelName);
                if (resolvedId == null) continue;

                String quality  = card.attr("data-quality-index");
                String speed    = card.attr("data-speed");
                String latency  = card.attr("data-latency");

                parseAndAdd(scores, resolvedId, "Quality Index",    quality,  scrapedAt);
                parseAndAdd(scores, resolvedId, "Speed (tokens/s)", speed,    scrapedAt);
                parseAndAdd(scores, resolvedId, "Latency (s)",      latency,  scrapedAt);
            }

            log.info("Artificial Analysis: parsed {} scores", scores.size());
        } catch (Exception e) {
            log.error("Failed to parse Artificial Analysis HTML: {}", e.getMessage());
        }

        if (scores.isEmpty()) {
            log.warn("Artificial Analysis returned no scores — site may be JS-rendered. Consider using Playwright or a headless browser.");
        }

        return Flux.fromIterable(scores);
    }

    private void tryAddScore(List<BenchmarkScore> scores, String modelId,
                              String benchmarkName, Elements cells, int index, String scrapedAt) {
        if (index >= cells.size()) return;
        parseAndAdd(scores, modelId, benchmarkName, cells.get(index).text().trim(), scrapedAt);
    }

    private void parseAndAdd(List<BenchmarkScore> scores, String modelId,
                              String benchmarkName, String rawValue, String scrapedAt) {
        try {
            double value = Double.parseDouble(rawValue.replaceAll("[^0-9.]", ""));
            BenchmarkScore score = new BenchmarkScore();
            score.setModelId(modelId);
            score.setBenchmarkName(benchmarkName);
            score.setScore(value);
            score.setSource(SOURCE);
            score.setScrapedAt(scrapedAt);
            scores.add(score);
        } catch (NumberFormatException ignored) {
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
