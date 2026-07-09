package com.aimodelpicker.repository;

import com.aimodelpicker.model.Provider;
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
public class ProviderRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<Provider> ROW_MAPPER = (rs, rowNum) -> {
        Provider p = new Provider();
        p.setId(rs.getString("id"));
        p.setName(rs.getString("name"));
        p.setBaseUrl(rs.getString("base_url"));
        p.setIsLocal(rs.getInt("is_local") == 1);
        p.setActive(rs.getInt("active") == 1);
        p.setCreatedAt(rs.getString("created_at"));
        p.setUpdatedAt(rs.getString("updated_at"));
        return p;
    };

    public Flux<Provider> findAll() {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM providers WHERE active = 1 ORDER BY name", ROW_MAPPER))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Provider> findById(String id) {
        return Mono.fromCallable(() -> {
                    List<Provider> r = jdbc.query("SELECT * FROM providers WHERE id = ?", ROW_MAPPER, id);
                    return r.isEmpty() ? null : r.get(0);
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    /** Insert provider if id not already present. */
    public Mono<Void> upsertIfAbsent(String id, String name, boolean isLocal) {
        return Mono.fromCallable(() -> jdbc.update(
                        "INSERT OR IGNORE INTO providers (id, name, is_local) VALUES (?, ?, ?)",
                        id, name, isLocal ? 1 : 0))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }

    public Mono<Void> upsert(Provider provider) {
        return Mono.fromCallable(() -> jdbc.update("""
                        INSERT INTO providers (id, name, base_url, is_local, active, updated_at)
                        VALUES (?, ?, ?, ?, ?, datetime('now'))
                        ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            base_url = excluded.base_url,
                            is_local = excluded.is_local,
                            active = excluded.active,
                            updated_at = excluded.updated_at
                        """,
                        provider.getId(), provider.getName(), provider.getBaseUrl(),
                        provider.getIsLocal() ? 1 : 0, provider.getActive() ? 1 : 0))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }

    public Mono<Void> deactivate(String id) {
        return Mono.fromCallable(() -> jdbc.update(
                        "UPDATE providers SET active = 0, updated_at = datetime('now') WHERE id = ?", id))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }
}
