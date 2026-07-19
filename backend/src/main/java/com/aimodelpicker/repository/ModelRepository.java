package com.aimodelpicker.repository;

import com.aimodelpicker.model.AiModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ModelRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<AiModel> findAll() {
        return mongo.find(Query.query(Criteria.where("active").is(true))
                .with(Sort.by("inputPricePer1m")), AiModel.class);
    }

    public Flux<AiModel> findAllIncludingInactive() {
        return mongo.find(new Query().with(Sort.by("providerId", "name")), AiModel.class);
    }

    public Mono<AiModel> findById(String id) {
        return mongo.findById(id, AiModel.class);
    }

    public Flux<AiModel> findByProviderId(String providerId) {
        return mongo.find(Query.query(
                Criteria.where("providerId").is(providerId).and("active").is(true)), AiModel.class);
    }

    public Mono<Boolean> existsByExternalId(String externalId) {
        return mongo.exists(Query.query(Criteria.where("externalId").is(externalId)), AiModel.class);
    }

    /** Insert or update by id; `active` and `createdAt` are preserved on update. */
    public Mono<Integer> upsert(AiModel model) {
        String now = LocalDateTime.now().toString();
        Update update = new Update()
                .set("name", model.getName())
                .set("providerId", model.getProviderId())
                .set("pricingModel", model.getPricingModel())
                .set("inputPricePer1m", model.getInputPricePer1m())
                .set("outputPricePer1m", model.getOutputPricePer1m())
                .set("batchInputPer1m", model.getBatchInputPer1m())
                .set("batchOutputPer1m", model.getBatchOutputPer1m())
                .set("requestPrice", model.getRequestPrice())
                .set("contextWindow", model.getContextWindow())
                .set("maxOutputTokens", model.getMaxOutputTokens())
                .set("speedTier", model.getSpeedTier())
                .set("capabilities", model.getCapabilities())
                .set("source", model.getSource())
                .set("externalId", model.getExternalId())
                .set("notes", model.getNotes())
                .set("updatedAt", now)
                .setOnInsert("active", true)
                .setOnInsert("createdAt", now);
        return mongo.upsert(Query.query(Criteria.where("_id").is(model.getId())), update, AiModel.class)
                .map(r -> (int) (r.getModifiedCount() + (r.getUpsertedId() != null ? 1 : 0)));
    }

    public Mono<Void> softDelete(String id) {
        return setActive(id, false);
    }

    public Mono<Void> activate(String id) {
        return setActive(id, true);
    }

    private Mono<Void> setActive(String id, boolean active) {
        return mongo.updateFirst(
                        Query.query(Criteria.where("_id").is(id)),
                        new Update().set("active", active)
                                .set("updatedAt", LocalDateTime.now().toString()),
                        AiModel.class)
                .then();
    }
}
