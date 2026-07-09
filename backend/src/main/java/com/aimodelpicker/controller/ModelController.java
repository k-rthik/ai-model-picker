package com.aimodelpicker.controller;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.model.ArenaScore;
import com.aimodelpicker.model.BenchmarkScore;
import com.aimodelpicker.model.Provider;
import com.aimodelpicker.model.UseCaseScore;
import com.aimodelpicker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/models")
@RequiredArgsConstructor
public class ModelController {

    private final ModelRepository modelRepository;
    private final ProviderRepository providerRepository;
    private final BenchmarkScoreRepository benchmarkRepo;
    private final ArenaScoreRepository arenaRepo;
    private final UseCaseScoreRepository useCaseRepo;

    @GetMapping
    public Flux<AiModel> getAllModels() {
        return modelRepository.findAll();
    }

    @GetMapping("/{id}")
    public Mono<AiModel> getModel(@PathVariable String id) {
        return modelRepository.findById(id);
    }

    @GetMapping("/{id}/benchmarks")
    public Flux<BenchmarkScore> getBenchmarks(@PathVariable String id) {
        return benchmarkRepo.findByModelId(id);
    }

    @GetMapping("/{id}/arena")
    public Flux<ArenaScore> getArenaScores(@PathVariable String id) {
        return arenaRepo.findByModelId(id);
    }

    @GetMapping("/{id}/use-cases")
    public Flux<UseCaseScore> getUseCaseScores(@PathVariable String id) {
        return useCaseRepo.findByModelId(id);
    }

    @GetMapping("/leaderboard/arena")
    public Flux<ArenaScore> getArenaLeaderboard() {
        return arenaRepo.findTopByElo(20);
    }

    @GetMapping("/leaderboard/use-case/{useCase}")
    public Flux<UseCaseScore> getUseCaseLeaderboard(@PathVariable String useCase) {
        return useCaseRepo.findByUseCaseOrderByScoreDesc(useCase);
    }

    @GetMapping("/provider/{provider}")
    public Flux<AiModel> getByProvider(@PathVariable String provider) {
        return modelRepository.findByProviderId(provider);
    }

    @GetMapping("/providers")
    public Flux<Provider> getProviders() {
        return providerRepository.findAll();
    }
}
