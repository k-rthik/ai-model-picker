'use client'
import { PROVIDER_COLORS, CHINA_PROVIDERS, CHINA_WARNING } from '../../types/models'

export function ProviderBadge({ provider }: { provider: string }) {
  if (!provider) return null
  const colorClass = PROVIDER_COLORS[provider]
    ?? 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
  const chinaFlag = CHINA_PROVIDERS.has(provider)
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
        {provider.charAt(0).toUpperCase() + provider.slice(1)}
      </span>
      {chinaFlag && (
        <span
          title={CHINA_WARNING}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 cursor-help"
        >
          ⚠️ CN
        </span>
      )}
    </span>
  )
}
