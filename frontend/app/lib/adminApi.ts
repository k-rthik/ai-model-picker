import type { AiModel, Provider } from '../types/models'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  // Some endpoints return plain text, some JSON
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text as unknown as T }
}

async function del(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.text()
}

// Ingestion
export const runIngest       = ()           => post<unknown>('/admin/ingest')
export const runIngestSource = (src: string)=> post<unknown>(`/admin/ingest/${src}`)
export const fetchIngestionLogs = ()        => get<IngestionLogEntry[]>('/admin/ingestion-logs')

// Benchmarks
export const runScrape    = ()              => post<string>('/admin/scrape')
export const runRecompute = ()              => post<string>('/admin/recompute')
export const fetchScrapeLogs = ()           => get<ScrapeLogEntry[]>('/admin/scrape-logs')

// Models
export const fetchAllModels = (activeOnly = false) =>
  get<AiModel[]>(`/admin/models?activeOnly=${activeOnly}`)
export const deactivateModel = (id: string) => del(`/admin/models/${id}`)
export const activateModel   = (id: string) => post<string>(`/admin/models/${id}/activate`)

// Providers
export const fetchAdminProviders = () => get<Provider[]>('/admin/providers')
export const deactivateProvider  = (id: string) => del(`/admin/providers/${id}`)

export interface IngestionLogEntry {
  id: number
  source: string
  status: string
  modelsAdded: number
  modelsUpdated: number
  modelsSkipped: number
  errorMessage: string | null
  ranAt: string
}

export interface ScrapeLogEntry {
  id: number
  source: string
  status: string
  recordsUpserted: number
  errorMessage: string | null
  ranAt: string
}
