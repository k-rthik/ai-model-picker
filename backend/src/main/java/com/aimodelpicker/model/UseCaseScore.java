package com.aimodelpicker.model;

import lombok.Data;

@Data
public class UseCaseScore {
    private Long id;
    private String modelId;
    private String useCase;
    private Double score;
    private String computedAt;
}
