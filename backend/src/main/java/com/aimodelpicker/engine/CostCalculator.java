package com.aimodelpicker.engine;

import com.aimodelpicker.model.AiModel;
import com.aimodelpicker.repository.ModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
@RequiredArgsConstructor
public class CostCalculator {

    private final ModelRepository modelRepository;

    public record CostProjection(
            String modelId,
            String modelName,
            String provider,
            double inputCost,
            double outputCost,
            double totalCost,
            double batchTotalCost,
            boolean hasBatchDiscount
    ) {}

    /**
     * Projects cost for all models given token counts.
     * @param inputTokens  number of input tokens
     * @param outputTokens number of output tokens
     * @return flux of CostProjection sorted cheapest first
     */
    public Flux<CostProjection> projectAll(long inputTokens, long outputTokens) {
        return modelRepository.findAll()
                .map(model -> project(model, inputTokens, outputTokens))
                .sort((a, b) -> Double.compare(a.totalCost(), b.totalCost()));
    }

    private CostProjection project(AiModel model, long inputTokens, long outputTokens) {
        double inputMillions  = inputTokens  / 1_000_000.0;
        double outputMillions = outputTokens / 1_000_000.0;

        double inputCost  = inputMillions  * model.getInputPricePer1m();
        double outputCost = outputMillions * model.getOutputPricePer1m();
        double totalCost  = inputCost + outputCost;

        double batchTotal = totalCost;
        boolean hasBatch  = model.getBatchInputPer1m() != null && model.getBatchOutputPer1m() != null;
        if (hasBatch) {
            batchTotal = (inputMillions * model.getBatchInputPer1m())
                       + (outputMillions * model.getBatchOutputPer1m());
        }

        return new CostProjection(
                model.getId(),
                model.getName(),
                model.getProviderId(),
                inputCost,
                outputCost,
                totalCost,
                batchTotal,
                hasBatch
        );
    }
}
