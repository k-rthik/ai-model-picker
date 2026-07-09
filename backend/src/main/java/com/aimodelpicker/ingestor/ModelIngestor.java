package com.aimodelpicker.ingestor;

import reactor.core.publisher.Flux;

/**
 * Contract for any model data source.
 * Implement this interface and annotate with @Component to plug in a new source.
 */
public interface ModelIngestor {
    /** Stable identifier used in ingestion_log.source */
    String sourceId();

    /** Pull or emit model records. Must be non-blocking. */
    Flux<ModelRecord> ingest();
}
