export type Agent = 'codex' | 'claude'
export type Tier = 'quick' | 'balanced' | 'strong' | 'frontier'
export type CostPriority = 'cost' | 'balanced' | 'quality'
export type RoutingSource = 'jev' | 'fallback'

export interface CatalogRow {
  tier: Tier
  model: string
  effort: string | null
  inputPerMillion: number
  outputPerMillion: number
}

export type Catalog = Record<Agent, CatalogRow[]>

export interface CostRow extends CatalogRow {
  estimatedUsd: number
  deltaVsBalancedUsd: number
}

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  rows: CostRow[]
  selectedUsd: number
  deltaVsBalancedUsd: number
  pricingDate: string
  source: string
  basis: string
  note: string
}

export interface RouteRequest {
  prompt: string
  agent?: Agent
  /** Absolute path on the user's own machine. Optional: the server cannot see it. */
  cwd?: string | null
  costPriority?: CostPriority
  outputTokens?: number
  nativeArgs?: string[]
}

export interface RouteResult {
  agent: Agent
  cwd: string | null
  costPriority: CostPriority
  tier: Tier
  source: RoutingSource
  reason: string
  confidence: number | null
  margin: number | null
  probabilities: Record<Tier, number> | null
  model: string
  effort: string | null
  thresholds: { confidence: number; margin: number }
  command: string
  costs: CostEstimate
}

export interface RouterConfig {
  jevConfigured: boolean
  catalog: Catalog
  pricingDate: string
  thresholds: { confidence: number; margin: number }
}
