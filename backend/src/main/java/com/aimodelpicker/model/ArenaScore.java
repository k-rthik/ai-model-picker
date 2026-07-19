package com.aimodelpicker.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("arena_scores")
public class ArenaScore {
    @Id
    private String id;
    private String modelId;
    private String modelNameOnLeaderboard;
    private Integer eloScore;
    private Integer rankPosition;
    private Integer votes;
    private String category;
    private String scrapedAt;
}
