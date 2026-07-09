package com.aimodelpicker.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Guards /api/admin/** with a static API key: requests must carry
 * X-Admin-Key matching the ADMIN_API_KEY env var. When the env var is
 * unset (local dev), admin stays open and a warning is logged at startup.
 *
 * Ordered after the CORS filter so 401 responses still carry CORS headers
 * (the browser would otherwise mask them as opaque network errors).
 */
@Slf4j
@Component
@Order(-50)
public class AdminAuthFilter implements WebFilter {

    public static final String HEADER = "X-Admin-Key";

    private final String apiKey;

    public AdminAuthFilter(@Value("${app.admin.api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        if (this.apiKey.isEmpty()) {
            log.warn("ADMIN_API_KEY not set — /api/admin/** is UNPROTECTED. "
                    + "Set it in production.");
        }
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (apiKey.isEmpty()
                || !exchange.getRequest().getPath().value().startsWith("/api/admin")
                || HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())) {
            return chain.filter(exchange);
        }

        String provided = exchange.getRequest().getHeaders().getFirst(HEADER);
        if (provided != null && MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                apiKey.getBytes(StandardCharsets.UTF_8))) {
            return chain.filter(exchange);
        }

        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }
}
