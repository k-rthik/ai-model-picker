package com.aimodelpicker.engine;

import com.aimodelpicker.model.AiModel;

import java.util.Locale;
import java.util.Set;

/**
 * Preset user profiles that pre-answer the quality/budget questions and
 * constrain which models are even considered.
 */
public enum Persona {

    SOLO_HACKER(2, 0.60, "Solo hacker",
            "Cheapest hosted API that clears the quality bar"),
    STARTUP_MVP(3, 0.25, "Startup MVP",
            "Fast, mainstream providers that are easy to build on"),
    ENTERPRISE(4, 0.10, "Enterprise",
            "Major providers with compliance and data-privacy programs"),
    RESEARCHER(5, 0.02, "Researcher",
            "Maximum reasoning quality, cost barely matters"),
    STUDENT(1, 0.50, "Student",
            "Free tiers and open-source models only");

    private static final Set<String> MAINSTREAM_PROVIDERS = Set.of(
            "openai", "anthropic", "google", "mistralai", "groq", "meta-llama", "x-ai");

    // Providers with established enterprise compliance offerings (SOC 2 / DPA /
    // regional hosting). Always verify current terms with the provider.
    private static final Set<String> ENTERPRISE_PROVIDERS = Set.of(
            "openai", "anthropic", "google", "amazon", "microsoft", "cohere", "mistralai");

    public final int qualityTier;
    public final double budgetWeight;
    public final String label;
    public final String description;

    Persona(int qualityTier, double budgetWeight, String label, String description) {
        this.qualityTier = qualityTier;
        this.budgetWeight = budgetWeight;
        this.label = label;
        this.description = description;
    }

    /** Hard filter: models a persona will consider at all. */
    public boolean accepts(AiModel model) {
        String provider = model.getProviderId() == null ? "" : model.getProviderId();
        return switch (this) {
            // Needs a hosted API — self-hosted Ollama isn't "an API that works" out of the box
            case SOLO_HACKER -> !"ollama".equals(provider);
            case STARTUP_MVP -> MAINSTREAM_PROVIDERS.contains(provider)
                    && !"slow".equals(model.getSpeedTier());
            case ENTERPRISE -> ENTERPRISE_PROVIDERS.contains(provider);
            case RESEARCHER -> true;
            case STUDENT -> "free".equals(model.getPricingModel())
                    || "ollama".equals(provider)
                    || model.getId().endsWith("-free");
        };
    }

    public static Persona fromString(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return valueOf(s.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
