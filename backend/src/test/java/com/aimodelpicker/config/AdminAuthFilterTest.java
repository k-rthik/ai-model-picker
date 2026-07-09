package com.aimodelpicker.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.*;

class AdminAuthFilterTest {

    private final WebFilterChain passChain = exchange -> Mono.empty();

    private MockServerWebExchange exchange(String path, String key) {
        MockServerHttpRequest.BaseBuilder<?> req = MockServerHttpRequest.get(path);
        if (key != null) req.header(AdminAuthFilter.HEADER, key);
        return MockServerWebExchange.from((MockServerHttpRequest) req.build());
    }

    @Test
    void rejectsAdminRequestWithoutKey() {
        AdminAuthFilter filter = new AdminAuthFilter("secret123");
        MockServerWebExchange ex = exchange("/api/admin/ingest", null);
        filter.filter(ex, passChain).block();
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void rejectsAdminRequestWithWrongKey() {
        AdminAuthFilter filter = new AdminAuthFilter("secret123");
        MockServerWebExchange ex = exchange("/api/admin/models", "wrong");
        filter.filter(ex, passChain).block();
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void allowsAdminRequestWithCorrectKey() {
        AdminAuthFilter filter = new AdminAuthFilter("secret123");
        MockServerWebExchange ex = exchange("/api/admin/models", "secret123");
        filter.filter(ex, passChain).block();
        assertNull(ex.getResponse().getStatusCode());
    }

    @Test
    void nonAdminPathsAreOpen() {
        AdminAuthFilter filter = new AdminAuthFilter("secret123");
        MockServerWebExchange ex = exchange("/api/recommend", null);
        filter.filter(ex, passChain).block();
        assertNull(ex.getResponse().getStatusCode());
    }

    @Test
    void unsetKeyLeavesAdminOpen() {
        AdminAuthFilter filter = new AdminAuthFilter("");
        MockServerWebExchange ex = exchange("/api/admin/ingest", null);
        filter.filter(ex, passChain).block();
        assertNull(ex.getResponse().getStatusCode());
    }
}
