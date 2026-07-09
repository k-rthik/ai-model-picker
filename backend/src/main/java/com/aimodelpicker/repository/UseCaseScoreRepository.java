package com.aimodelpicker.repository;

import com.aimodelpicker.model.UseCaseScore;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Repository
@RequiredArgsConstructor
public class UseCaseScoreRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<UseCaseScore> ROW_MAPPER = (rs, rowNum) -> {
        UseCaseScore u = new UseCaseScore();
        u.setId(rs.getLong("id"));
        u.setModelId(rs.getString("model_id"));
        u.setUseCase(rs.getString("use_case"));
        u.setScore(rs.getDouble("score"));
        u.setComputedAt(rs.getString("computed_at"));
        return u;
    };

    public Flux<UseCaseScore> findByModelId(String modelId) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM use_case_scores WHERE model_id = ?", ROW_MAPPER, modelId))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<UseCaseScore> findByUseCase(String useCase) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM use_case_scores WHERE use_case = ?", ROW_MAPPER, useCase))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<UseCaseScore> findByUseCaseOrderByScoreDesc(String useCase) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM use_case_scores WHERE use_case = ? ORDER BY score DESC", ROW_MAPPER, useCase))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Integer> upsert(UseCaseScore score) {
        return Mono.fromCallable(() -> jdbc.update("""
                        INSERT INTO use_case_scores (model_id, use_case, score, computed_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(model_id, use_case)
                        DO UPDATE SET score = excluded.score, computed_at = excluded.computed_at
                        """,
                        score.getModelId(), score.getUseCase(), score.getScore(), score.getComputedAt()))
                .subscribeOn(Schedulers.boundedElastic());
    }
}
