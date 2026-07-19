package com.aimodelpicker.repository;

import com.aimodelpicker.model.Provider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
@RequiredArgsConstructor
public class ProviderRepository {

    private final ReactiveMongoTemplate mongo;

    public Flux<Provider> findAll() {
        return mongo.find(Query.query(Criteria.where("active").is(true))
                .with(Sort.by("name")), Provider.class);
    }

    public Mono<Provider> findById(String id) {
        return mongo.findById(id, Provider.class);
    }

    /** Insert provider if id not already present. */
    public Mono<Void> upsertIfAbsent(String id, String name, boolean isLocal) {
        String now = LocalDateTime.now().toString();
        Update update = new Update()
                .setOnInsert("name", name)
                .setOnInsert("isLocal", isLocal)
                .setOnInsert("active", true)
                .setOnInsert("createdAt", now)
                .setOnInsert("updatedAt", now);
        return mongo.upsert(Query.query(Criteria.where("_id").is(id)), update, Provider.class)
                .then();
    }

    public Mono<Void> upsert(Provider provider) {
        String now = LocalDateTime.now().toString();
        Update update = new Update()
                .set("name", provider.getName())
                .set("baseUrl", provider.getBaseUrl())
                .set("isLocal", Boolean.TRUE.equals(provider.getIsLocal()))
                .set("active", Boolean.TRUE.equals(provider.getActive()))
                .set("updatedAt", now)
                .setOnInsert("createdAt", now);
        return mongo.upsert(Query.query(Criteria.where("_id").is(provider.getId())), update, Provider.class)
                .then();
    }

    public Mono<Void> deactivate(String id) {
        return mongo.updateFirst(
                        Query.query(Criteria.where("_id").is(id)),
                        new Update().set("active", false)
                                .set("updatedAt", LocalDateTime.now().toString()),
                        Provider.class)
                .then();
    }
}
