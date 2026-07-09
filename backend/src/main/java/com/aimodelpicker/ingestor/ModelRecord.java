package com.aimodelpicker.ingestor;

import java.util.Map;

/**
 * Normalized model record shared across all ingestors.
 * source: "openrouter" | "yaml" | "manual"
 * pricingModel: "per_token" | "free" | "per_request"
 */
public record ModelRecord(
        String id,
        String externalId,
        String name,
        String providerId,
        String pricingModel,
        double inputPricePer1m,
        double outputPricePer1m,
        Double batchInputPer1m,
        Double batchOutputPer1m,
        Double requestPrice,
        int contextWindow,
        Integer maxOutputTokens,
        String speedTier,
        Map<String, Object> capabilities,
        String source,
        String notes
) {
    /** Convenience: derive speed tier from output price if not explicitly set */
    public static String inferSpeedTier(double outputPricePer1m) {
        if (outputPricePer1m <= 0)    return "fast";
        if (outputPricePer1m < 2.0)   return "fast";
        if (outputPricePer1m < 15.0)  return "medium";
        return "slow";
    }
}
