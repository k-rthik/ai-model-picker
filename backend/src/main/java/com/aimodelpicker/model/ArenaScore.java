package com.aimodelpicker.model;

import lombok.Data;

@Data
public class ArenaScore {
    private Long id;
    private String modelId;
    private String modelNameOnLeaderboard;
    private Integer eloScore;
    private Integer rankPosition;
    private Integer votes;
    private String category;
    private String scrapedAt;
}
