package com.aimodelpicker.controller;

import com.aimodelpicker.ingestor.IngestionOrchestrator;
import com.aimodelpicker.ingestor.ModelRecord;
import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.IngestionLog;
import com.aimodelpicker.model.Provider;
import com.aimodelpicker.model.ScrapeLog;
import com.aimodelpicker.repository.*;
import com.aimodelpicker.service.HeuristicUseCaseScorer;
import com.aimodelpicker.service.ScraperOrchestrator;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final ScraperOrchestrator scraperOrchestrator;
    private final HeuristicUseCaseScorer heuristicScorer;
    private final IngestionOrchestrator ingestionOrchestrator;
    private final ScrapeLogRepository scrapeLogRepo;
    private final IngestionLogRepository ingestionLogRepo;
    private final ModelRepository modelRepository;
    private final ProviderRepository providerRepository;

    // ── Ingestion ──────────────────────────────────────────────────────────────

    /** Run all ingestors (OpenRouter + YAML). */
    @PostMapping("/ingest")
    public Flux<IngestionOrchestrator.IngestionSummary> triggerIngest() {
        return ingestionOrchestrator.runAll();
    }

    /** Run a single ingestor by sourceId (e.g. openrouter, yaml). */
    @PostMapping("/ingest/{sourceId}")
    public Mono<IngestionOrchestrator.IngestionSummary> triggerIngestSource(@PathVariable String sourceId) {
        return ingestionOrchestrator.run(sourceId);
    }

    @GetMapping("/ingestion-logs")
    public Flux<IngestionLog> getIngestionLogs() {
        return ingestionLogRepo.findRecent(50);
    }

    // ── Arena scraping & scoring ──────────────────────────────────────────────

    @PostMapping("/scrape")
    public Mono<String> triggerScrape() {
        return scraperOrchestrator.runAllScrapers().thenReturn("Scrape complete");
    }

    @PostMapping("/recompute")
    public Mono<String> triggerRecompute() {
        return heuristicScorer.recomputeAll()
                .map(count -> "Use-case scores recomputed (" + count
                        + " rows; arena category boards blended where matched)");
    }

    @GetMapping("/scrape-logs")
    public Flux<ScrapeLog> getScrapeLogs() {
        return scrapeLogRepo.findRecent(50);
    }

    // ── Model management ──────────────────────────────────────────────────────

    @GetMapping("/models")
    public Flux<AiModel> listAllModels(@RequestParam(defaultValue = "true") boolean activeOnly) {
        return activeOnly ? modelRepository.findAll() : modelRepository.findAllIncludingInactive();
    }

    /** Add or update a single model. Body maps to ModelRecord fields. */
    @PostMapping("/models")
    public Mono<String> addModel(@RequestBody ModelRecord record) {
        return ingestionOrchestrator.upsertDirect(record)
                .thenReturn("Model " + record.id() + " upserted");
    }

    @DeleteMapping("/models/{id}")
    public Mono<String> deactivateModel(@PathVariable String id) {
        return modelRepository.softDelete(id).thenReturn("Model " + id + " deactivated");
    }

    @PostMapping("/models/{id}/activate")
    public Mono<String> activateModel(@PathVariable String id) {
        return modelRepository.activate(id).thenReturn("Model " + id + " activated");
    }

    // ── Provider management ───────────────────────────────────────────────────

    @GetMapping("/providers")
    public Flux<Provider> listProviders() {
        return providerRepository.findAll();
    }

    @PostMapping("/providers")
    public Mono<String> addProvider(@RequestBody Provider provider) {
        return providerRepository.upsert(provider)
                .thenReturn("Provider " + provider.getId() + " upserted");
    }

    @DeleteMapping("/providers/{id}")
    public Mono<String> deactivateProvider(@PathVariable String id) {
        return providerRepository.deactivate(id).thenReturn("Provider " + id + " deactivated");
    }
}
