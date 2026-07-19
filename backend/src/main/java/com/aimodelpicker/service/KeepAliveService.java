package com.aimodelpicker.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Pings the service's own public URL so Render's free tier never sees it as
 * idle (spin-down after 15 min without inbound traffic; cold start ~1 min).
 * Render injects RENDER_EXTERNAL_URL automatically; unset locally, so the
 * ping is a no-op in dev. The request goes out through Render's proxy and
 * back in, which is what counts as traffic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KeepAliveService {

    private final WebClient webClient;

    @Value("${KEEP_ALIVE_URL:${RENDER_EXTERNAL_URL:}}")
    private String baseUrl;

    @Scheduled(fixedDelay = 10 * 60 * 1000, initialDelay = 10 * 60 * 1000)
    public void ping() {
        if (baseUrl == null || baseUrl.isBlank()) return;
        webClient.get()
                .uri(baseUrl + "/api/recommend/personas")   // tiny static payload
                .retrieve()
                .toBodilessEntity()
                .subscribe(
                        r -> log.debug("Keep-alive ping: {}", r.getStatusCode()),
                        e -> log.warn("Keep-alive ping failed: {}", e.getMessage()));
    }
}
