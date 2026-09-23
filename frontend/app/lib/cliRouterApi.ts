import type { RouteRequest, RouteResult, RouterConfig } from './cli-router/types'

/**
 * These endpoints live on the Next server, not on the Spring backend, so that
 * the Jev credential stays server-side. Paths are relative on purpose.
 */
const BASE = '/api/cli-router'

export async function fetchRouterConfig(signal?: AbortSignal): Promise<RouterConfig> {
  const res = await fetch(`${BASE}/config`, { cache: 'no-store', signal })
  if (!res.ok) throw new Error('Could not load the router configuration.')
  return res.json()
}

export async function routePrompt(
  body: RouteRequest & { strict?: boolean },
  signal?: AbortSignal,
): Promise<RouteResult> {
  const res = await fetch(`${BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error || 'Routing could not be completed. Try again.')
  if (!payload?.model || !payload?.command) throw new Error('The router returned an incomplete result. Try again.')
  return payload as RouteResult
}
