'use client'
import { useState, useTransition } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import type { CostProjection } from '../../types/models'
import { fetchCostProjections } from '../../lib/api'

const CHART_TOP_N = 15
const TABLE_TOP_N = 30

// Palette-validated single hue (magnitude chart — identity lives in the labels)
const BAR_HEX = { light: '#2563eb', dark: '#3b82f6' }

/** Humane money: Free / cents for tiny amounts / plain dollars above. */
function formatCost(n: number) {
  if (n === 0) return 'Free'
  if (n < 0.01) return `${(n * 100).toFixed(2)}¢`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
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

  // Free/self-hosted models make every "cheapest" answer $0 — separate them out
  const paid = projections.filter(p => p.totalCost > 0)
  const freeCount = projections.length - paid.length

  const chartData = paid.slice(0, CHART_TOP_N).map(p => ({
    name: p.modelName,
    cost: showBatch && p.hasBatchDiscount ? p.batchTotalCost : p.totalCost,
    isBatch: showBatch && p.hasBatchDiscount,
  }))

  const tableRows = paid.slice(0, TABLE_TOP_N)

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
          {/* Chart: top-N cheapest paid models, horizontal so names stay readable */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {CHART_TOP_N} cheapest paid models {showBatch ? '(batch pricing where available)' : ''}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              For {inputTokens.toLocaleString()} input + {outputTokens.toLocaleString()} output tokens
              {freeCount > 0 && ` · ${freeCount} free/self-hosted models excluded (they cost $0)`}
            </p>
            <ResponsiveContainer width="100%" height={CHART_TOP_N * 32 + 20}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={210}
                  tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: isDark ? '#37415133' : '#e5e7eb55' }}
                  contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', border: '1px solid ' + (isDark ? '#374151' : '#e5e7eb'), borderRadius: 8, color: isDark ? '#f3f4f6' : '#111827' }}
                  formatter={(value: number, _: string, props: { payload?: { isBatch?: boolean } }) => [
                    formatCost(value),
                    props.payload?.isBatch ? 'Batch total' : 'Total cost'
                  ]}
                />
                <Bar
                  dataKey="cost"
                  barSize={18}
                  radius={[0, 4, 4, 0]}
                  fill={isDark ? BAR_HEX.dark : BAR_HEX.light}
                >
                  <LabelList
                    dataKey="cost"
                    position="right"
                    formatter={(v: number) => formatCost(v)}
                    style={{ fontSize: 11, fill: isDark ? '#d1d5db' : '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table: top-N paid models */}
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
                {tableRows.map((p, i) => (
                  <tr key={p.modelId} className={i === 0 ? 'bg-green-50 dark:bg-green-950' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {i === 0 && <span className="text-xs text-green-600 dark:text-green-400 font-bold mr-1">CHEAPEST PAID</span>}
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
            <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
              Showing the {Math.min(TABLE_TOP_N, paid.length)} cheapest paid models of {paid.length}
              {freeCount > 0 && ` · plus ${freeCount} free/self-hosted models (Ollama, free tiers) at $0 — see the Compare tab for those`}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
