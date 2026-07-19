package com.aimodelpicker.ingestor;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.IngestionLog;
import com.aimodelpicker.repository.IngestionLogRepository;
import com.aimodelpicker.repository.ModelRepository;
import com.aimodelpicker.repository.ProviderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Runs any ModelIngestor and persists results.
 * Auto-creates unknown providers. Tracks added/updated/skipped counts.
 * Adding a new source = implement ModelIngestor + @Component. No changes here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IngestionOrchestrator {

    private final List<ModelIngestor> ingestors;   // Spring injects ALL implementations
    private final ModelRepository modelRepository;
    private final ProviderRepository providerRepository;
    private final IngestionLogRepository ingestionLogRepo;

    public record IngestionSummary(String source, int added, int updated, int skipped, String error) {}

    /** Run all registered ingestors sequentially so summaries stay per-source. */
    public Flux<IngestionSummary> runAll() {
        return Flux.fromIterable(ingestors)
                .concatMap(this::run);
    }

    /** Run a specific ingestor by sourceId. */
    public Mono<IngestionSummary> run(String sourceId) {
        return Flux.fromIterable(ingestors)
                .filter(i -> i.sourceId().equals(sourceId))
                .next()
                .flatMap(this::run)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Unknown source: " + sourceId)));
    }

    private Mono<IngestionSummary> run(ModelIngestor ingestor) {
        AtomicInteger added   = new AtomicInteger();
        AtomicInteger updated = new AtomicInteger();
        AtomicInteger skipped = new AtomicInteger();

        return ingestor.ingest()
                .concatMap(record -> upsertModel(record, added, updated, skipped))
                .then(Mono.defer(() -> {
                    IngestionSummary summary = new IngestionSummary(
                            ingestor.sourceId(), added.get(), updated.get(), skipped.get(), null);
                    return logSummary(summary).thenReturn(summary);
                }))
                .onErrorResume(e -> {
                    log.error("Ingestor {} failed: {}", ingestor.sourceId(), e.getMessage());
                    IngestionSummary summary = new IngestionSummary(
                            ingestor.sourceId(), 0, 0, 0, e.getMessage());
                    return logSummary(summary).thenReturn(summary);
                });
    }

    private Mono<Void> upsertModel(ModelRecord record,
                                    AtomicInteger added, AtomicInteger updated, AtomicInteger skipped) {
        if (record.id() == null || record.providerId() == null) {
            skipped.incrementAndGet();
            return Mono.empty();
        }

        // Auto-create provider if not known
        String displayName = capitalize(record.providerId());
        return providerRepository.upsertIfAbsent(record.providerId(), displayName, false)
                .then(Mono.defer(() -> {
                    // Check if model already exists to determine add vs update counter
                    return modelRepository.findById(record.id())
                            .flatMap(existing -> {
                                updated.incrementAndGet();
                                return modelRepository.upsert(toModel(record)).then();
                            })
                            .switchIfEmpty(Mono.defer(() -> {
                                added.incrementAndGet();
                                return modelRepository.upsert(toModel(record)).then();
                            }));
                }));
    }

    /** Upsert a single ModelRecord directly (used by AdminController). */
    public Mono<Void> upsertDirect(ModelRecord record) {
        String displayName = capitalize(record.providerId());
        return providerRepository.upsertIfAbsent(record.providerId(), displayName, false)
                .then(modelRepository.upsert(toModel(record)))
                .then();
    }

    private AiModel toModel(ModelRecord r) {
        AiModel m = new AiModel();
        m.setId(r.id());
        m.setName(r.name());
        m.setProviderId(r.providerId());
        m.setPricingModel(r.pricingModel());
        m.setInputPricePer1m(r.inputPricePer1m());
        m.setOutputPricePer1m(r.outputPricePer1m());
        m.setBatchInputPer1m(r.batchInputPer1m());
        m.setBatchOutputPer1m(r.batchOutputPer1m());
        m.setRequestPrice(r.requestPrice());
        m.setContextWindow(r.contextWindow());
        m.setMaxOutputTokens(r.maxOutputTokens());
        m.setSpeedTier(r.speedTier());
        m.setCapabilities(r.capabilities() != null ? r.capabilities() : new HashMap<>());
        m.setSource(r.source());
        m.setExternalId(r.externalId());
        m.setNotes(r.notes());
        m.setActive(true);
        return m;
    }

    private Mono<Void> logSummary(IngestionSummary s) {
        IngestionLog log = new IngestionLog();
        log.setSource(s.source());
        log.setStatus(s.error() == null ? "success" : "error");
        log.setModelsAdded(s.added());
        log.setModelsUpdated(s.updated());
        log.setModelsSkipped(s.skipped());
        log.setErrorMessage(s.error());
        return ingestionLogRepo.insert(log);
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
