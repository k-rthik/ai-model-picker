package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("scrape_log")
public class ScrapeLog {
    @Id
    private String id;
    private String source;
    private String status;
    private Integer recordsUpserted;
    private String errorMessage;
    private String ranAt;
}
