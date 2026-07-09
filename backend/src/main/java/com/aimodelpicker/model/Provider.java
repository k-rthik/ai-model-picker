package com.aimodelpicker.model;

import lombok.Data;

@Data
public class Provider {
    private String id;
    private String name;
    private String baseUrl;
    private Boolean isLocal;
    private Boolean active;
    private String createdAt;
    private String updatedAt;
}
