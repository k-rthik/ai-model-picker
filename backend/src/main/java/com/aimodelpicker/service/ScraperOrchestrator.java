package com.aimodelpicker.service;

import com.aimodelpicker.ingestor.IngestionOrchestrator;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.model.BenchmarkScore;
import com.aimodelpicker.model.ScrapeLog;
import com.aimodelpicker.model.UseCaseScore;
import com.aimodelpicker.repository.*;
import com.aimodelpicker.scraper.ArtificialAnalysisScraper;
import com.aimodelpicker.scraper.HuggingFaceScraper;
import com.aimodelpicker.scraper.LmsysArenaScraper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Coordinates all scrapers, persists results, and recomputes use-case scores.
 * Runs daily at 02:00 UTC.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScraperOrchestrator {

    private static final Map<String, Map<String, Double>> USE_CASE_BENCHMARK_WEIGHTS = Map.of(
            "coding",        Map.of("MMLU", 0.2, "MATH", 0.4, "BBH", 0.3, "MMLU-Pro", 0.1),
            "analysis",      Map.of("MMLU", 0.3, "GPQA", 0.3, "BBH", 0.3, "MuSR", 0.1),
            "writing",       Map.of("IFEval", 0.5, "MMLU", 0.3, "BBH", 0.2),
            "summarization", Map.of("MMLU", 0.4, "IFEval", 0.4, "BBH", 0.2),
            "rag",           Map.of("MMLU", 0.4, "MMLU-Pro", 0.3, "BBH", 0.3),
            "agents",        Map.of("MATH", 0.3, "BBH", 0.4, "GPQA", 0.2, "MuSR", 0.1),
            "vision",        Map.of("MMLU", 0.5, "MMLU-Pro", 0.5),
            "long-context",  Map.of("MMLU", 0.4, "BBH", 0.3, "MuSR", 0.3)
    );

    private final IngestionOrchestrator ingestionOrchestrator;
    private final HeuristicUseCaseScorer heuristicScorer;
    private final HuggingFaceScraper hfScraper;
    private final LmsysArenaScraper lmsysScraper;
    private final ArtificialAnalysisScraper aaScraper;

    private final BenchmarkScoreRepository benchmarkRepo;
    private final ArenaScoreRepository arenaRepo;
    private final UseCaseScoreRepository useCaseRepo;
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
        return Mono.when(
                runHuggingFaceScrape(),
                runLmsysScrape(),
                runAaScrape()
        )
                // Heuristic baseline first, then benchmark-derived scores overwrite
                // it for whichever models actually have benchmark data.
                .then(heuristicScorer.recomputeAll())
                .then(recomputeUseCaseScores());
    }

    private Mono<Void> runHuggingFaceScrape() {
        return hfScraper.scrape()
                .collectList()
                .flatMap(scores -> upsertBenchmarkScores(scores)
                        .then(logScrape("huggingface", "success", scores.size(), null)))
                .onErrorResume(e -> logScrape("huggingface", "error", 0, e.getMessage()))
                .then();
    }

    private Mono<Void> runLmsysScrape() {
        return lmsysScraper.scrape()
                .collectList()
                .flatMap(scores -> insertArenaScores(scores)
                        .then(logScrape("lmsys", "success", scores.size(), null)))
                .onErrorResume(e -> logScrape("lmsys", "error", 0, e.getMessage()))
                .then();
    }

    private Mono<Void> runAaScrape() {
        return aaScraper.scrape()
                .collectList()
                .flatMap(scores -> upsertBenchmarkScores(scores)
                        .then(logScrape("artificialanalysis", "success", scores.size(), null)))
                .onErrorResume(e -> logScrape("artificialanalysis", "error", 0, e.getMessage()))
                .then();
    }

    private Mono<Void> upsertBenchmarkScores(List<BenchmarkScore> scores) {
        return Flux.fromIterable(scores)
                .concatMap(benchmarkRepo::upsert)
                .then();
    }

    private Mono<Void> insertArenaScores(List<ArenaScore> scores) {
        return Flux.fromIterable(scores)
                .concatMap(arenaRepo::insert)
                .then();
    }

    public Mono<Void> recomputeUseCaseScores() {
        log.info("Recomputing use-case scores from benchmarks...");

        return benchmarkRepo.findAll()
                .collectList()
                .flatMap(allScores -> {
                    Map<String, Map<String, Double>> modelBenchmarks = new HashMap<>();
                    for (BenchmarkScore bs : allScores) {
                        modelBenchmarks
                                .computeIfAbsent(bs.getModelId(), k -> new HashMap<>())
                                .merge(bs.getBenchmarkName(), bs.getScore(), Double::max);
                    }

                    Map<String, Double> benchmarkMaxes = new HashMap<>();
                    for (Map<String, Double> bm : modelBenchmarks.values()) {
                        bm.forEach((bench, score) -> benchmarkMaxes.merge(bench, score, Double::max));
                    }

                    String computedAt = LocalDateTime.now().toString();
                    List<UseCaseScore> computedScores = new ArrayList<>();

                    for (Map.Entry<String, Map<String, Double>> modelEntry : modelBenchmarks.entrySet()) {
                        String modelId = modelEntry.getKey();
                        Map<String, Double> benchmarks = modelEntry.getValue();

                        for (Map.Entry<String, Map<String, Double>> ucEntry : USE_CASE_BENCHMARK_WEIGHTS.entrySet()) {
                            String useCase = ucEntry.getKey();
                            Map<String, Double> weights = ucEntry.getValue();

                            double weightedSum = 0;
                            double totalWeight = 0;

                            for (Map.Entry<String, Double> wEntry : weights.entrySet()) {
                                Double rawScore = benchmarks.get(wEntry.getKey());
                                if (rawScore != null) {
                                    double maxScore = benchmarkMaxes.getOrDefault(wEntry.getKey(), 100.0);
                                    double normalized = maxScore > 0 ? (rawScore / maxScore) * 10.0 : 0;
                                    weightedSum += normalized * wEntry.getValue();
                                    totalWeight += wEntry.getValue();
                                }
                            }

                            if (totalWeight > 0) {
                                UseCaseScore ucs = new UseCaseScore();
                                ucs.setModelId(modelId);
                                ucs.setUseCase(useCase);
                                ucs.setScore(weightedSum / totalWeight);
                                ucs.setComputedAt(computedAt);
                                computedScores.add(ucs);
                            }
                        }
                    }

                    return Flux.fromIterable(computedScores)
                            .concatMap(useCaseRepo::upsert)
                            .then();
                });
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
