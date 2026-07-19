package com.aimodelpicker.repository;

import com.aimodelpicker.model.ScrapeLog;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
@RequiredArgsConstructor
public class ScrapeLogRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<ScrapeLog> findRecent(int limit) {
        return mongo.find(new Query().with(Sort.by(Sort.Direction.DESC, "ranAt")).limit(limit),
                ScrapeLog.class);
    }

    public Mono<Integer> insert(ScrapeLog log) {
        return mongo.insert(log).thenReturn(1);
    }
}
