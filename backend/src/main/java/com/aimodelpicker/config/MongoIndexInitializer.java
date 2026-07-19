package com.aimodelpicker.config;

import com.aimodelpicker.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/** Ensures query indexes exist on boot (idempotent). */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer {

    private final ReactiveMongoTemplate mongo;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        Mono.when(
                mongo.indexOps(AiModel.class).createIndex(
                        new Index().on("active", Sort.Direction.ASC)),
                mongo.indexOps(AiModel.class).createIndex(
                        new Index().on("externalId", Sort.Direction.ASC)),
                mongo.indexOps(UseCaseScore.class).createIndex(
                        new Index().on("useCase", Sort.Direction.ASC)),
                mongo.indexOps(UseCaseScore.class).createIndex(
                        new Index().on("modelId", Sort.Direction.ASC)
                                .on("useCase", Sort.Direction.ASC).unique()),
                mongo.indexOps(ArenaScore.class).createIndex(
                        new Index().on("modelId", Sort.Direction.ASC)
                                .on("category", Sort.Direction.ASC)),
                mongo.indexOps(BenchmarkScore.class).createIndex(
                        new Index().on("modelId", Sort.Direction.ASC)),
                mongo.indexOps(ScrapeLog.class).createIndex(
                        new Index().on("ranAt", Sort.Direction.DESC)),
                mongo.indexOps(IngestionLog.class).createIndex(
                        new Index().on("ranAt", Sort.Direction.DESC))
        ).subscribe(
                v -> {},
                e -> log.warn("Index creation failed (continuing): {}", e.getMessage()),
                () -> log.info("Mongo indexes ensured"));
    }
}
