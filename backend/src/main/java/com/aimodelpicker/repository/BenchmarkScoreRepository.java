package com.aimodelpicker.repository;

import com.aimodelpicker.model.BenchmarkScore;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
@RequiredArgsConstructor
public class BenchmarkScoreRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<BenchmarkScore> findAll() {
        return mongo.findAll(BenchmarkScore.class);
    }

    public Flux<BenchmarkScore> findByModelId(String modelId) {
        return mongo.find(Query.query(Criteria.where("modelId").is(modelId)), BenchmarkScore.class);
    }

    /** One score per (model, benchmark, source) — keyed upsert. */
    public Mono<Integer> upsert(BenchmarkScore score) {
        Update update = new Update()
                .set("score", score.getScore())
                .set("scrapedAt", score.getScrapedAt());
        return mongo.upsert(
                        Query.query(Criteria.where("modelId").is(score.getModelId())
                                .and("benchmarkName").is(score.getBenchmarkName())
                                .and("source").is(score.getSource())),
                        update, BenchmarkScore.class)
                .map(r -> (int) (r.getModifiedCount() + (r.getUpsertedId() != null ? 1 : 0)));
    }
}
