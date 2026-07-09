package com.aimodelpicker.repository;

import com.aimodelpicker.model.AiModel;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ModelRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private RowMapper<AiModel> rowMapper() {
        return (rs, rowNum) -> {
            AiModel m = new AiModel();
            m.setId(rs.getString("id"));
            m.setName(rs.getString("name"));
            m.setProviderId(rs.getString("provider_id"));
            m.setPricingModel(rs.getString("pricing_model"));
            m.setInputPricePer1m(rs.getDouble("input_price_per_1m"));
            m.setOutputPricePer1m(rs.getDouble("output_price_per_1m"));

            double bIn = rs.getDouble("batch_input_per_1m");
            m.setBatchInputPer1m(rs.wasNull() ? null : bIn);
            double bOut = rs.getDouble("batch_output_per_1m");
            m.setBatchOutputPer1m(rs.wasNull() ? null : bOut);
            double reqP = rs.getDouble("request_price");
            m.setRequestPrice(rs.wasNull() ? null : reqP);

            m.setContextWindow(rs.getInt("context_window"));

            int maxOut = rs.getInt("max_output_tokens");
            m.setMaxOutputTokens(rs.wasNull() ? null : maxOut);

            m.setSpeedTier(rs.getString("speed_tier"));
            m.setCapabilities(parseCapabilities(rs.getString("capabilities")));
            m.setSource(rs.getString("source"));
            m.setExternalId(rs.getString("external_id"));
            m.setNotes(rs.getString("notes"));
            m.setActive(rs.getInt("active") == 1);
            m.setCreatedAt(rs.getString("created_at"));
            m.setUpdatedAt(rs.getString("updated_at"));
            return m;
        };
    }

    private Map<String, Object> parseCapabilities(String json) {
        try {
            if (json == null || json.isBlank()) return new HashMap<>();
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse capabilities JSON: {}", json);
            return new HashMap<>();
        }
    }

    public Flux<AiModel> findAll() {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM models WHERE active = 1 ORDER BY input_price_per_1m", rowMapper()))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<AiModel> findAllIncludingInactive() {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM models ORDER BY provider_id, name", rowMapper()))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<AiModel> findById(String id) {
        return Mono.fromCallable(() -> {
                    List<AiModel> r = jdbc.query(
                            "SELECT * FROM models WHERE id = ?", rowMapper(), id);
                    return r.isEmpty() ? null : r.get(0);
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<AiModel> findByProviderId(String providerId) {
        return Mono.fromCallable(() -> jdbc.query(
                        "SELECT * FROM models WHERE provider_id = ? AND active = 1", rowMapper(), providerId))
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Boolean> existsByExternalId(String externalId) {
        return Mono.fromCallable(() -> {
                    Integer count = jdbc.queryForObject(
                            "SELECT COUNT(*) FROM models WHERE external_id = ?", Integer.class, externalId);
                    return count != null && count > 0;
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Integer> upsert(AiModel model) {
        String capsJson = serializeCapabilities(model.getCapabilities());
        return Mono.fromCallable(() -> jdbc.update("""
                        INSERT INTO models (
                            id, name, provider_id, pricing_model,
                            input_price_per_1m, output_price_per_1m,
                            batch_input_per_1m, batch_output_per_1m, request_price,
                            context_window, max_output_tokens, speed_tier,
                            capabilities, source, external_id, notes,
                            active, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
                        ON CONFLICT(id) DO UPDATE SET
                            name                = excluded.name,
                            provider_id         = excluded.provider_id,
                            pricing_model       = excluded.pricing_model,
                            input_price_per_1m  = excluded.input_price_per_1m,
                            output_price_per_1m = excluded.output_price_per_1m,
                            batch_input_per_1m  = excluded.batch_input_per_1m,
                            batch_output_per_1m = excluded.batch_output_per_1m,
                            request_price       = excluded.request_price,
                            context_window      = excluded.context_window,
                            max_output_tokens   = excluded.max_output_tokens,
                            speed_tier          = excluded.speed_tier,
                            capabilities        = excluded.capabilities,
                            source              = excluded.source,
                            external_id         = excluded.external_id,
                            notes               = excluded.notes,
                            updated_at          = datetime('now')
                        """,
                        model.getId(), model.getName(), model.getProviderId(), model.getPricingModel(),
                        model.getInputPricePer1m(), model.getOutputPricePer1m(),
                        model.getBatchInputPer1m(), model.getBatchOutputPer1m(), model.getRequestPrice(),
                        model.getContextWindow(), model.getMaxOutputTokens(), model.getSpeedTier(),
                        capsJson, model.getSource(), model.getExternalId(), model.getNotes()))
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> softDelete(String id) {
        return Mono.fromCallable(() -> jdbc.update(
                        "UPDATE models SET active = 0, updated_at = datetime('now') WHERE id = ?", id))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }

    public Mono<Void> activate(String id) {
        return Mono.fromCallable(() -> jdbc.update(
                        "UPDATE models SET active = 1, updated_at = datetime('now') WHERE id = ?", id))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }

    private String serializeCapabilities(Map<String, Object> caps) {
        try {
            return caps != null ? objectMapper.writeValueAsString(caps) : "{}";
        } catch (Exception e) {
            return "{}";
        }
    }
}
