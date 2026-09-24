import { test, expect, type Page } from '@playwright/test'
import type { NlRecommendation } from '../app/types/models'

// ── Helpers ────────────────────────────────────────────────────────────────

async function openCliRouterTab(page: Page) {
  await page.goto('/cli-router')
  await expect(page.getByText('Describe the task. Get the CLI command and the model.')).toBeVisible()
  // Wait for the config fetch to settle so the Route button isn't stuck disabled.
  await expect(page.locator('#cli-prompt')).toBeEnabled()
}

async function routePrompt(page: Page, prompt: string) {
  await openCliRouterTab(page)
  await page.locator('#cli-prompt').fill(prompt)
  await page.getByRole('button', { name: /route my prompt/i }).click()
}

function mockCatalogPick(overrides: Partial<NlRecommendation> = {}): NlRecommendation {
  return {
    useCase: 'coding',
    quality: 3,
    maxBudget: 0,
    persona: null,
    personaLabel: null,
    excludeChina: false,
    result: {
      topPick: {
        id: 'mock-provider-mock-model',
        name: 'Mock Model 9000',
        providerId: 'mock-provider',
        pricingModel: 'per_token',
        contextWindow: 128_000,
        maxOutputTokens: 8192,
        speedTier: 'fast',
        capabilities: {},
        inputPricePer1m: 1.5,
        outputPricePer1m: 6,
        batchInputPer1m: null,
        batchOutputPer1m: null,
        requestPrice: null,
        source: 'test',
        externalId: null,
        notes: null,
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      topScore: 9.2,
      runnerUp: null,
      runnerUpScore: 0,
      reasoning: 'Mock Model 9000 scores 9.2/10 for coding at $1.50/1M input and $6.00/1M output tokens.',
    },
    ...overrides,
  }
}

async function mockCatalog(page: Page, body: NlRecommendation) {
  await page.route('**/api/recommend/nl**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
}

// ── Layout ───────────────────────────────────────────────────────────────

test.describe('CLI Router — layout', () => {

  test('renders intro copy and a disabled Route button with an empty prompt', async ({ page }) => {
    await openCliRouterTab(page)
    await expect(page.getByRole('button', { name: /route my prompt/i })).toBeDisabled()
  })

  test('warns that routing falls back to balanced when no Jev key is configured', async ({ page }) => {
    await openCliRouterTab(page)
    await expect(page.getByText(/no routing key is configured on this server/i)).toBeVisible()
  })

  test('defaults to Claude Code and Balance both', async ({ page }) => {
    await openCliRouterTab(page)
    await expect(page.getByRole('button', { name: /claude code/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /codex cli/i })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: /balance both/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('working directory settings are collapsed until expanded', async ({ page }) => {
    await openCliRouterTab(page)
    await expect(page.locator('#cli-cwd')).toBeHidden()

    await page.getByText('Working directory & estimate settings').click()
    await expect(page.locator('#cli-cwd')).toBeVisible()
    await expect(page.locator('#cli-output')).toBeVisible()
    await expect(page.getByText('Strict routing.')).toBeVisible()
  })

  test('typing a prompt enables the Route button', async ({ page }) => {
    await openCliRouterTab(page)
    await page.locator('#cli-prompt').fill('Add a health-check endpoint')
    await expect(page.getByRole('button', { name: /route my prompt/i })).toBeEnabled()
  })

})

// ── Routing flow ─────────────────────────────────────────────────────────

test.describe('CLI Router — routing flow', () => {

  test('routes a prompt to the balanced fallback tier with a copyable command', async ({ page }) => {
    await mockCatalog(page, mockCatalogPick())
    await routePrompt(page, 'Fix a null pointer exception in the login handler')

    // Tier/model labels are styled uppercase via CSS; the DOM text itself stays lowercase,
    // and "balanced" also appears once per row in the cost table below, so scope narrowly.
    await expect(page.getByText('balanced', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('claude-sonnet-5', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Balanced fallback', { exact: true })).toBeVisible()
    await expect(page.getByText(/jev api key is not configured/i)).toBeVisible()

    const command = page.locator('pre code')
    await expect(command).toContainText('claude')
    await expect(command).toContainText('--model')
    await expect(command).toContainText('claude-sonnet-5')

    // Cost table has all four tiers, one row each.
    const table = page.locator('table')
    for (const tier of ['quick', 'balanced', 'strong', 'frontier']) {
      await expect(table.getByText(tier, { exact: true })).toBeVisible()
    }
  })

  test('switching to Codex CLI produces a codex-shaped command', async ({ page }) => {
    await mockCatalog(page, mockCatalogPick())
    await openCliRouterTab(page)
    await page.locator('#cli-prompt').fill('Add a dark mode toggle')
    await page.getByRole('button', { name: /codex cli/i }).click()
    await page.getByRole('button', { name: /route my prompt/i }).click()

    const command = page.locator('pre code')
    await expect(command).toContainText('codex')
    await expect(command).not.toContainText('claude ')
  })

  test('cmd/ctrl+Enter submits once the router is ready', async ({ page }) => {
    await mockCatalog(page, mockCatalogPick())
    await openCliRouterTab(page)
    await page.locator('#cli-prompt').fill('Refactor the payment retry loop')
    await page.locator('#cli-prompt').press('Control+Enter')

    await expect(page.getByText('Balanced fallback', { exact: true })).toBeVisible()
  })

  test('shows the model picked from the whole catalog alongside the CLI answer', async ({ page }) => {
    await mockCatalog(page, mockCatalogPick())
    await routePrompt(page, 'Summarize this PDF for a client')

    // "Mock Model 9000" also appears as a substring of the reasoning sentence below it.
    await expect(page.getByText('Mock Model 9000', { exact: true })).toBeVisible()
    await expect(page.getByText('mock-provider-mock-model')).toBeVisible()
    await expect(page.getByText('$1.5/1M')).toBeVisible()
    await expect(page.getByText(/parsed by the site's own rule-based reader/i)).toBeVisible()
  })

  test('a runner-up is shown when the catalog response includes one', async ({ page }) => {
    const withRunnerUp = mockCatalogPick()
    withRunnerUp.result.runnerUp = {
      ...withRunnerUp.result.topPick!,
      id: 'mock-provider-runner-up',
      name: 'Mock Runner Up',
      inputPricePer1m: 0.5,
      speedTier: 'medium',
    }
    await mockCatalog(page, withRunnerUp)
    await routePrompt(page, 'Draft release notes')

    await expect(page.getByText('Runner-up')).toBeVisible()
    await expect(page.getByText('Mock Runner Up')).toBeVisible()
  })

  test('flags Chinese providers with a data-residency notice', async ({ page }) => {
    const chinaPick = mockCatalogPick()
    chinaPick.result.topPick!.providerId = 'deepseek'
    await mockCatalog(page, chinaPick)
    await routePrompt(page, 'Write a changelog entry')

    await expect(page.getByText(/chinese provider/i)).toBeVisible()
  })

  test('the catalog card degrades gracefully when its backend is unreachable', async ({ page }) => {
    await page.route('**/api/recommend/nl**', route => route.fulfill({ status: 503, body: 'unavailable' }))
    await routePrompt(page, 'Investigate a flaky test')

    // The CLI answer is unaffected by the catalog card's failure.
    await expect(page.getByText('Balanced fallback', { exact: true })).toBeVisible()
    await expect(page.getByText(/model catalog is not reachable right now/i)).toBeVisible()
  })

  test('an empty prompt submitted via keyboard shows an inline error instead of routing', async ({ page }) => {
    await openCliRouterTab(page)
    await page.locator('#cli-prompt').press('Control+Enter')
    await expect(page.getByText('Add a prompt so the router can choose a model.')).toBeVisible()
  })

  test('a relative working directory is rejected and reopens the advanced section', async ({ page }) => {
    await openCliRouterTab(page)
    await page.getByText('Working directory & estimate settings').click()
    await page.locator('#cli-cwd').fill('relative/path')
    // Collapse the section again before submitting, to prove the app reopens it.
    await page.getByText('Working directory & estimate settings').click()
    await expect(page.locator('#cli-cwd')).toBeHidden()

    await page.locator('#cli-prompt').fill('Do something')
    await page.getByRole('button', { name: /route my prompt/i }).click()

    // This is the client-side check in submit(), not the API's own validation message.
    await expect(page.getByText(/use an absolute directory path/i)).toBeVisible()
    await expect(page.locator('#cli-cwd')).toBeVisible()
  })

  test('editing the prompt after a result clears the stale answer', async ({ page }) => {
    await mockCatalog(page, mockCatalogPick())
    await routePrompt(page, 'Add input validation to the signup form')
    await expect(page.getByText('Balanced fallback', { exact: true })).toBeVisible()

    await page.locator('#cli-prompt').type(' — actually, add rate limiting instead')
    await expect(page.getByText('Balanced fallback', { exact: true })).toHaveCount(0)
  })

  test('copy command button copies the command to the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions API is Chromium-only in Playwright.')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await mockCatalog(page, mockCatalogPick())
    await routePrompt(page, 'Add a retry with backoff')
    await expect(page.getByText('Balanced fallback', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /copy command/i }).click()
    await expect(page.getByRole('button', { name: /copied/i })).toBeVisible()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    const shown = await page.locator('pre code').textContent()
    expect(copied).toBe(shown)
  })

})
