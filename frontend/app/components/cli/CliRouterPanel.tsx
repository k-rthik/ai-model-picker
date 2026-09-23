'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Agent, CostPriority, RouteResult, RouterConfig } from '../../lib/cli-router/types'
import type { NlRecommendation } from '../../types/models'
import { USE_CASES, CHINA_PROVIDERS } from '../../types/models'
import { fetchRouterConfig, routePrompt } from '../../lib/cliRouterApi'
import { fetchNlRecommendation } from '../../lib/api'
import { ProviderBadge } from '../shared/ProviderBadge'
import { SpeedBadge } from '../shared/SpeedBadge'

const AGENTS: { id: Agent; label: string; icon: string; blurb: string }[] = [
  { id: 'codex',  label: 'Codex CLI',   icon: '>_', blurb: 'codex' },
  { id: 'claude', label: 'Claude Code', icon: '✳',  blurb: 'claude' },
]

const PRIORITIES: { id: CostPriority; label: string; hint: string }[] = [
  { id: 'cost',     label: 'Cost first',    hint: 'Keep spend down' },
  { id: 'balanced', label: 'Balance both',  hint: 'Cost + capability' },
  { id: 'quality',  label: 'Quality first', hint: 'Prioritize capability' },
]

const TIER_STYLES: Record<string, string> = {
  quick:    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  balanced: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  strong:   'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  frontier: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
}

function money(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available'
  if (value === 0) return '$0.00'
  if (Math.abs(value) < 0.0001) return `$${value.toFixed(6)}`
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value)
}

const unitPrice = (v: number) => (Number.isFinite(v) ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—')
const count = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US') : 'unknown')

export function CliRouterPanel() {
  const [config, setConfig]   = useState<RouterConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [prompt, setPrompt]         = useState('')
  const [agent, setAgent]           = useState<Agent>('claude')
  const [priority, setPriority]     = useState<CostPriority>('balanced')
  const [cwd, setCwd]               = useState('')
  const [outputTokens, setOutputTokens] = useState(2000)
  const [strict, setStrict]         = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [busy, setBusy]             = useState(false)
  const [cliResult, setCliResult]   = useState<RouteResult | null>(null)
  const [cliError, setCliError]     = useState<string | null>(null)
  const [nlResult, setNlResult]     = useState<NlRecommendation | null>(null)
  const [nlError, setNlError]       = useState<string | null>(null)
  const [nlBusy, setNlBusy]         = useState(false)
  const [copied, setCopied]         = useState(false)

  const abortRef  = useRef<AbortController | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchRouterConfig(controller.signal)
      .then(setConfig)
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return
        setConfigError(e instanceof Error ? e.message : 'Could not reach the router.')
      })
    return () => controller.abort()
  }, [])

  // Any edit invalidates the answer on screen, so a stale command is never copied.
  const invalidate = useCallback(() => {
    versionRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setCliResult(null); setCliError(null)
    setNlResult(null);  setNlError(null)
    setBusy(false);     setNlBusy(false); setCopied(false)
  }, [])

  const submit = useCallback(() => {
    const task = prompt.trim()
    if (!task) { setCliError('Add a prompt so the router can choose a model.'); return }
    if (cwd.trim() && !/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(cwd.trim())) {
      setAdvancedOpen(true)
      setCliError('Use an absolute directory path, such as /Users/you/project.')
      return
    }

    versionRef.current += 1
    const version = versionRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true); setNlBusy(true); setCopied(false)
    setCliResult(null); setCliError(null)
    setNlResult(null);  setNlError(null)

    // One prompt, two independent answers: the CLI tier from the local router,
    // and a model from the tracked catalog via the backend's rule-based parser.
    // Either can fail on its own without blanking the other.
    routePrompt(
      { prompt: task, agent, cwd: cwd.trim() || null, costPriority: priority, outputTokens, strict },
      controller.signal,
    )
      .then(result => { if (version === versionRef.current) setCliResult(result) })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError' || version !== versionRef.current) return
        setCliError(e instanceof Error ? e.message : 'Routing could not be completed.')
      })
      .finally(() => { if (version === versionRef.current) setBusy(false) })

    fetchNlRecommendation(task)
      .then(result => { if (version === versionRef.current) setNlResult(result) })
      .catch((e: unknown) => {
        if (version !== versionRef.current) return
        setNlError(e instanceof Error ? e.message : 'Could not reach the model catalog.')
      })
      .finally(() => { if (version === versionRef.current) setNlBusy(false) })
  }, [prompt, agent, cwd, priority, outputTokens, strict])

  const copyCommand = async () => {
    if (!cliResult) return
    try {
      await navigator.clipboard.writeText(cliResult.command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCliError('Clipboard unavailable. Select the command and copy it manually.')
    }
  }

  const ready = Boolean(config) && !busy

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Intro */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
          Describe the task. Get the CLI command and the model.
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          One prompt, two answers. The left card routes it to a tier of Codex CLI or Claude Code
          and hands you a command. The right card reads the same words and picks from every model
          this site tracks. Nothing runs from this page.
        </p>
        {configError && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{configError}</p>
        )}
        {config && !config.jevConfigured && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            No routing key is configured on this server, so every CLI answer will be the balanced tier.
          </p>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-5">
        <div>
          <label htmlFor="cli-prompt" className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            What are you working on?
          </label>
          <textarea
            id="cli-prompt"
            rows={5}
            value={prompt}
            maxLength={40000}
            spellCheck
            onChange={e => { setPrompt(e.target.value); invalidate() }}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (ready) submit() }
            }}
            placeholder={'Describe your task, just as you would in the CLI.\n\nFor example: Add a dark mode toggle and persist the preference across sessions.'}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Press ⌘/Ctrl + Enter to route.</span>
            <span>{count(prompt.length)} characters</span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Where will you run it?</legend>
            <div className="flex gap-2">
              {AGENTS.map(a => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={agent === a.id}
                  onClick={() => { setAgent(a.id); invalidate() }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
                    ${agent === a.id
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <span className="font-mono text-xs">{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Is token cost a priority?</legend>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={priority === p.id}
                  title={p.hint}
                  onClick={() => { setPriority(p.id); invalidate() }}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors
                    ${priority === p.id
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <details open={advancedOpen} onToggle={e => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Working directory &amp; estimate settings
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cli-cwd" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Working directory (optional)
              </label>
              <input
                id="cli-cwd"
                type="text"
                value={cwd}
                spellCheck={false}
                autoComplete="off"
                placeholder="/Users/you/project"
                onChange={e => { setCwd(e.target.value); invalidate() }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Adds a <code>cd</code> in front of the command. This site cannot detect the path.
              </p>
            </div>
            <div>
              <label htmlFor="cli-output" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Assumed output tokens
              </label>
              <input
                id="cli-output"
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={outputTokens}
                onChange={e => { setOutputTokens(Number(e.target.value)); invalidate() }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Generated plus reasoning tokens. Actual usage depends on the task.
              </p>
            </div>
            <label className="sm:col-span-2 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={strict}
                onChange={e => { setStrict(e.target.checked); invalidate() }}
                className="mt-0.5"
              />
              <span>
                <strong className="text-gray-800 dark:text-gray-200">Strict routing.</strong>{' '}
                Stop instead of using the balanced fallback when the router cannot choose confidently.
              </span>
            </label>
          </div>
        </details>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || !prompt.trim()}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Finding your model…' : 'Route my prompt'}
        </button>
      </div>

      {/* Results */}
      {(busy || nlBusy || cliResult || nlResult || cliError || nlError) && (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <CliCard result={cliResult} error={cliError} busy={busy} onCopy={copyCommand} copied={copied} pricingDate={config?.pricingDate} />
          <CatalogCard result={nlResult} error={nlError} busy={nlBusy} />
        </div>
      )}
    </div>
  )
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm anim-rise">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-1">{eyebrow}</p>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      {children}
    </section>
  )
}

function CliCard({ result, error, busy, onCopy, copied, pricingDate }: {
  result: RouteResult | null
  error: string | null
  busy: boolean
  onCopy: () => void
  copied: boolean
  pricingDate?: string
}) {
  return (
    <Card eyebrow="01 / Your next command" title="Run it in the CLI">
      {busy && <p className="text-sm text-gray-500 dark:text-gray-400">Matching your prompt to a tier…</p>}
      {!busy && error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {!busy && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded border text-xs font-semibold uppercase tracking-wide ${TIER_STYLES[result.tier] ?? ''}`}>
              {result.tier}
            </span>
            <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{result.model}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {result.effort ? `${result.effort} reasoning effort` : 'no configurable effort'}
            </span>
          </div>

          <div className={`rounded-lg border p-3 text-xs ${result.source === 'fallback'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
            : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
            <strong>{result.source === 'fallback' ? 'Balanced fallback' : 'Confident routing'}</strong>
            <p className="mt-0.5">{result.reason}</p>
            {typeof result.confidence === 'number' && typeof result.margin === 'number' && (
              <p className="mt-1 font-mono">
                {Math.round(result.confidence * 100)}% confidence · {(result.margin * 100).toFixed(1).replace(/\.0$/, '')}-point margin
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Ready for your terminal</span>
              <button
                type="button"
                onClick={onCopy}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {copied ? '✓ Copied' : '⧉ Copy command'}
              </button>
            </div>
            <pre className="rounded-lg bg-gray-900 dark:bg-black text-gray-100 text-xs p-3 overflow-x-auto"><code>{result.command}</code></pre>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Review it, then paste it into your terminal. Nothing is run from this page.
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Estimated token cost</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">API estimate</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-1.5 font-medium">Tier / model</th>
                    <th className="py-1.5 font-medium">In / out per 1M</th>
                    <th className="py-1.5 font-medium text-right">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {result.costs.rows.map(row => (
                    <tr
                      key={row.tier}
                      className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                        row.tier === result.tier ? 'bg-blue-50/60 dark:bg-blue-950/40 font-semibold' : ''}`}
                    >
                      <td className="py-1.5">
                        <span className="uppercase tracking-wide text-[10px] text-gray-500 dark:text-gray-400">{row.tier}</span>
                        <span className="block font-mono text-gray-800 dark:text-gray-200">
                          {row.model}{row.effort ? ` · ${row.effort}` : ''}
                        </span>
                      </td>
                      <td className="py-1.5 font-mono text-gray-600 dark:text-gray-400">
                        {unitPrice(row.inputPerMillion)} / {unitPrice(row.outputPerMillion)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-gray-800 dark:text-gray-200">{money(row.estimatedUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ≈ {count(result.costs.inputTokens)} prompt tokens · {count(result.costs.outputTokens)} assumed output tokens.{' '}
              {Math.abs(result.costs.deltaVsBalancedUsd) < 1e-8
                ? 'Same estimate as the balanced tier.'
                : `${money(Math.abs(result.costs.deltaVsBalancedUsd))} ${result.costs.deltaVsBalancedUsd < 0 ? 'less' : 'more'} than the balanced tier.`}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              {result.costs.note}{pricingDate ? ` Pricing reference: ${pricingDate}.` : ''}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function CatalogCard({ result, error, busy }: { result: NlRecommendation | null; error: string | null; busy: boolean }) {
  const top = result?.result.topPick ?? null
  const runnerUp = result?.result.runnerUp ?? null

  return (
    <Card eyebrow="02 / From the whole catalog" title="Or pick a model to call directly">
      {busy && <p className="text-sm text-gray-500 dark:text-gray-400">Reading your prompt against every tracked model…</p>}
      {!busy && error && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The model catalog is not reachable right now, so only the CLI answer is shown.
          <span className="block text-xs text-gray-400 mt-1">{error}</span>
        </p>
      )}
      {!busy && result && !top && (
        <p className="text-sm text-gray-600 dark:text-gray-400">No tracked model matched that description.</p>
      )}
      {!busy && top && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{top.name}</div>
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{top.id}</div>
            </div>
            <ProviderBadge provider={top.providerId} />
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            Read as{' '}
            <strong className="text-gray-800 dark:text-gray-200">
              {USE_CASES.find(u => u.id === result!.useCase)?.label ?? result!.useCase}
            </strong>{' '}
            · quality {result!.quality}/5
            {result!.maxBudget > 0 ? ` · budget $${result!.maxBudget}/1M` : ''}
            {result!.personaLabel ? ` · ${result!.personaLabel} preset` : ''}
            {result!.excludeChina ? ' · Chinese providers excluded' : ''}
          </p>

          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{result!.result.reasoning}</p>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">Input</div>
              <div className="font-bold text-green-700 dark:text-green-400">${top.inputPricePer1m}/1M</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">Context</div>
              <div className="font-bold text-gray-900 dark:text-gray-100">
                {top.contextWindow >= 1_000_000
                  ? `${(top.contextWindow / 1_000_000).toFixed(1)}M`
                  : `${(top.contextWindow / 1000).toFixed(0)}K`}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">Speed</div>
              <SpeedBadge tier={top.speedTier} />
            </div>
          </div>

          {CHINA_PROVIDERS.has(top.providerId) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              🇨🇳 Chinese provider. Review data-residency requirements before sending sensitive data.
            </p>
          )}

          {runnerUp && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Runner-up</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{runnerUp.name}</span>
                <ProviderBadge provider={runnerUp.providerId} />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ${runnerUp.inputPricePer1m}/1M input · {runnerUp.speedTier} speed
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Parsed by the site&apos;s own rule-based reader. No third-party language model is called.
          </p>
        </div>
      )}
    </Card>
  )
}
