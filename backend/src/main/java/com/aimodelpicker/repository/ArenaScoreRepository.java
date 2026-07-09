package com.aimodelpicker.repository;

import com.aimodelpicker.model.ArenaScore;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Repository
@RequiredArgsConstructor
public class ArenaScoreRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<ArenaScore> ROW_MAPPER = (rs, rowNum) -> {
        ArenaScore a = new ArenaScore();
        a.setId(rs.getLong("id"));
        a.setModelId(rs.getString("model_id"));
        a.setModelNameOnLeaderboard(rs.getString("model_name_on_leaderboard"));
        a.setEloScore(rs.getInt("elo_score"));
        a.setRankPosition(rs.getInt("rank_position"));
        a.setVotes(rs.getInt("votes"));
        a.setScrapedAt(rs.getString("scraped_at"));
        return a;
    };

    public Flux<ArenaScore> findByModelId(String modelId) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM arena_scores WHERE model_id = ?", ROW_MAPPER, modelId))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<ArenaScore> findTopByElo(int limit) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM arena_scores ORDER BY elo_score DESC LIMIT ?", ROW_MAPPER, limit))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Integer> insert(ArenaScore score) {
        return Mono.fromCallable(() -> jdbc.update(
                        "INSERT INTO arena_scores (model_id, model_name_on_leaderboard, elo_score, rank_position, votes, scraped_at) VALUES (?, ?, ?, ?, ?, ?)",
                        score.getModelId(), score.getModelNameOnLeaderboard(),
                        score.getEloScore(), score.getRankPosition(),
                        score.getVotes(), score.getScrapedAt()))
                .subscribeOn(Schedulers.boundedElastic());
    }
}
