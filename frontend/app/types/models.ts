export type Provider = string
export type SpeedTier = 'fast' | 'medium' | 'slow'
export type UseCase =
  | 'coding' | 'writing' | 'analysis' | 'summarization'
  | 'rag' | 'agents' | 'vision' | 'long-context'

export interface AiModel {
  id: string
  name: string
  providerId: Provider           // was: provider
  pricingModel: 'per_token' | 'free' | 'per_request'
  contextWindow: number
  maxOutputTokens: number | null
  speedTier: SpeedTier
  capabilities: Record<string, boolean>
  inputPricePer1m: number
  outputPricePer1m: number
  batchInputPer1m: number | null
  batchOutputPer1m: number | null
  requestPrice: number | null
  source: string
  externalId: string | null
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  // Convenience
  supportsVision?: boolean       // computed on backend, may not be present
}

export interface BenchmarkScore {
  id: number
  modelId: string
  benchmarkName: string
  score: number
  source: string
  scrapedAt: string
}

export interface ArenaScore {
  id: number
  modelId: string
  modelNameOnLeaderboard: string
  eloScore: number
  rankPosition: number
  votes: number
  scrapedAt: string
}

export interface UseCaseScore {
  id: number
  modelId: string
  useCase: UseCase
  score: number
  computedAt: string
}

export interface CostProjection {
  modelId: string
  modelName: string
  provider: Provider
  inputCost: number
  outputCost: number
  totalCost: number
  batchTotalCost: number
  hasBatchDiscount: boolean
}

export interface RecommendationResult {
  topPick: AiModel | null
  topScore: number
  runnerUp: AiModel | null
  runnerUpScore: number
  reasoning: string
}

export interface AlternativeAlert {
  selected: AiModel
  alternative: AiModel
  savingsPct: number
  scoreDelta: number
}

export interface NlRecommendation {
  useCase: UseCase
  quality: number
  maxBudget: number
  persona: string | null
  personaLabel: string | null
  result: RecommendationResult
}

/**
 * Providers headquartered in China. Their hosted APIs may process data under
 * Chinese jurisdiction — flagged so users can weigh data-residency concerns.
 * (Open-weight models from these labs self-hosted via Ollama are unaffected.)
 */
export const CHINA_PROVIDERS = new Set([
  'alibaba', 'baidu', 'bytedance', 'bytedance-seed', 'deepseek', 'kwaipilot',
  'minimax', 'moonshotai', 'qwen', 'stepfun', 'tencent', 'xiaomi', 'z-ai',
])

export const CHINA_WARNING =
  'Chinese company — hosted API may process data under Chinese jurisdiction. Review data-residency requirements before sending sensitive data.'

export const PERSONAS: { id: string; label: string; description: string; icon: string }[] = [
  { id: 'SOLO_HACKER', label: 'Solo hacker',  description: 'Cheapest API that works',       icon: '👨‍💻' },
  { id: 'STARTUP_MVP', label: 'Startup MVP',  description: 'Optimize for shipping speed',   icon: '🚀' },
  { id: 'ENTERPRISE',  label: 'Enterprise',   description: 'Compliance and privacy',        icon: '🏢' },
  { id: 'RESEARCHER',  label: 'Researcher',   description: 'Maximum reasoning power',       icon: '🔬' },
  { id: 'STUDENT',     label: 'Student',      description: 'Free & open-source only',       icon: '🎓' },
]

export const USE_CASES: { id: UseCase; label: string; description: string; icon: string }[] = [
  { id: 'coding',       label: 'Coding',         description: 'Code generation, debugging, review',      icon: '💻' },
  { id: 'writing',      label: 'Writing',         description: 'Content, emails, documentation',          icon: '✍️' },
  { id: 'analysis',     label: 'Analysis',        description: 'Data analysis, research, reasoning',      icon: '🔬' },
  { id: 'summarization',label: 'Summarization',   description: 'Documents, articles, long texts',         icon: '📝' },
  { id: 'rag',          label: 'RAG / Search',    description: 'Retrieval-augmented generation, Q&A',     icon: '🔍' },
  { id: 'agents',       label: 'Agents',          description: 'Multi-step autonomous tasks, tool use',   icon: '🤖' },
  { id: 'vision',       label: 'Vision',          description: 'Image understanding, multimodal tasks',   icon: '👁️' },
  { id: 'long-context', label: 'Long Context',    description: 'Very large inputs, 100k+ tokens',         icon: '📚' },
]

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic:   'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
  openai:      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
  google:      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  meta:        'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
  mistral:     'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  databricks:  'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  cohere:      'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
  groq:        'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  ollama:      'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  huggingface: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  perplexity:  'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700',
  qwen:        'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  deepseek:    'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
  nvidia:      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
  'x-ai':      'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
  'z-ai':      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
  minimax:     'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-700',
  microsoft:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  amazon:      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
  'arcee-ai':  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
}

export const SPEED_COLORS: Record<SpeedTier, string> = {
  fast:   'text-green-600',
  medium: 'text-yellow-600',
  slow:   'text-red-600',
}
