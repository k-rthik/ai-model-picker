'use client'
import { useState } from 'react'
import type { AlternativeAlert, UseCase } from '../../types/models'

interface Props {
  alert: AlternativeAlert
  useCase: UseCase
}

export function BetterAlternativeBanner({ alert, useCase }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const savingsPct = Math.round(alert.savingsPct * 100)

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3 shadow-sm">
      <span className="text-2xl flex-shrink-0">💡</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Better value alternative found</div>
        <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
          <span className="font-semibold">{alert.alternative.name}</span> is{' '}
          <span className="font-bold text-green-700 dark:text-green-400">{savingsPct}% cheaper</span> than{' '}
          {alert.selected.name} for <span className="font-medium">{useCase}</span>,
          with only a <span className="font-semibold">{alert.scoreDelta.toFixed(1)}-point</span> quality drop.
        </p>
        <div className="flex gap-4 mt-2 text-xs text-amber-700 dark:text-amber-400">
          <span>{alert.alternative.name}: <strong>${alert.alternative.inputPricePer1m}/1M</strong></span>
          <span>{alert.selected.name}: <strong>${alert.selected.inputPricePer1m}/1M</strong></span>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 text-lg leading-none flex-shrink-0"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
