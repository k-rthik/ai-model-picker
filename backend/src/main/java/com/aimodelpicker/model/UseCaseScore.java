package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("use_case_scores")
public class UseCaseScore {
    @Id
    private String id;
    private String modelId;
    private String useCase;
    private Double score;
    private String computedAt;
}
