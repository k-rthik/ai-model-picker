package com.aimodelpicker.ingestor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Loads curated models from models-seed.yaml on the classpath.
 * Used for local/Ollama models and providers not on OpenRouter.
 */
@Slf4j
@Component
public class YamlSeeder implements ModelIngestor {

    private final ObjectMapper yaml = new ObjectMapper(new YAMLFactory());

    @Override
    public String sourceId() {
        return "yaml";
    }

    @Override
    public Flux<ModelRecord> ingest() {
        return Mono.fromCallable(this::loadYaml)
                .flatMapMany(Flux::fromIterable)
                .subscribeOn(Schedulers.boundedElastic())
                .doOnError(e -> log.error("YAML seeder failed: {}", e.getMessage()));
    }

    @SuppressWarnings("unchecked")
    private List<ModelRecord> loadYaml() throws Exception {
        var resource = new ClassPathResource("models-seed.yaml");
        if (!resource.exists()) {
            log.warn("models-seed.yaml not found on classpath");
            return Collections.emptyList();
        }

        Map<String, Object> root = yaml.readValue(resource.getInputStream(), Map.class);
        List<Map<String, Object>> models = (List<Map<String, Object>>) root.get("models");

        return models.stream().map(this::mapEntry).toList();
    }

    @SuppressWarnings("unchecked")
    private ModelRecord mapEntry(Map<String, Object> m) {
        String pricingModel = str(m, "pricingModel", "per_token");
        double inputPer1m   = num(m, "inputPricePer1m");
        double outputPer1m  = num(m, "outputPricePer1m");

        Map<String, Object> caps = m.containsKey("capabilities")
                ? (Map<String, Object>) m.get("capabilities")
                : Collections.emptyMap();

        String speedTier = str(m, "speedTier", ModelRecord.inferSpeedTier(outputPer1m));

        return new ModelRecord(
                str(m, "id", null),
                null,
                str(m, "name", str(m, "id", "?")),
                str(m, "providerId", "unknown"),
                pricingModel,
                inputPer1m,
                outputPer1m,
                null, null, null,
                intVal(m, "contextWindow", 0),
                m.containsKey("maxOutputTokens") ? intVal(m, "maxOutputTokens", null) : null,
                speedTier,
                caps,
                sourceId(),
                str(m, "notes", null)
        );
    }

    private String str(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return v != null ? v.toString() : def;
    }

    private double num(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return 0;
        return ((Number) v).doubleValue();
    }

    private Integer intVal(Map<String, Object> m, String key, Integer def) {
        Object v = m.get(key);
        if (v == null) return def;
        return ((Number) v).intValue();
    }
}
