package com.aimodelpicker.repository;

import com.aimodelpicker.model.ScrapeLog;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Repository
@RequiredArgsConstructor
public class ScrapeLogRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<ScrapeLog> ROW_MAPPER = (rs, rowNum) -> {
        ScrapeLog s = new ScrapeLog();
        s.setId(rs.getLong("id"));
        s.setSource(rs.getString("source"));
        s.setStatus(rs.getString("status"));
        s.setRecordsUpserted(rs.getInt("records_upserted"));
        s.setErrorMessage(rs.getString("error_message"));
        s.setRanAt(rs.getString("ran_at"));
        return s;
    };

    public Flux<ScrapeLog> findRecent(int limit) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM scrape_log ORDER BY ran_at DESC LIMIT ?", ROW_MAPPER, limit))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Integer> insert(ScrapeLog log) {
        return Mono.fromCallable(() -> jdbc.update(
                        "INSERT INTO scrape_log (source, status, records_upserted, error_message, ran_at) VALUES (?, ?, ?, ?, ?)",
                        log.getSource(), log.getStatus(), log.getRecordsUpserted(),
                        log.getErrorMessage(), log.getRanAt()))
                .subscribeOn(Schedulers.boundedElastic());
    }
}
