package com.aimodelpicker.repository;

import com.aimodelpicker.model.UseCaseScore;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
@RequiredArgsConstructor
public class UseCaseScoreRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<UseCaseScore> findByModelId(String modelId) {
        return mongo.find(Query.query(Criteria.where("modelId").is(modelId)), UseCaseScore.class);
    }

    public Flux<UseCaseScore> findByUseCase(String useCase) {
        return mongo.find(Query.query(Criteria.where("useCase").is(useCase)), UseCaseScore.class);
    }

    public Flux<UseCaseScore> findByUseCaseOrderByScoreDesc(String useCase) {
        return mongo.find(Query.query(Criteria.where("useCase").is(useCase))
                .with(Sort.by(Sort.Direction.DESC, "score")), UseCaseScore.class);
    }

    /** One score per (model, use case) — keyed upsert. */
    public Mono<Integer> upsert(UseCaseScore score) {
        Update update = new Update()
                .set("score", score.getScore())
                .set("computedAt", score.getComputedAt());
        return mongo.upsert(
                        Query.query(Criteria.where("modelId").is(score.getModelId())
                                .and("useCase").is(score.getUseCase())),
                        update, UseCaseScore.class)
                .map(r -> (int) (r.getModifiedCount() + (r.getUpsertedId() != null ? 1 : 0)));
    }
}
