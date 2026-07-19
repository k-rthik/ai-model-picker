package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("providers")
public class Provider {
    @Id
    private String id;
    private String name;
    private String baseUrl;
    private Boolean isLocal;
    private Boolean active;
    private String createdAt;
    private String updatedAt;
}
