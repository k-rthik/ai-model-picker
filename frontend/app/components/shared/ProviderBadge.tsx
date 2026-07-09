'use client'
import { PROVIDER_COLORS } from '../../types/models'

export function ProviderBadge({ provider }: { provider: string }) {
  if (!provider) return null
  const colorClass = PROVIDER_COLORS[provider]
    ?? 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {provider.charAt(0).toUpperCase() + provider.slice(1)}
    </span>
  )
}
