import type {
  AiModel, BenchmarkScore, ArenaScore, UseCaseScore,
  CostProjection, RecommendationResult, AlternativeAlert, UseCase
} from '../types/models'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

// Models
export const fetchModels = ()                        => get<AiModel[]>('/models')
export const fetchModel  = (id: string)              => get<AiModel>(`/models/${id}`)
export const fetchBenchmarks = (id: string)          => get<BenchmarkScore[]>(`/models/${id}/benchmarks`)
export const fetchArenaScores = (id: string)         => get<ArenaScore[]>(`/models/${id}/arena`)
export const fetchUseCaseScores = (id: string)       => get<UseCaseScore[]>(`/models/${id}/use-cases`)

// Leaderboards
export const fetchArenaLeaderboard = ()              => get<ArenaScore[]>('/models/leaderboard/arena')
export const fetchUseCaseLeaderboard = (uc: UseCase) => get<UseCaseScore[]>(`/models/leaderboard/use-case/${uc}`)

// Recommendation
export const fetchRecommendation = (useCase: UseCase, quality: number, maxBudget: number) =>
  get<RecommendationResult>(`/recommend?useCase=${useCase}&quality=${quality}&maxBudget=${maxBudget}`)

export const fetchAlternative = (modelId: string, useCase: UseCase) =>
  get<{ present: boolean; value?: AlternativeAlert }>(`/recommend/alternative?modelId=${modelId}&useCase=${useCase}`)

// Cost calculator
export const fetchCostProjections = (inputTokens: number, outputTokens: number) =>
  get<CostProjection[]>(`/recommend/cost?inputTokens=${inputTokens}&outputTokens=${outputTokens}`)

// Admin actions live in adminApi.ts (key-gated) and are only used by /admin
