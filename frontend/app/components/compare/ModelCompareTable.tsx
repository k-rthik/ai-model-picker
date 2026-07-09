'use client'
import { useState, useMemo } from 'react'
import type { AiModel, UseCase } from '../../types/models'
import { USE_CASES } from '../../types/models'
import { ProviderBadge } from '../shared/ProviderBadge'
import { SpeedBadge } from '../shared/SpeedBadge'

type SortKey = 'name' | 'inputPricePer1m' | 'outputPricePer1m' | 'contextWindow' | 'speedTier'

interface Props {
  models: AiModel[]
  onSelectModel?: (model: AiModel) => void
}

export function ModelCompareTable({ models, onSelectModel }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('inputPricePer1m')
  const [sortAsc, setSortAsc]   = useState(true)
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterUseCase,  setFilterUseCase]  = useState<UseCase | 'all'>('all')

  const providers = useMemo(() => ['all', ...Array.from(new Set(models.map(m => m.providerId).filter(Boolean)))], [models])

  const sorted = useMemo(() => {
    let list = [...models]
    if (filterProvider !== 'all') list = list.filter(m => m.providerId === filterProvider)
    if (filterUseCase  !== 'all') list = list.filter(m => filterUseCase !== 'vision' || m.capabilities?.vision)

    list.sort((a, b) => {
      let av: number | string = a[sortKey] as number | string
      let bv: number | string = b[sortKey] as number | string
      if (sortKey === 'speedTier') {
        const order = { fast: 1, medium: 2, slow: 3 }
        av = order[a.speedTier]; bv = order[b.speedTier]
      }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [models, sortKey, sortAsc, filterProvider, filterUseCase])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const th = (label: string, key: SortKey) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none"
      onClick={() => handleSort(key)}
    >
      {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={filterProvider}
          onChange={e => setFilterProvider(e.target.value)}
        >
          {providers.map(p => (
            <option key={p} value={p}>{p === 'all' ? 'All Providers' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>

        <select
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={filterUseCase}
          onChange={e => setFilterUseCase(e.target.value as UseCase | 'all')}
        >
          <option value="all">All Use Cases</option>
          {USE_CASES.map(uc => (
            <option key={uc.id} value={uc.id}>{uc.icon} {uc.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {th('Model', 'name')}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Provider</th>
              {th('Input $/1M', 'inputPricePer1m')}
              {th('Output $/1M', 'outputPricePer1m')}
              {th('Context', 'contextWindow')}
              {th('Speed', 'speedTier')}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vision</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Batch?</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((model, i) => (
              <tr
                key={model.id}
                className={`hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer
                  ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/30'}`}
                onClick={() => onSelectModel?.(model)}
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{model.name}</td>
                <td className="px-4 py-3"><ProviderBadge provider={model.providerId} /></td>
                <td className="px-4 py-3 font-mono text-green-700 dark:text-green-400 font-semibold">
                  ${model.inputPricePer1m.toFixed(3)}
                </td>
                <td className="px-4 py-3 font-mono text-orange-700 dark:text-orange-400 font-semibold">
                  ${model.outputPricePer1m.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {model.contextWindow >= 1_000_000
                    ? `${(model.contextWindow / 1_000_000).toFixed(1)}M`
                    : `${(model.contextWindow / 1_000).toFixed(0)}K`}
                </td>
                <td className="px-4 py-3"><SpeedBadge tier={model.speedTier} /></td>
                <td className="px-4 py-3 text-center">{model.capabilities?.vision ? '✅' : '—'}</td>
                <td className="px-4 py-3 text-center">
                  {model.batchInputPer1m
                    ? <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">✓ 50% off</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">{model.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
