package com.aimodelpicker.repository;

import com.aimodelpicker.model.ArenaScore;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
@RequiredArgsConstructor
public class ArenaScoreRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<ArenaScore> findByModelId(String modelId) {
        return mongo.find(Query.query(Criteria.where("modelId").is(modelId)), ArenaScore.class);
    }

    public Flux<ArenaScore> findTopByElo(int limit) {
        return mongo.find(new Query().with(Sort.by(Sort.Direction.DESC, "eloScore")).limit(limit),
                ArenaScore.class);
    }

    /** Latest ELO per model and leaderboard category (max scrapedAt row wins). */
    public Flux<ArenaScore> findLatestPerModel() {
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.sort(Sort.Direction.DESC, "scrapedAt"),
                Aggregation.group("modelId", "category").first(Aggregation.ROOT).as("doc"),
                Aggregation.replaceRoot("doc"));
        return mongo.aggregate(agg, "arena_scores", ArenaScore.class);
    }

    public Mono<Integer> insert(ArenaScore score) {
        return mongo.insert(score).thenReturn(1);
    }
}
