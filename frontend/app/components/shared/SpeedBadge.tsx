'use client'
import type { SpeedTier } from '../../types/models'
import { SPEED_COLORS } from '../../types/models'

const LABELS: Record<SpeedTier, string> = { fast: '⚡ Fast', medium: '➡ Medium', slow: '🐢 Slow' }

export function SpeedBadge({ tier }: { tier: SpeedTier }) {
  return (
    <span className={`text-xs font-semibold ${SPEED_COLORS[tier]}`}>
      {LABELS[tier]}
    </span>
  )
}
