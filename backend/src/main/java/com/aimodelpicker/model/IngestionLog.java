package com.aimodelpicker.model;

import lombok.Data;

@Data
public class IngestionLog {
    private Long id;
    private String source;
    private String status;
    private Integer modelsAdded;
    private Integer modelsUpdated;
    private Integer modelsSkipped;
    private String errorMessage;
    private String ranAt;
}
