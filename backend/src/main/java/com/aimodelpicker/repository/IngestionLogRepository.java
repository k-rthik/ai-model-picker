package com.aimodelpicker.repository;

import com.aimodelpicker.model.IngestionLog;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
@RequiredArgsConstructor
public class IngestionLogRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<IngestionLog> findRecent(int limit) {
        return mongo.find(new Query().with(Sort.by(Sort.Direction.DESC, "ranAt")).limit(limit),
                IngestionLog.class);
    }

    public Mono<Void> insert(IngestionLog log) {
        if (log.getRanAt() == null) {
            log.setRanAt(LocalDateTime.now().toString());
        }
        return mongo.insert(log).then();
    }
}
