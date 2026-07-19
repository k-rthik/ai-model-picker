package com.aimodelpicker.service;

import com.aimodelpicker.ingestor.IngestionOrchestrator;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.model.ScrapeLog;
import com.aimodelpicker.repository.ArenaScoreRepository;
import com.aimodelpicker.repository.ScrapeLogRepository;
import com.aimodelpicker.scraper.LmsysArenaScraper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Coordinates scraping and score recomputation. Runs daily at 02:00 UTC.
 *
 * Pipeline: ingest catalog → scrape LMArena category boards → recompute
 * use-case scores (curated tiers blended with per-category arena ELO).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScraperOrchestrator {

    private final IngestionOrchestrator ingestionOrchestrator;
    private final HeuristicUseCaseScorer heuristicScorer;
    private final LmsysArenaScraper lmsysScraper;

    private final ArenaScoreRepository arenaRepo;
    private final ScrapeLogRepository scrapeLogRepo;

    @Scheduled(cron = "0 0 2 * * *", zone = "UTC")
    public void runDailyScrape() {
        log.info("Starting daily scrape + ingest job...");
        // Sequential: ingest then scrape — concurrent writers deadlock SQLite
        ingestionOrchestrator.runAll()
                .doOnNext(s -> log.info("Ingest [{}]: +{} ~{} skip{}", s.source(), s.added(), s.updated(), s.skipped()))
                .then(runAllScrapers())
                .subscribe(
                        null,
                        e -> log.error("Daily scrape/ingest failed: {}", e.getMessage()),
                        () -> log.info("Daily scrape + ingest complete")
                );
    }

    public Mono<Void> runAllScrapers() {
        // Arena ELO first; the scorer then blends it into the heuristic baseline.
        return runLmsysScrape()
                .then(heuristicScorer.recomputeAll())
                .then();
    }

    private Mono<Void> runLmsysScrape() {
        return lmsysScraper.scrape()
                .collectList()
                .flatMap(scores -> insertArenaScores(scores)
                        .then(logPerCategory(scores)))
                .onErrorResume(e -> logScrape("lmarena", "error", 0, e.getMessage()))
                .then();
    }

    private Mono<Void> insertArenaScores(List<ArenaScore> scores) {
        return Flux.fromIterable(scores)
                .concatMap(arenaRepo::insert)
                .then();
    }

    /** One scrape-log row per category board (lmarena:code etc.). */
    private Mono<Void> logPerCategory(List<ArenaScore> scores) {
        return Flux.fromIterable(LmsysArenaScraper.CATEGORIES)
                .concatMap(cat -> {
                    long n = scores.stream().filter(s -> cat.equals(s.getCategory())).count();
                    return logScrape("lmarena:" + cat, n > 0 ? "success" : "empty", (int) n, null);
                })
                .then();
    }

    private Mono<Void> logScrape(String source, String status, int records, String error) {
        ScrapeLog entry = new ScrapeLog();
        entry.setSource(source);
        entry.setStatus(status);
        entry.setRecordsUpserted(records);
        entry.setErrorMessage(error);
        entry.setRanAt(LocalDateTime.now().toString());
        return scrapeLogRepo.insert(entry).then();
    }
}
