package com.aimodelpicker.scraper;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.repository.ModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scrapes the LMArena (formerly LMSYS Chatbot Arena) leaderboard.
 * The lmarena.ai leaderboard page embeds its data as escaped JSON in the
 * React server-component payload; entries look like
 *   {\"rank\":16,...,\"modelDisplayName\":\"gpt-5.5\",\"rating\":1474.6,...}
 * We extract display name + rating, then resolve names against the model
 * catalog by normalized-id matching (exact after stripping provider prefix,
 * date suffixes, and -thinking variants).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LmsysArenaScraper {

    // lmarena.ai 301s here (2026 rebrand); WebClient also follows redirects now
    private static final String LEADERBOARD_URL = "https://arena.ai/leaderboard";

    private static final Pattern ENTRY = Pattern.compile(
            "\\{\"rank\":(\\d+),[^{}]*?\"modelDisplayName\":\"([^\"]+)\",\"rating\":([0-9.]+)");

    // Trailing decorations on arena names that our catalog ids don't carry
    private static final Pattern STRIP_SUFFIX = Pattern.compile(
            "(-\\d{8}|-thinking(-\\d+k)?|-high|-low|-mini-high|\\(.*\\))+$");

    private final WebClient webClient;
    private final ModelRepository modelRepository;

    public Flux<ArenaScore> scrape() {
        log.info("Scraping LMArena leaderboard...");
        return modelRepository.findAll()
                .collectList()
                .flatMapMany(models -> webClient.get()
                        .uri(LEADERBOARD_URL)
                        .header("User-Agent", "Mozilla/5.0 (ai-model-picker)")
                        .retrieve()
                        .bodyToMono(String.class)
                        .flatMapMany(html -> Flux.fromIterable(parse(html, models))))
                .doOnError(e -> log.error("LMArena scrape failed: {}", e.getMessage()));
    }

    List<ArenaScore> parse(String html, List<AiModel> catalog) {
        // Page data arrives escaped inside a JS string; unescape once
        String text = html.replace("\\\"", "\"");

        // Catalog lookup: normalized id-without-provider → model id
        Map<String, String> catalogIndex = new HashMap<>();
        for (AiModel m : catalog) {
            String id = m.getId();
            String bare = id.startsWith(m.getProviderId() + "-")
                    ? id.substring(m.getProviderId().length() + 1) : id;
            catalogIndex.putIfAbsent(normalize(bare), id);
        }

        // The page embeds several category boards; keep the best rating per model
        Map<String, ArenaScore> best = new HashMap<>();
        String scrapedAt = LocalDateTime.now().toString();
        Matcher m = ENTRY.matcher(text);
        int seen = 0;
        while (m.find()) {
            seen++;
            String displayName = m.group(2);
            String resolvedId = catalogIndex.get(normalize(displayName));
            if (resolvedId == null) continue;

            int elo = (int) Math.round(Double.parseDouble(m.group(3)));
            ArenaScore existing = best.get(resolvedId);
            if (existing == null || elo > existing.getEloScore()) {
                ArenaScore s = new ArenaScore();
                s.setModelId(resolvedId);
                s.setModelNameOnLeaderboard(displayName);
                s.setEloScore(elo);
                s.setRankPosition(Integer.parseInt(m.group(1)));
                s.setVotes(0);
                s.setScrapedAt(scrapedAt);
                best.put(resolvedId, s);
            }
        }

        log.info("LMArena: {} leaderboard entries, {} matched to catalog", seen, best.size());
        return new ArrayList<>(best.values());
    }

    /** gpt-5.4 / GPT-5.4 / claude-opus-4-1-20250805-thinking-16k → gpt-5-4 / claude-opus-4-1 */
    static String normalize(String name) {
        String n = name.toLowerCase(Locale.ROOT).trim()
                .replace('.', '-').replace('_', '-').replace(' ', '-');
        n = STRIP_SUFFIX.matcher(n).replaceAll("");
        return n;
    }
}
