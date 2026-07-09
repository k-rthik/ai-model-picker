/**
 * Brand mark: a field of candidate models (muted dots) with the chosen one
 * ringed and lit — the product in one glyph. Muted dots follow text color;
 * the pick stays accent blue in both modes.
 */
export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      {/* candidate models */}
      <circle cx="7"  cy="7"  r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="16" cy="7"  r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="7"  cy="16" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="16" cy="16" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="7"  cy="25" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="16" cy="25" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="25" cy="16" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      <circle cx="25" cy="25" r="2.6" className="fill-gray-300 dark:fill-gray-600" />
      {/* the pick */}
      <circle cx="25" cy="7" r="3.4" className="fill-blue-600 dark:fill-blue-400" />
      <circle cx="25" cy="7" r="6" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.6" fill="none" />
    </svg>
  )
}
