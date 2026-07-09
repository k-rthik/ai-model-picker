package com.aimodelpicker.engine;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class NlQueryParserTest {

    @Test
    void detectsCodingUseCase() {
        var p = NlQueryParser.parse("I need help debugging and refactoring my code");
        assertEquals("coding", p.useCase());
    }

    @Test
    void detectsRagWithChatbotKeywords() {
        var p = NlQueryParser.parse("customer support chatbot over our documentation");
        assertEquals("rag", p.useCase());
    }

    @Test
    void detectsVisionAndBudget() {
        var p = NlQueryParser.parse("extract text from screenshots, max $2 per million");
        assertEquals("vision", p.useCase());
        assertEquals(2.0, p.maxBudget());
    }

    @Test
    void detectsQualityLevels() {
        assertEquals(5, NlQueryParser.parse("the best frontier model for analysis").quality());
        assertEquals(4, NlQueryParser.parse("reliable production summarization").quality());
        assertEquals(2, NlQueryParser.parse("cheapest thing that can write emails").quality());
        assertEquals(3, NlQueryParser.parse("write emails").quality());
    }

    @Test
    void detectsPersonas() {
        assertEquals(Persona.STUDENT,     NlQueryParser.parse("I'm a student learning to code").persona());
        assertEquals(Persona.ENTERPRISE,  NlQueryParser.parse("needs to be HIPAA compliant").persona());
        assertEquals(Persona.RESEARCHER,  NlQueryParser.parse("for my PhD research paper").persona());
        assertEquals(Persona.STARTUP_MVP, NlQueryParser.parse("shipping our startup MVP").persona());
        assertEquals(Persona.SOLO_HACKER, NlQueryParser.parse("weekend side project").persona());
        assertNull(NlQueryParser.parse("summarize documents").persona());
    }

    @Test
    void emptyQueryFallsBackToDefaults() {
        var p = NlQueryParser.parse("");
        assertEquals("analysis", p.useCase());
        assertEquals(3, p.quality());
        assertEquals(0.0, p.maxBudget());
        assertNull(p.persona());
        assertFalse(p.excludeChina());
    }

    @Test
    void detectsChinaExclusion() {
        assertTrue(NlQueryParser.parse("coding assistant, no chinese models").excludeChina());
        assertTrue(NlQueryParser.parse("summarizer but avoid china providers").excludeChina());
        assertTrue(NlQueryParser.parse("non-chinese rag model").excludeChina());
        assertFalse(NlQueryParser.parse("translate chinese documents").excludeChina());
    }
}
