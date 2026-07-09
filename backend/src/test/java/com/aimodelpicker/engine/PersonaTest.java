package com.aimodelpicker.engine;

import com.aimodelpicker.model.AiModel;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;

class PersonaTest {

    private AiModel model(String id, String provider, String pricing, String speed) {
        AiModel m = new AiModel();
        m.setId(id);
        m.setProviderId(provider);
        m.setPricingModel(pricing);
        m.setSpeedTier(speed);
        m.setCapabilities(new HashMap<>());
        return m;
    }

    @Test
    void studentOnlyAcceptsFreeOrOpenSource() {
        Persona s = Persona.STUDENT;
        assertTrue(s.accepts(model("ollama-llama3.3-70b", "ollama", "free", "medium")));
        assertTrue(s.accepts(model("qwen-qwen3-coder-free", "qwen", "per_token", "fast")));
        assertFalse(s.accepts(model("anthropic-claude-opus-4-6", "anthropic", "per_token", "medium")));
    }

    @Test
    void soloHackerExcludesSelfHosted() {
        assertFalse(Persona.SOLO_HACKER.accepts(model("ollama-llama3-8b", "ollama", "free", "fast")));
        assertTrue(Persona.SOLO_HACKER.accepts(model("groq-llama-3.1-8b-instant", "groq", "per_token", "fast")));
    }

    @Test
    void enterpriseOnlyAcceptsCompliantProviders() {
        assertTrue(Persona.ENTERPRISE.accepts(model("anthropic-claude-sonnet-4-6", "anthropic", "per_token", "medium")));
        assertFalse(Persona.ENTERPRISE.accepts(model("z-ai-glm-5", "z-ai", "per_token", "medium")));
    }

    @Test
    void startupMvpRequiresMainstreamAndNotSlow() {
        assertTrue(Persona.STARTUP_MVP.accepts(model("openai-gpt-5-4", "openai", "per_token", "medium")));
        assertFalse(Persona.STARTUP_MVP.accepts(model("openai-o1-pro", "openai", "per_token", "slow")));
        assertFalse(Persona.STARTUP_MVP.accepts(model("moonshotai-kimi-k2-5", "moonshotai", "per_token", "fast")));
    }

    @Test
    void fromStringHandlesKebabAndCase() {
        assertEquals(Persona.SOLO_HACKER, Persona.fromString("solo-hacker"));
        assertEquals(Persona.STARTUP_MVP, Persona.fromString("STARTUP_MVP"));
        assertNull(Persona.fromString("unknown"));
        assertNull(Persona.fromString(null));
    }
}
