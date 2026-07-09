'use client'
import { useState, useEffect, useTransition } from 'react'
import type { AiModel } from '../types/models'
import type { IngestionLogEntry, ScrapeLogEntry } from '../lib/adminApi'
import {
  runIngest, runIngestSource, runScrape, runRecompute,
  fetchIngestionLogs, fetchScrapeLogs, fetchAllModels,
  deactivateModel, activateModel, fetchAdminProviders,
  getAdminKey, setAdminKey, clearAdminKey
} from '../lib/adminApi'

type AdminTab = 'ingest' | 'models' | 'providers' | 'logs'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('ingest')
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  // Validate the key against a real admin endpoint (401 = wrong key)
  const tryAuth = async (key: string) => {
    setChecking(true)
    setAuthError(null)
    setAdminKey(key)
    try {
      await fetchIngestionLogs()
      setAuthed(true)
    } catch {
      clearAdminKey()
      setAuthError('Invalid admin key')
    } finally {
      setChecking(false)
    }
  }

  // Auto-login with a previously stored key
  useEffect(() => {
    const stored = getAdminKey()
    if (stored) void tryAuth(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-80 space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">🔐</div>
            <div className="font-bold text-gray-100 text-lg">Admin Panel</div>
            <div className="text-xs text-gray-500 mt-1">AI Model Picker</div>
          </div>
          <input
            type="password"
            placeholder="Admin API key"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pin && void tryAuth(pin)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => pin && void tryAuth(pin)}
            disabled={checking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2 font-semibold transition-colors"
          >
            {checking ? 'Checking…' : 'Enter'}
          </button>
          {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}
        </div>
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'ingest',    label: 'Ingest',    icon: '⚡' },
    { id: 'models',    label: 'Models',    icon: '🤖' },
    { id: 'providers', label: 'Providers', icon: '🏢' },
    { id: 'logs',      label: 'Logs',      icon: '📋' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <div>
            <div className="font-bold text-gray-100">Admin Panel</div>
            <div className="text-xs text-gray-500">AI Model Picker</div>
          </div>
        </div>
        <a href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to dashboard
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'ingest'    && <IngestPanel />}
        {tab === 'models'    && <ModelsPanel />}
        {tab === 'providers' && <ProvidersPanel />}
        {tab === 'logs'      && <LogsPanel />}
      </div>
    </div>
  )
}

// ── Ingest Panel ──────────────────────────────────────────────────────────────
function IngestPanel() {
  const [isPending, startTransition] = useTransition()
  const [log, setLog] = useState<string[]>([])

  const run = (label: string, fn: () => Promise<unknown>) => {
    startTransition(async () => {
      setLog(prev => [...prev, `[${now()}] Running ${label}...`])
      try {
        const result = await fn()
        const msg = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        setLog(prev => [...prev, `[${now()}] ✅ ${label}: ${msg}`])
      } catch (e: unknown) {
        setLog(prev => [...prev, `[${now()}] ❌ ${label}: ${e instanceof Error ? e.message : String(e)}`])
      }
    })
  }

  const actions = [
    { label: 'Run All Ingestors',        fn: () => runIngest() },
    { label: 'OpenRouter Only',           fn: () => runIngestSource('openrouter') },
    { label: 'YAML Seeder Only',          fn: () => runIngestSource('yaml') },
    { label: 'Scrape Benchmarks (HF/LMSYS/AA)', fn: () => runScrape() },
    { label: 'Recompute Use-Case Scores', fn: () => runRecompute() },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => run(a.label, a.fn)}
            disabled={isPending}
            className="bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-xl p-4 text-left transition-all disabled:opacity-50 group"
          >
            <div className="text-sm font-medium text-gray-200 group-hover:text-blue-400">{a.label}</div>
          </button>
        ))}
        <button
          onClick={() => setLog([])}
          className="bg-gray-900 border border-gray-700 hover:border-red-500 rounded-xl p-4 text-left transition-all"
        >
          <div className="text-sm font-medium text-gray-500 hover:text-red-400">Clear Log</div>
        </button>
      </div>

      {/* Log console */}
      <div className="bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs text-green-400 h-72 overflow-y-auto space-y-1">
        {log.length === 0
          ? <span className="text-gray-600">Waiting for commands...</span>
          : log.map((line, i) => <div key={i}>{line}</div>)}
        {isPending && <div className="animate-pulse">Processing...</div>}
      </div>
    </div>
  )
}

// ── Models Panel ──────────────────────────────────────────────────────────────
function ModelsPanel() {
  const [models, setModels] = useState<AiModel[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      const data = await fetchAllModels(!showInactive)
      setModels(data)
    })
  }

  useEffect(() => { load() }, [showInactive])

  const toggle = (model: AiModel) => {
    startTransition(async () => {
      if (model.active) await deactivateModel(model.id)
      else await activateModel(model.id)
      load()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive models
        </label>
        <span className="text-xs text-gray-600 ml-auto">{models.length} models</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="min-w-full text-sm divide-y divide-gray-800">
          <thead className="bg-gray-900">
            <tr>
              {['Model', 'Provider', 'Source', 'Pricing', 'Input $/1M', 'Context', 'Active', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-950 divide-y divide-gray-900">
            {models.map(m => (
              <tr key={m.id} className={m.active ? '' : 'opacity-40'}>
                <td className="px-4 py-3 font-medium text-gray-200 max-w-xs truncate">{m.name}</td>
                <td className="px-4 py-3 text-gray-400">{m.providerId}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${m.source === 'openrouter' ? 'bg-purple-900 text-purple-300'
                    : m.source === 'yaml' ? 'bg-green-900 text-green-300'
                    : 'bg-gray-800 text-gray-400'}`}>
                    {m.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{m.pricingModel}</td>
                <td className="px-4 py-3 font-mono text-green-400">${m.inputPricePer1m?.toFixed(3) ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">
                  {m.contextWindow >= 1_000_000
                    ? `${(m.contextWindow / 1_000_000).toFixed(1)}M`
                    : `${(m.contextWindow / 1000).toFixed(0)}K`}
                </td>
                <td className="px-4 py-3">{m.active ? '✅' : '❌'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(m)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors
                      ${m.active
                        ? 'text-red-400 hover:bg-red-900 hover:text-red-200'
                        : 'text-green-400 hover:bg-green-900 hover:text-green-200'}`}
                  >
                    {m.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Providers Panel ───────────────────────────────────────────────────────────
function ProvidersPanel() {
  const [providers, setProviders] = useState<{ id: string; name: string; isLocal: boolean; active: boolean }[]>([])

  useEffect(() => {
    fetchAdminProviders().then(data => setProviders(data as never))
  }, [])

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="min-w-full text-sm divide-y divide-gray-800">
        <thead className="bg-gray-900">
          <tr>
            {['ID', 'Name', 'Type', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-950 divide-y divide-gray-900">
          {providers.map((p: { id: string; name: string; isLocal: boolean; active: boolean }) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-mono text-gray-300">{p.id}</td>
              <td className="px-4 py-3 font-medium text-gray-200">{p.name}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${p.isLocal ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
                  {p.isLocal ? 'Local' : 'Cloud'}
                </span>
              </td>
              <td className="px-4 py-3">{p.active ? '✅ Active' : '❌ Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Logs Panel ────────────────────────────────────────────────────────────────
function LogsPanel() {
  const [ingestLogs, setIngestLogs] = useState<IngestionLogEntry[]>([])
  const [scrapeLogs, setScrapeLogs] = useState<ScrapeLogEntry[]>([])

  useEffect(() => {
    fetchIngestionLogs().then(setIngestLogs).catch(() => {})
    fetchScrapeLogs().then(setScrapeLogs).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <LogTable title="Ingestion Logs" rows={ingestLogs.map(l => ({
        id: l.id, source: l.source, status: l.status,
        detail: `+${l.modelsAdded} ~${l.modelsUpdated} skip${l.modelsSkipped}`,
        error: l.errorMessage, time: l.ranAt
      }))} />
      <LogTable title="Scrape Logs" rows={scrapeLogs.map(l => ({
        id: l.id, source: l.source, status: l.status,
        detail: `${l.recordsUpserted} records`,
        error: l.errorMessage, time: l.ranAt
      }))} />
    </div>
  )
}

function LogTable({ title, rows }: {
  title: string
  rows: { id: number; source: string; status: string; detail: string; error: string | null; time: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="min-w-full text-xs divide-y divide-gray-800">
          <thead className="bg-gray-900">
            <tr>
              {['Source', 'Status', 'Detail', 'Error', 'Time'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-950 divide-y divide-gray-900">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-gray-600 text-center">No logs yet</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono text-gray-300">{r.source}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full font-medium
                    ${r.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-400">{r.detail}</td>
                <td className="px-4 py-2 text-red-400 max-w-xs truncate">{r.error ?? '—'}</td>
                <td className="px-4 py-2 text-gray-500 font-mono">{r.time?.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const now = () => new Date().toTimeString().slice(0, 8)
