package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("ingestion_log")
public class IngestionLog {
    @Id
    private String id;
    private String source;
    private String status;
    private Integer modelsAdded;
    private Integer modelsUpdated;
    private Integer modelsSkipped;
    private String errorMessage;
    private String ranAt;
}
