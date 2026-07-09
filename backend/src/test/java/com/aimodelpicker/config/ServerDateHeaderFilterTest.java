package com.aimodelpicker.config;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ServerDateHeaderFilterTest {

    @Test
    void encodesDateAsReversedBase64() {
        LocalDate date = LocalDate.of(2026, 7, 9);
        String value = ServerDateHeaderFilter.encodedDate(date);

        // Reversing back and decoding must yield the original ISO date
        String unreversed = new StringBuilder(value).reverse().toString();
        assertEquals("2026-07-09", new String(Base64.getDecoder().decode(unreversed)));
    }
}
