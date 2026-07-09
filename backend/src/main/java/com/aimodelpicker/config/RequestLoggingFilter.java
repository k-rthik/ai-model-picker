package com.aimodelpicker.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Logs every API call: request line (method, URI with query, origin, key
 * presence) and response outcome (status, duration, content length).
 * Response bodies are intentionally not logged — catalog payloads run to
 * hundreds of KB per request; error statuses carry enough signal, and full
 * bodies can be reproduced by replaying the logged URI.
 *
 * Toggle with LOG_REQUESTS=false.
 */
@Slf4j
@Component
@Order(-300)   // outermost: measures the full pipeline including CORS/auth filters
public class RequestLoggingFilter implements WebFilter {

    private final boolean enabled;

    public RequestLoggingFilter(@Value("${app.log-requests:true}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (!enabled || !exchange.getRequest().getPath().value().startsWith("/api")) {
            return chain.filter(exchange);
        }

        long start = System.nanoTime();
        var req = exchange.getRequest();
        String method = String.valueOf(req.getMethod());
        String uri    = req.getURI().getPath()
                + (req.getURI().getRawQuery() != null ? "?" + req.getURI().getRawQuery() : "");
        String origin = header(exchange, "Origin");
        // Never log the key itself — only whether one was sent
        String keyed  = req.getHeaders().containsKey(AdminAuthFilter.HEADER) ? "key" : "-";
        String ip     = req.getRemoteAddress() != null
                ? req.getRemoteAddress().getAddress().getHostAddress() : "-";

        log.info("--> {} {} origin={} auth={} ip={}", method, uri, origin, keyed, ip);

        return chain.filter(exchange)
                .doFinally(signal -> {
                    long ms = (System.nanoTime() - start) / 1_000_000;
                    HttpStatusCode status = exchange.getResponse().getStatusCode();
                    String len = header(exchange.getResponse().getHeaders().getFirst("Content-Length"));
                    log.info("<-- {} {} status={} {}ms bytes={} signal={}",
                            method, uri, status != null ? status.value() : "?", ms, len, signal);
                });
    }

    private String header(ServerWebExchange exchange, String name) {
        String v = exchange.getRequest().getHeaders().getFirst(name);
        return v != null ? v : "-";
    }

    private String header(String v) {
        return v != null ? v : "-";
    }
}
