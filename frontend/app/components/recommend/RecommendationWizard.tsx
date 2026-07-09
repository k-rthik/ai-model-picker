'use client'
import { useState, useTransition } from 'react'
import type { RecommendationResult, AlternativeAlert, UseCase } from '../../types/models'
import { USE_CASES } from '../../types/models'
import { fetchRecommendation, fetchAlternative } from '../../lib/api'
import { ProviderBadge } from '../shared/ProviderBadge'
import { SpeedBadge } from '../shared/SpeedBadge'
import { BetterAlternativeBanner } from '../alerts/BetterAlternativeBanner'

export function RecommendationWizard() {
  const [step,      setStep]      = useState(0)
  const [useCase,   setUseCase]   = useState<UseCase | null>(null)
  const [quality,   setQuality]   = useState(3)
  const [maxBudget, setMaxBudget] = useState(0)
  const [result,    setResult]    = useState<RecommendationResult | null>(null)
  const [alert,     setAlert]     = useState<AlternativeAlert | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const recommend = () => {
    if (!useCase) return
    setError(null)
    startTransition(async () => {
      try {
        const rec = await fetchRecommendation(useCase, quality, maxBudget)
        // Check whether a much cheaper model comes close to the actual top pick
        let alt = null
        if (rec.topPick) {
          try {
            alt = (await fetchAlternative(rec.topPick.id, useCase))?.value ?? null
          } catch {
            alt = null
          }
        }
        setResult(rec)
        setAlert(alt)
        setStep(3)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to get recommendation')
      }
    })
  }

  const reset = () => {
    setStep(0); setUseCase(null); setQuality(3); setMaxBudget(0); setResult(null); setAlert(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {['Use Case', 'Quality', 'Budget', 'Result'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${i <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
              {i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
            {i < 3 && <div className={`flex-1 h-0.5 w-8 ${i < step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Use case */}
      {step === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">What are you building?</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {USE_CASES.map(uc => (
              <button
                key={uc.id}
                onClick={() => { setUseCase(uc.id); setStep(1) }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:border-blue-400 hover:shadow-sm
                  ${useCase === uc.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700'}`}
              >
                <span className="text-2xl">{uc.icon}</span>
                <span className="text-xs font-semibold text-center text-gray-900 dark:text-gray-100">{uc.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-center leading-tight">{uc.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Quality */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">How important is quality?</h3>
          <div className="space-y-3">
            {[
              { v: 1, label: 'Good enough',   desc: 'Fast and cheap, minor errors acceptable' },
              { v: 2, label: 'Decent',         desc: 'Mostly accurate, occasional mistakes ok' },
              { v: 3, label: 'Good',           desc: 'Reliable quality for production use' },
              { v: 4, label: 'High quality',   desc: 'Near-perfect, minimal hallucination' },
              { v: 5, label: 'Best in class',  desc: 'Top model regardless of cost' },
            ].map(({ v, label, desc }) => (
              <button
                key={v}
                onClick={() => { setQuality(v); setStep(2) }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400
                  ${quality === v
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                  ${quality === v ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{v}</div>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(0)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">← Back</button>
        </div>
      )}

      {/* Step 2: Budget */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Max input cost per 1M tokens?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Set 0 for no budget constraint.</p>

          <div className="space-y-2">
            <input
              type="range"
              min={0} max={20} step={0.5}
              value={maxBudget}
              onChange={e => setMaxBudget(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>$0 (any)</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
                {maxBudget === 0 ? 'No limit' : `$${maxBudget}/1M tokens`}
              </span>
              <span>$20</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">← Back</button>
            <button
              onClick={recommend}
              disabled={isPending}
              className="ml-auto bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Finding best model...' : 'Get Recommendation →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && result.topPick && (
        <div className="space-y-4">
          {alert && <BetterAlternativeBanner alert={alert} useCase={useCase!} />}

          <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-blue-600 p-6 shadow-md">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Top Pick</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.topPick.name}</div>
              </div>
              <ProviderBadge provider={result.topPick.providerId} />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">{result.reasoning}</p>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Input price</div>
                <div className="font-bold text-green-700 dark:text-green-400">${result.topPick.inputPricePer1m}/1M</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Context</div>
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {result.topPick.contextWindow >= 1_000_000
                    ? `${(result.topPick.contextWindow / 1_000_000).toFixed(1)}M`
                    : `${(result.topPick.contextWindow / 1000).toFixed(0)}K`}
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Speed</div>
                <SpeedBadge tier={result.topPick.speedTier} />
              </div>
            </div>
          </div>

          {result.runnerUp && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Runner Up</div>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-800 dark:text-gray-100">{result.runnerUp.name}</div>
                <ProviderBadge provider={result.runnerUp.providerId} />
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ${result.runnerUp.inputPricePer1m}/1M input · {result.runnerUp.speedTier} speed
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full py-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Start Over
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}
    </div>
  )
}
