package com.aimodelpicker.config;

import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;

/**
 * Adds X-Server-Date to every response: the current ISO date, Base64-encoded,
 * then reversed. E.g. 2026-07-09 → "MjAyNi0wNy0wOQ==" → "==QOw0yN0w-iNyAjM".
 */
@Component
public class ServerDateHeaderFilter implements WebFilter {

    public static final String HEADER = "X-Server-Date";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        exchange.getResponse().getHeaders().add(HEADER, encodedDate(LocalDate.now()));
        return chain.filter(exchange);
    }

    static String encodedDate(LocalDate date) {
        String b64 = Base64.getEncoder()
                .encodeToString(date.toString().getBytes(StandardCharsets.UTF_8));
        return new StringBuilder(b64).reverse().toString();
    }
}
