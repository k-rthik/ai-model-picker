package com.aimodelpicker.model;

import lombok.Data;

@Data
public class ScrapeLog {
    private Long id;
    private String source;
    private String status;
    private Integer recordsUpserted;
    private String errorMessage;
    private String ranAt;
}
