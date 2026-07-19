package com.aimodelpicker.scraper;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.repository.ModelRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class LmsysArenaScraperTest {

    private final LmsysArenaScraper scraper =
            new LmsysArenaScraper(mock(WebClient.class), mock(ModelRepository.class));

    private AiModel model(String id, String provider) {
        AiModel m = new AiModel();
        m.setId(id);
        m.setProviderId(provider);
        return m;
    }

    // Escaped exactly as it appears in the lmarena.ai RSC payload
    private static final String SAMPLE_HTML = """
            junk{\\"rank\\":1,\\"rankUpper\\":1,\\"rankLower\\":2,\\"modelKey\\":\\"x1\\",\\"modelDisplayName\\":\\"gpt-5.4\\",\\"rating\\":1490.5,\\"ratingUpper\\":1495,\\"ratingLower\\":1486,\\"votes\\":61003,\\"modelOrganization\\":\\"OpenAI\\"}
            {\\"rank\\":2,\\"modelKey\\":\\"x2\\",\\"modelDisplayName\\":\\"claude-opus-4-6-20260210-thinking-16k\\",\\"rating\\":1488.1}
            {\\"rank\\":3,\\"modelKey\\":\\"x3\\",\\"modelDisplayName\\":\\"claude-opus-4-6-20260210\\",\\"rating\\":1485.0}
            {\\"rank\\":9,\\"modelKey\\":\\"x4\\",\\"modelDisplayName\\":\\"totally-unknown-model\\",\\"rating\\":1400.0}
            """;

    @Test
    void parsesEntriesAndResolvesAgainstCatalog() {
        List<AiModel> catalog = List.of(
                model("openai-gpt-5-4", "openai"),
                model("anthropic-claude-opus-4-6", "anthropic"));

        List<ArenaScore> scores = scraper.parse(SAMPLE_HTML, catalog, "code");

        assertEquals(2, scores.size());
        Map<String, ArenaScore> byId = new java.util.HashMap<>();
        scores.forEach(s -> byId.put(s.getModelId(), s));
        assertEquals(1491, byId.get("openai-gpt-5-4").getEloScore());
        assertEquals(61003, byId.get("openai-gpt-5-4").getVotes());
        assertEquals("code", byId.get("openai-gpt-5-4").getCategory());
        // thinking + dated variants collapse to one model, best rating wins
        assertEquals(1488, byId.get("anthropic-claude-opus-4-6").getEloScore());
        // entry without a votes field defaults to 0 (unknown)
        assertEquals(0, byId.get("anthropic-claude-opus-4-6").getVotes());
    }

    @Test
    void normalizeStripsDatesThinkingAndDots() {
        assertEquals("gpt-5-4", LmsysArenaScraper.normalize("GPT-5.4"));
        assertEquals("claude-opus-4-6", LmsysArenaScraper.normalize("claude-opus-4-6-20260210-thinking-16k"));
        assertEquals("gemini-3-1-pro", LmsysArenaScraper.normalize("gemini-3.1-pro"));
        assertEquals("qwen3-max", LmsysArenaScraper.normalize("Qwen3 Max"));
        // search-board names carry a tool-mode suffix
        assertEquals("claude-opus-4-6", LmsysArenaScraper.normalize("claude-opus-4-6-search"));
    }

    @Test
    void unknownModelsAreSkippedNotErrored() {
        List<ArenaScore> scores = scraper.parse(SAMPLE_HTML, List.of(), "text");
        assertTrue(scores.isEmpty());
    }
}
