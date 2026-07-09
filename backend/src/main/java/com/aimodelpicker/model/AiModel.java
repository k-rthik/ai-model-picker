package com.aimodelpicker.model;

import lombok.Data;

import java.util.Map;

@Data
public class AiModel {
    private String id;
    private String name;
    private String providerId;
    private String pricingModel;        // per_token | free | per_request
    private Double inputPricePer1m;
    private Double outputPricePer1m;
    private Double batchInputPer1m;
    private Double batchOutputPer1m;
    private Double requestPrice;
    private Integer contextWindow;
    private Integer maxOutputTokens;
    private String speedTier;
    private Map<String, Object> capabilities;
    private String source;
    private String externalId;
    private String notes;
    private Boolean active;
    private String createdAt;
    private String updatedAt;

    /** Convenience — reads from capabilities map */
    public boolean supportsVision() {
        return Boolean.TRUE.equals(capabilities != null ? capabilities.get("vision") : null);
    }
}
