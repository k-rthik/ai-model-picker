'use client'

/**
 * Lab-notebook section tile: mono index label + accent top border.
 * `flush` removes body padding so tables can run edge to edge.
 */
export function LabTile({ code, title, hint, children, className = '', flush = false }: {
  code: string; title: string; hint?: string; children: React.ReactNode
  className?: string; flush?: boolean
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 border-t-2 border-t-blue-500/70 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${flush ? '' : 'p-6'} ${className}`}>
      <div className={flush ? 'px-6 pt-6 pb-3' : ''}>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400 mb-1.5">
          {code}
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{hint}</p>}
        {!hint && !flush && <div className="mb-3" />}
      </div>
      {children}
    </div>
  )
}
