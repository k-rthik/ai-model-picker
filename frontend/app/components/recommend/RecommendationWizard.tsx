'use client'
import { useState, useTransition } from 'react'
import type { RecommendationResult, AlternativeAlert, UseCase } from '../../types/models'
import { USE_CASES, PERSONAS, CHINA_PROVIDERS, CHINA_WARNING } from '../../types/models'
import { fetchRecommendation, fetchNlRecommendation, fetchAlternative } from '../../lib/api'
import { ProviderBadge } from '../shared/ProviderBadge'
import { SpeedBadge } from '../shared/SpeedBadge'
import { BetterAlternativeBanner } from '../alerts/BetterAlternativeBanner'

export function RecommendationWizard() {
  const [step,      setStep]      = useState(0)
  const [useCase,   setUseCase]   = useState<UseCase | null>(null)
  const [quality,   setQuality]   = useState(3)
  const [maxBudget, setMaxBudget] = useState(0)
  const [persona,   setPersona]   = useState<string | null>(null)
  const [skipChina, setSkipChina] = useState(false)
  const [nlQuery,   setNlQuery]   = useState('')
  const [interpretation, setInterpretation] = useState<string | null>(null)
  const [result,    setResult]    = useState<RecommendationResult | null>(null)
  const [alert,     setAlert]     = useState<AlternativeAlert | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const finish = async (rec: RecommendationResult, uc: UseCase, note: string | null) => {
    // Check whether a much cheaper model comes close to the actual top pick
    let alt = null
    if (rec.topPick) {
      try {
        alt = (await fetchAlternative(rec.topPick.id, uc))?.value ?? null
      } catch {
        alt = null
      }
    }
    setResult(rec)
    setAlert(alt)
    setInterpretation(note)
    setStep(3)
  }

  const recommend = () => {
    if (!useCase) return
    setError(null)
    startTransition(async () => {
      try {
        const rec = await fetchRecommendation(useCase, quality, maxBudget, undefined, skipChina)
        await finish(rec, useCase, skipChina ? 'Chinese providers excluded' : null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to get recommendation')
      }
    })
  }

  // Persona flow: quality + budget come from the preset, so skip those steps
  const recommendForPersona = (uc: UseCase, p: string) => {
    setError(null)
    setUseCase(uc)
    startTransition(async () => {
      try {
        const rec = await fetchRecommendation(uc, 3, 0, p, skipChina)
        const label = PERSONAS.find(x => x.id === p)?.label ?? p
        await finish(rec, uc, `${label} preset · ${USE_CASES.find(u => u.id === uc)?.label ?? uc}`
          + (skipChina ? ' · Chinese providers excluded' : ''))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to get recommendation')
      }
    })
  }

  const recommendFromText = () => {
    if (!nlQuery.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const nl = await fetchNlRecommendation(nlQuery.trim(), skipChina)
        setUseCase(nl.useCase)
        const parts = [
          `use case: ${USE_CASES.find(u => u.id === nl.useCase)?.label ?? nl.useCase}`,
          `quality ${nl.quality}/5`,
          nl.maxBudget > 0 ? `budget $${nl.maxBudget}/1M` : null,
          nl.personaLabel ? `${nl.personaLabel} preset` : null,
          nl.excludeChina ? 'Chinese providers excluded' : null,
        ].filter(Boolean)
        await finish(nl.result, nl.useCase, `Understood — ${parts.join(' · ')}`)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to get recommendation')
      }
    })
  }

  const reset = () => {
    setStep(0); setUseCase(null); setQuality(3); setMaxBudget(0); setPersona(null)
    setSkipChina(false); setNlQuery(''); setInterpretation(null); setResult(null); setAlert(null)
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
        {step > 0 && (
          <button
            onClick={reset}
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
            title="Start over"
          >
            🏠 Start Over
          </button>
        )}
      </div>

      {/* Step 0: Describe it, pick a persona, or choose manually */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Natural language input */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Describe what you&apos;re building</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder='e.g. "cheap chatbot over our docs for a weekend project"'
                value={nlQuery}
                onChange={e => setNlQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && recommendFromText()}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={recommendFromText}
                disabled={isPending || !nlQuery.trim()}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isPending ? '…' : 'Recommend →'}
              </button>
            </div>
            <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 dark:text-gray-400 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={skipChina}
                onChange={e => setSkipChina(e.target.checked)}
                className="accent-amber-600"
              />
              ⚠️ Skip Chinese providers <span className="text-gray-400 dark:text-gray-500">(applies to all flows below too)</span>
            </label>
          </div>

          {/* Personas */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Or pick a preset persona</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {persona ? 'Now choose your use case below — quality and budget are preset.' : 'Presets answer the quality and budget questions for you.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {PERSONAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPersona(persona === p.id ? null : p.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:border-blue-400
                    ${persona === p.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs font-semibold text-center text-gray-900 dark:text-gray-100">{p.label}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">{p.description}</span>
                </button>
              ))}
            </div>

            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {persona ? 'What are you building?' : 'Or choose your use case manually'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {USE_CASES.map(uc => (
                <button
                  key={uc.id}
                  onClick={() => {
                    if (persona) { recommendForPersona(uc.id, persona) }
                    else { setUseCase(uc.id); setStep(1) }
                  }}
                  disabled={isPending}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:border-blue-400 hover:shadow-sm disabled:opacity-50
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
          {interpretation && (
            <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              🧠 {interpretation}
            </div>
          )}
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

            {CHINA_PROVIDERS.has(result.topPick.providerId) && (
              <div className="mb-5 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                ⚠️ {CHINA_WARNING}
              </div>
            )}

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
