package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("benchmark_scores")
public class BenchmarkScore {
    @Id
    private String id;
    private String modelId;
    private String benchmarkName;
    private Double score;
    private String source;
    private String scrapedAt;
}
