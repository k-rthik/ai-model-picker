package com.aimodelpicker.repository;

import com.aimodelpicker.model.BenchmarkScore;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class BenchmarkScoreRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<BenchmarkScore> ROW_MAPPER = (rs, rowNum) -> {
        BenchmarkScore b = new BenchmarkScore();
        b.setId(rs.getLong("id"));
        b.setModelId(rs.getString("model_id"));
        b.setBenchmarkName(rs.getString("benchmark_name"));
        b.setScore(rs.getDouble("score"));
        b.setSource(rs.getString("source"));
        b.setScrapedAt(rs.getString("scraped_at"));
        return b;
    };

    public Flux<BenchmarkScore> findAll() {
        return Mono.fromCallable(() -> jdbc.query("SELECT * FROM benchmark_scores", ROW_MAPPER))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<BenchmarkScore> findByModelId(String modelId) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM benchmark_scores WHERE model_id = ?", ROW_MAPPER, modelId))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Integer> upsert(BenchmarkScore score) {
        return Mono.fromCallable(() -> jdbc.update("""
                        INSERT INTO benchmark_scores (model_id, benchmark_name, score, source, scraped_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(model_id, benchmark_name, source)
                        DO UPDATE SET score = excluded.score, scraped_at = excluded.scraped_at
                        """,
                        score.getModelId(), score.getBenchmarkName(),
                        score.getScore(), score.getSource(), score.getScrapedAt()))
                .subscribeOn(Schedulers.boundedElastic());
    }
}
