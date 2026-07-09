package com.aimodelpicker.service;

import com.aimodelpicker.ingestor.IngestionOrchestrator;
import com.aimodelpicker.repository.ModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * On boot: if the model catalog is empty (fresh database, e.g. a new container
 * volume), run all ingestors first — otherwise models would only appear after
 * the 02:00 UTC cron. Then compute heuristic use-case scores either way.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StartupInitializer {

    private final ModelRepository modelRepository;
    private final IngestionOrchestrator ingestionOrchestrator;
    private final HeuristicUseCaseScorer heuristicScorer;
    private final ScraperOrchestrator scraperOrchestrator;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        modelRepository.findAll()
                .count()
                .flatMap(count -> {
                    if (count > 0) {
                        log.info("Startup: {} models already in catalog", count);
                        return Mono.empty();
                    }
                    log.info("Startup: empty model catalog — running all ingestors");
                    return ingestionOrchestrator.runAll()
                            .doOnNext(s -> log.info("Startup ingest [{}]: +{} ~{} skip {} {}",
                                    s.source(), s.added(), s.updated(), s.skipped(),
                                    s.error() != null ? "error: " + s.error() : ""))
                            .then();
                })
                .then(heuristicScorer.recomputeAll())
                .doOnNext(rows -> log.info("Startup: heuristic use-case scores computed: {} rows", rows))
                // Arena data lives on an ephemeral disk in prod — refresh it every
                // boot, then scores recompute with the ELO blend.
                .then(scraperOrchestrator.runAllScrapers())
                .subscribe(
                        v -> {},
                        e -> log.error("Startup initialization failed: {}", e.getMessage()),
                        () -> log.info("Startup: catalog, scores, and arena blend ready"));
    }
}
