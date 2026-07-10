'use client'

/**
 * Compact toggle for excluding Chinese providers: a small 🇨🇳 flag that
 * gains a red prohibition cross when the filter is active.
 */
export function ChinaFilterToggle({ enabled, onChange, className = '' }: {
  enabled: boolean; onChange: (v: boolean) => void; className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Exclude Chinese providers"
      title={enabled
        ? 'Chinese providers excluded — click to include'
        : 'Exclude Chinese providers — for users whose data-governance requirements rule out Chinese jurisdiction (trust deficit around data-access laws)'}
      onClick={() => onChange(!enabled)}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm transition-colors
        ${enabled
          ? 'border-red-400 bg-red-50 dark:bg-red-950 dark:border-red-700'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}
        ${className}`}
    >
      <span className="relative inline-flex items-center justify-center w-6 h-5 leading-none">
        <span className={`text-base ${enabled ? 'opacity-60' : ''}`}>🇨🇳</span>
        {enabled && (
          <svg viewBox="0 0 24 20" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <line x1="2" y1="2" x2="22" y2="18" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="22" y1="2" x2="2" y2="18" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className={`text-xs font-medium ${enabled ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {enabled ? 'excluded' : 'exclude'}
      </span>
    </button>
  )
}
