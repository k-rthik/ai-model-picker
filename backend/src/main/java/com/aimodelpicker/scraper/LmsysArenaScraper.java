package com.aimodelpicker.scraper;

import com.aimodelpicker.model.ArenaScore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scrapes LMSYS Chatbot Arena leaderboard ELO scores.
 * Primary: HuggingFace dataset API for arena results.
 * Fallback: arena leaderboard HTML page.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LmsysArenaScraper {

    private static final String ARENA_DATASET_API =
            "https://datasets-server.huggingface.co/rows?dataset=lmsys%2Fchatbot_arena_conversations&config=default&split=train&offset=0&length=1";

    // Leaderboard published as a space — we scrape the JSON endpoint
    private static final String ARENA_LEADERBOARD_JSON =
            "https://raw.githubusercontent.com/lm-sys/FastChat/main/fastchat/serve/monitor/leaderboard_table_20240322.csv";

    private static final String SOURCE = "lmsys";

    private static final Map<String, String> MODEL_NAME_MAP = Map.ofEntries(
            Map.entry("claude-3-5-sonnet",    "claude-sonnet-4-6"),
            Map.entry("claude-3-opus",         "claude-opus-4-6"),
            Map.entry("claude-3-haiku",        "claude-haiku-4-5"),
            Map.entry("gpt-4o-2024",           "gpt-4o"),
            Map.entry("gpt-4o-mini",           "gpt-4o-mini"),
            Map.entry("o1-preview",            "gpt-o1"),
            Map.entry("gemini-1.5-pro",        "gemini-1-5-pro"),
            Map.entry("gemini-1.5-flash",      "gemini-1-5-flash"),
            Map.entry("llama-3",               "llama-3-groq"),
            Map.entry("mistral-large",         "mistral-large")
    );

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public Flux<ArenaScore> scrape() {
        log.info("Scraping LMSYS Chatbot Arena leaderboard...");

        return webClient.get()
                .uri(ARENA_LEADERBOARD_JSON)
                .retrieve()
                .bodyToMono(String.class)
                .flatMapMany(this::parseCsvLeaderboard)
                .doOnError(e -> log.error("LMSYS scrape failed: {}", e.getMessage()));
    }

    private Flux<ArenaScore> parseCsvLeaderboard(String csv) {
        List<ArenaScore> scores = new ArrayList<>();
        String scrapedAt = LocalDateTime.now().toString();

        try {
            String[] lines = csv.split("\n");
            if (lines.length < 2) return Flux.empty();

            // CSV header: Rank,Model,Arena Elo rating,95% CI,Votes,Organization,License
            int rank = 1;
            for (int i = 1; i < lines.length; i++) {
                String[] cols = lines[i].split(",");
                if (cols.length < 3) continue;

                String modelName = cols[1].trim().toLowerCase().replaceAll("\"", "");
                String resolvedId = resolveModelId(modelName);
                if (resolvedId == null) continue;

                try {
                    int elo = Integer.parseInt(cols[2].trim().replaceAll("\"", ""));
                    int votes = cols.length > 4 ? parseInt(cols[4].trim()) : 0;

                    ArenaScore score = new ArenaScore();
                    score.setModelId(resolvedId);
                    score.setModelNameOnLeaderboard(modelName);
                    score.setEloScore(elo);
                    score.setRankPosition(rank++);
                    score.setVotes(votes);
                    score.setScrapedAt(scrapedAt);
                    scores.add(score);
                } catch (NumberFormatException e) {
                    log.debug("Could not parse ELO for model {}: {}", modelName, e.getMessage());
                }
            }

            log.info("LMSYS Arena: parsed {} ELO scores", scores.size());
        } catch (Exception e) {
            log.error("Failed to parse LMSYS CSV: {}", e.getMessage());
        }
        return Flux.fromIterable(scores);
    }

    private String resolveModelId(String modelName) {
        for (Map.Entry<String, String> entry : MODEL_NAME_MAP.entrySet()) {
            if (modelName.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private int parseInt(String s) {
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
