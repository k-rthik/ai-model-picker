import { NextResponse } from 'next/server'
import { route, RouteInputError } from '../../../lib/cli-router/core'
import type { RouteRequest } from '../../../lib/cli-router/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 200_000

function reject(status: number, error: string, code?: string) {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

/** Reject cross-site form posts; same-origin XHR and server-side callers pass. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser caller, or a same-origin request without the header
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reject(403, 'Use this page from its own origin.')
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return reject(415, 'Use application/json.')
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return reject(413, 'Request body is too large.')

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return reject(400, 'Invalid JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject(400, 'Invalid routing request.')
  }

  const { strict, ...input } = body as RouteRequest & { strict?: unknown }
  if (strict !== undefined && typeof strict !== 'boolean') {
    return reject(400, 'Strict must be true or false.')
  }

  try {
    const result = await route(input)
    // Strict routing refuses the balanced fallback rather than quietly using it.
    if (strict && result.source === 'fallback') {
      return reject(422, result.reason, 'STRICT_ROUTING_FAILED')
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RouteInputError) return reject(400, error.message)
    return reject(500, 'Routing could not be completed. Try again.')
  }
}
