package com.aimodelpicker.engine;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic keyword parser turning a free-text description
 * ("cheap chatbot over our docs for a weekend project") into engine inputs.
 * Rule-based on purpose: no API key, no cost, no latency — swap in an LLM
 * call here if fuzzier understanding is ever needed.
 */
public final class NlQueryParser {

    public record Parsed(String useCase, int quality, double maxBudget, Persona persona,
                         boolean excludeChina) {}

    private static final Pattern EXCLUDE_CHINA = Pattern.compile(
            "\\b(no|avoid|exclude|skip|without|not?)\\s+chin(a|ese)\\b|non.?chinese|western only|us.based only");

    // Ordered: more specific intents win over generic ones on equal hits
    private static final Map<String, Pattern> USE_CASE_KEYWORDS = new LinkedHashMap<>();
    static {
        USE_CASE_KEYWORDS.put("vision",        Pattern.compile("\\b(image|photo|picture|screenshot|diagram|video)s?\\b|\\b(vision|ocr|multimodal)\\b"));
        USE_CASE_KEYWORDS.put("coding",        Pattern.compile("\\b(cod(e|ing|er)|program|debug|refactor|ide|copilot|sql|scripts?|api client|autocomplete"
                + "|build(ing)?[\\w '-]{0,30}\\b(apps?|site|website|tracker|tool|game|dashboard|extension|bot)|(mobile|web) app)\\b"));
        USE_CASE_KEYWORDS.put("agents",        Pattern.compile("\\b(agents?|automat(e|ion)|tool use|function call|workflows?|autonomous|browse|scrape)\\b"));
        USE_CASE_KEYWORDS.put("rag",           Pattern.compile("\\b(rag|retrieval|search|knowledge base|docs|documentation|q&a|question answer|support bots?|chatbots?|faqs?|grounded)\\b"));
        USE_CASE_KEYWORDS.put("summarization", Pattern.compile("\\b(summar(y|ies|ize|ise|ization)|tl;?dr|digest|condense|meeting notes|transcripts?)\\b"));
        USE_CASE_KEYWORDS.put("long-context",  Pattern.compile("\\b(long (context|documents?)|entire (book|codebase|repo)|100k|contracts?|legal docs?|pdfs?|large files?)\\b"));
        USE_CASE_KEYWORDS.put("analysis",      Pattern.compile("\\b(analy(ze|sis|se)|research|reason(ing)?|math|data|insights?|evaluate|think)\\b"));
        USE_CASE_KEYWORDS.put("writing",       Pattern.compile("\\b(writ(e|ing|er)|blogs?|emails?|content|copy|articles?|marketing|essays?|stor(y|ies)|drafts?)\\b"));
    }

    private static final Map<Persona, Pattern> PERSONA_KEYWORDS = new LinkedHashMap<>();
    static {
        PERSONA_KEYWORDS.put(Persona.STUDENT,     Pattern.compile("\\b(student|college|university|learning|homework|course|open.?source only)\\b"));
        PERSONA_KEYWORDS.put(Persona.ENTERPRISE,  Pattern.compile("\\b(enterprise|compliance|hipaa|gdpr|soc ?2|privacy|regulated|on.?prem|audit)\\b"));
        PERSONA_KEYWORDS.put(Persona.RESEARCHER,  Pattern.compile("\\b(research(er)?|phd|paper|thesis|benchmark|frontier|state.of.the.art)\\b"));
        PERSONA_KEYWORDS.put(Persona.STARTUP_MVP, Pattern.compile("\\b(startup|mvp|launch|ship fast|prototype|demo day|investor)\\b"));
        PERSONA_KEYWORDS.put(Persona.SOLO_HACKER, Pattern.compile("\\b(solo|side project|hobby|weekend|hack(er|ing)?|indie|personal project)\\b"));
    }

    private static final Pattern BUDGET = Pattern.compile("\\$\\s*(\\d+(?:\\.\\d+)?)");

    private static final Pattern HIGH_QUALITY = Pattern.compile("\\b(best|top|highest|frontier|state.of.the.art|sota|most (capable|powerful|accurate))\\b");
    private static final Pattern PROD_QUALITY = Pattern.compile("\\b(production|reliable|accurate|robust|quality matters)\\b");
    private static final Pattern LOW_QUALITY  = Pattern.compile("\\b(cheap(est)?|budget|low.?cost|good enough|basic|simple|quick and dirty|free)\\b");

    private NlQueryParser() {}

    public static Parsed parse(String query) {
        String q = (query == null ? "" : query).toLowerCase(Locale.ROOT);

        Persona persona = null;
        for (Map.Entry<Persona, Pattern> e : PERSONA_KEYWORDS.entrySet()) {
            if (e.getValue().matcher(q).find()) { persona = e.getKey(); break; }
        }

        String useCase = "analysis";
        int bestHits = 0;
        for (Map.Entry<String, Pattern> e : USE_CASE_KEYWORDS.entrySet()) {
            Matcher m = e.getValue().matcher(q);
            int hits = 0;
            while (m.find()) hits++;
            if (hits > bestHits) { bestHits = hits; useCase = e.getKey(); }
        }

        int quality = 3;
        if (HIGH_QUALITY.matcher(q).find()) quality = 5;
        else if (PROD_QUALITY.matcher(q).find()) quality = 4;
        else if (LOW_QUALITY.matcher(q).find()) quality = 2;

        double maxBudget = 0;
        Matcher b = BUDGET.matcher(q);
        if (b.find()) maxBudget = Double.parseDouble(b.group(1));

        boolean excludeChina = EXCLUDE_CHINA.matcher(q).find();

        return new Parsed(useCase, quality, maxBudget, persona, excludeChina);
    }
}
