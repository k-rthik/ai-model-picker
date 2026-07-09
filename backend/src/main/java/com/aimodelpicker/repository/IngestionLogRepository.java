package com.aimodelpicker.repository;

import com.aimodelpicker.model.IngestionLog;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Repository
@RequiredArgsConstructor
public class IngestionLogRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<IngestionLog> ROW_MAPPER = (rs, rowNum) -> {
        IngestionLog l = new IngestionLog();
        l.setId(rs.getLong("id"));
        l.setSource(rs.getString("source"));
        l.setStatus(rs.getString("status"));
        l.setModelsAdded(rs.getInt("models_added"));
        l.setModelsUpdated(rs.getInt("models_updated"));
        l.setModelsSkipped(rs.getInt("models_skipped"));
        l.setErrorMessage(rs.getString("error_message"));
        l.setRanAt(rs.getString("ran_at"));
        return l;
    };

    public Flux<IngestionLog> findRecent(int limit) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM ingestion_log ORDER BY ran_at DESC LIMIT ?", ROW_MAPPER, limit))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> insert(IngestionLog log) {
        return Mono.fromCallable(() -> jdbc.update(
                        "INSERT INTO ingestion_log (source, status, models_added, models_updated, models_skipped, error_message, ran_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                        log.getSource(), log.getStatus(), log.getModelsAdded(),
                        log.getModelsUpdated(), log.getModelsSkipped(), log.getErrorMessage()))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }
}
