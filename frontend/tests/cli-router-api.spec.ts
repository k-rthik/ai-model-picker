import { test, expect } from '@playwright/test'

// ── /api/cli-router/config ──────────────────────────────────────────────────

test.describe('GET /api/cli-router/config', () => {

  test('returns catalog, pricing date, thresholds, and whether Jev is configured', async ({ request }) => {
    const res = await request.get('/api/cli-router/config')
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toContain('no-store')

    const body = await res.json()
    expect(typeof body.jevConfigured).toBe('boolean')
    expect(typeof body.pricingDate).toBe('string')
    expect(body.thresholds).toEqual({ confidence: 0.65, margin: 0.15 })

    expect(Array.isArray(body.catalog.codex)).toBe(true)
    expect(Array.isArray(body.catalog.claude)).toBe(true)
    for (const tier of ['quick', 'balanced', 'strong', 'frontier']) {
      expect(body.catalog.codex.some((row: { tier: string }) => row.tier === tier)).toBe(true)
      expect(body.catalog.claude.some((row: { tier: string }) => row.tier === tier)).toBe(true)
    }
  })

  test('never leaks the Jev API key', async ({ request }) => {
    const res = await request.get('/api/cli-router/config')
    const text = await res.text()
    expect(text).not.toMatch(/jev_api_key|typesafe_api_key/i)
  })

})

// ── POST /api/cli-router/route ──────────────────────────────────────────────

test.describe('POST /api/cli-router/route', () => {

  test('routes a valid Claude prompt to the balanced tier without a Jev key', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Fix a null pointer exception in the login handler', agent: 'claude' },
    })
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toContain('no-store')

    const body = await res.json()
    expect(body.agent).toBe('claude')
    expect(body.tier).toBe('balanced')
    expect(body.source).toBe('fallback')
    expect(typeof body.model).toBe('string')
    expect(typeof body.command).toBe('string')
    expect(body.command).toContain(body.model)
    expect(body.costs.rows).toHaveLength(4)
  })

  test('routes a valid Codex prompt and returns a codex-shaped command', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Add a dark mode toggle', agent: 'codex' },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.agent).toBe('codex')
    expect(body.command.startsWith('codex ')).toBe(true)
  })

  test('defaults agent to codex and cost priority to balanced when omitted', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Explain this function' },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.agent).toBe('codex')
    expect(body.costPriority).toBe('balanced')
  })

  test('rejects a non-JSON content type', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      headers: { 'content-type': 'text/plain' },
      data: 'prompt=hi',
    })
    expect(res.status()).toBe(415)
  })

  test('rejects malformed JSON', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      headers: { 'content-type': 'application/json' },
      data: '{not valid json',
    })
    expect(res.status()).toBe(400)
  })

  test('rejects a JSON array body', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify([1, 2, 3]),
    })
    expect(res.status()).toBe(400)
  })

  test('rejects an empty prompt', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: '   ', agent: 'claude' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/prompt/i)
  })

  test('rejects an unknown agent', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Do something', agent: 'gpt-cli' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects an unknown cost priority', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Do something', agent: 'claude', costPriority: 'fastest' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects a native argument that would override the routed model', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Do something', agent: 'claude', nativeArgs: ['--model', 'gpt-4'] },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/overrides the routed model/i)
  })

  test('rejects strict must be a boolean', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Do something', agent: 'claude', strict: 'yes' },
    })
    expect(res.status()).toBe(400)
  })

  test('strict mode refuses the balanced fallback and returns 422', async ({ request }) => {
    // No Jev key is configured in this environment, so routing always falls
    // back — strict must refuse rather than silently return balanced.
    const res = await request.post('/api/cli-router/route', {
      data: { prompt: 'Do something', agent: 'claude', strict: true },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('STRICT_ROUTING_FAILED')
  })

  test('rejects a cross-site request by Origin header', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      headers: { origin: 'https://evil.example.com' },
      data: { prompt: 'Do something', agent: 'claude' },
    })
    expect(res.status()).toBe(403)
  })

  test('rejects an oversized request body', async ({ request }) => {
    const res = await request.post('/api/cli-router/route', {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ prompt: 'x'.repeat(250_000), agent: 'claude' }),
    })
    expect(res.status()).toBe(413)
  })

})
