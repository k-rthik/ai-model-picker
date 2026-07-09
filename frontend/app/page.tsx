'use client'
import { useState, useEffect } from 'react'
import type { AiModel } from './types/models'
import { fetchModels, triggerScrape, triggerRecompute } from './lib/api'
import { ModelCompareTable } from './components/compare/ModelCompareTable'
import { CostCalculator } from './components/calculator/CostCalculator'
import { RecommendationWizard } from './components/recommend/RecommendationWizard'
import { ThemeToggle } from './components/shared/ThemeToggle'

type Tab = 'compare' | 'cost' | 'recommend'

export default function Home() {
  const [tab,      setTab]      = useState<Tab>('recommend')
  const [models,   setModels]   = useState<AiModel[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg,setScrapeMsg]= useState<string | null>(null)

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleScrape = async () => {
    setScraping(true)
    setScrapeMsg(null)
    try {
      await triggerScrape()
      await triggerRecompute()
      setScrapeMsg('Scrape complete. Reloading...')
      const fresh = await fetchModels()
      setModels(fresh)
      setScrapeMsg('Data refreshed.')
    } catch (e: unknown) {
      setScrapeMsg(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'recommend', label: 'Recommend', icon: '🎯' },
    { id: 'compare',   label: 'Compare',   icon: '📊' },
    { id: 'cost',      label: 'Cost Calc', icon: '💰' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">AI Model Picker</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Benchmarks · Cost · Recommendations</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {scrapeMsg && (
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{scrapeMsg}</span>
              )}
              <button
                onClick={handleScrape}
                disabled={scraping}
                className="flex items-center gap-2 text-sm bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <span className={scraping ? 'animate-spin' : ''}>🔄</span>
                {scraping ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats bar */}
        {!loading && models.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Models tracked"  value={String(models.length)} />
            <StatCard label="Cheapest input"  value={`$${Math.min(...models.map(m => m.inputPricePer1m)).toFixed(3)}/1M`} />
            <StatCard label="Largest context" value={`${(Math.max(...models.map(m => m.contextWindow)) / 1_000_000).toFixed(1)}M tokens`} />
            <StatCard label="Providers"       value={String(new Set(models.map(m => m.providerId)).size)} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 mb-6 w-fit shadow-sm">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <div className="text-center space-y-2">
              <div className="text-3xl animate-spin">⚙️</div>
              <div>Loading model data...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400 text-sm">
            <strong>Backend not reachable:</strong> {error}
            <br />
            <span className="text-xs text-red-500 mt-1 block">
              Start the Spring Boot backend: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">./gradlew bootRun</code> from the <code>backend/</code> directory.
            </span>
          </div>
        )}

        {!loading && !error && (
          <div>
            {tab === 'compare'   && <ModelCompareTable models={models} />}
            {tab === 'cost'      && <CostCalculator />}
            {tab === 'recommend' && <RecommendationWizard />}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}
