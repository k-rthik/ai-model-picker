package com.aimodelpicker.model;

import lombok.Data;

@Data
public class BenchmarkScore {
    private Long id;
    private String modelId;
    private String benchmarkName;
    private Double score;
    private String source;
    private String scrapedAt;
}
