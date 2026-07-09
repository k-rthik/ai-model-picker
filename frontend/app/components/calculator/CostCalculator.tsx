'use client'
import { useState, useTransition } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { CostProjection } from '../../types/models'
import { fetchCostProjections } from '../../lib/api'

const PROVIDER_HEX: Record<string, { light: string; dark: string }> = {
  anthropic: { light: '#f97316', dark: '#fb923c' },
  openai:    { light: '#22c55e', dark: '#4ade80' },
  google:    { light: '#3b82f6', dark: '#60a5fa' },
  meta:      { light: '#a855f7', dark: '#c084fc' },
  mistral:   { light: '#ef4444', dark: '#f87171' },
}

function formatCost(n: number) {
  if (n < 0.001) return `$${(n * 1000).toFixed(4)}m`
  return `$${n.toFixed(4)}`
}

export function CostCalculator() {
  const [inputTokens,  setInputTokens]  = useState(100_000)
  const [outputTokens, setOutputTokens] = useState(10_000)
  const [projections,  setProjections]  = useState<CostProjection[]>([])
  const [showBatch,    setShowBatch]    = useState(false)
  const [isPending,    startTransition] = useTransition()
  const [error,        setError]        = useState<string | null>(null)

  const isDark = typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const calculate = () => {
    setError(null)
    startTransition(async () => {
      try {
        const data = await fetchCostProjections(inputTokens, outputTokens)
        setProjections(data)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to fetch cost projections')
      }
    })
  }

  const chartData = projections.map(p => ({
    name:     p.modelName.replace('Claude ', 'C.').replace('GPT-', 'G-').replace('Gemini ', 'Gm.'),
    fullName: p.modelName,
    cost:     showBatch && p.hasBatchDiscount ? p.batchTotalCost : p.totalCost,
    provider: p.provider,
    isBatch:  showBatch && p.hasBatchDiscount,
  }))

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Token Inputs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Input tokens</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={inputTokens}
                min={0}
                onChange={e => setInputTokens(Number(e.target.value))}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">
                ~{(inputTokens / 750).toFixed(0)} words
              </span>
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output tokens</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={outputTokens}
                min={0}
                onChange={e => setOutputTokens(Number(e.target.value))}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">
                ~{(outputTokens / 750).toFixed(0)} words
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showBatch}
              onChange={e => setShowBatch(e.target.checked)}
              className="rounded"
            />
            Show batch pricing (where available)
          </label>

          <button
            onClick={calculate}
            disabled={isPending}
            className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {projections.length > 0 && (
        <>
          {/* Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Cost Comparison {showBatch ? '(batch pricing where available)' : '(standard pricing)'}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={v => `$${v.toFixed(4)}`} tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', border: '1px solid ' + (isDark ? '#374151' : '#e5e7eb'), borderRadius: 8, color: isDark ? '#f3f4f6' : '#111827' }}
                  formatter={(value: number, _: string, props: { payload?: { fullName?: string; isBatch?: boolean } }) => [
                    formatCost(value),
                    props.payload?.isBatch ? 'Batch Total' : 'Total Cost'
                  ]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={PROVIDER_HEX[entry.provider]?.[isDark ? 'dark' : 'light'] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Model</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Input Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Output Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Batch Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projections.map((p, i) => (
                  <tr key={p.modelId} className={i === 0 ? 'bg-green-50 dark:bg-green-950' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {i === 0 && <span className="text-xs text-green-600 dark:text-green-400 font-bold mr-1">CHEAPEST</span>}
                      {p.modelName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{formatCost(p.inputCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{formatCost(p.outputCost)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">{formatCost(p.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700 dark:text-blue-400">
                      {p.hasBatchDiscount ? formatCost(p.batchTotalCost) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
