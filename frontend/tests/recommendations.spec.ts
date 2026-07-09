import { test, expect, type Page } from '@playwright/test'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to the Recommend tab (default tab; click is belt-and-braces) */
async function openRecommendTab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /^🎯 Recommend$/ }).click()
  await expect(page.getByText("Describe what you're building")).toBeVisible({ timeout: 90_000 })
}

/** Walk through the full wizard and return the result panel */
async function getRecommendation(
  page: Page,
  useCase: string,
  qualityLabel: string,
  budget: number = 0
) {
  await openRecommendTab(page)

  // Step 0 — pick use case
  await page.getByRole('button', { name: new RegExp(useCase, 'i') }).first().click()

  // Step 1 — pick quality
  await page.getByRole('button', { name: new RegExp(qualityLabel, 'i') }).first().click()

  // Step 2 — set budget and submit
  if (budget > 0) {
    await page.locator('input[type=range]').fill(String(budget))
  }
  await page.getByRole('button', { name: /get recommendation/i }).click()

  // Wait for result
  await expect(page.getByText('Top Pick')).toBeVisible({ timeout: 15_000 })
}

// ── Suite ──────────────────────────────────────────────────────────────────

test.describe('Recommendation Wizard', () => {

  test('wizard renders all 4 steps in order', async ({ page }) => {
    await openRecommendTab(page)

    // Step indicators present
    await expect(page.getByText('Use Case')).toBeVisible()
    await expect(page.getByText('Quality')).toBeVisible()
    await expect(page.getByText('Budget')).toBeVisible()
    await expect(page.getByText('Result')).toBeVisible()
  })

  test('step 0 shows all 8 use cases', async ({ page }) => {
    await openRecommendTab(page)

    const useCases = ['Coding', 'Writing', 'Analysis', 'Summarization', 'RAG', 'Agents', 'Vision', 'Long Context']
    for (const uc of useCases) {
      await expect(page.getByText(uc).first()).toBeVisible()
    }
  })

  test('clicking use case advances to quality step', async ({ page }) => {
    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()
    await expect(page.getByText('How important is quality?')).toBeVisible()
  })

  test('step 1 shows all 5 quality tiers', async ({ page }) => {
    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()

    for (const label of ['Good enough', 'Decent', 'Good', 'High quality', 'Best in class']) {
      await expect(page.getByText(label)).toBeVisible()
    }
  })

  test('back button returns to use case step', async ({ page }) => {
    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()
    await expect(page.getByText('How important is quality?')).toBeVisible()

    await page.getByRole('button', { name: /← back/i }).click()
    await expect(page.getByText("Describe what you're building")).toBeVisible()
  })

  test('step 2 shows budget slider and defaults to no limit', async ({ page }) => {
    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()
    await page.getByRole('button', { name: /good$/i }).first().click()

    await expect(page.getByText('No limit')).toBeVisible()
    await expect(page.locator('input[type=range]')).toBeVisible()
    await expect(page.getByRole('button', { name: /get recommendation/i })).toBeVisible()
  })

})

test.describe('Recommendation Results — correctness', () => {

  test('result shows Top Pick with name, provider badge, and reasoning', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Good')

    await expect(page.getByText('Top Pick')).toBeVisible()
    // Model name should be non-empty text inside the result card
    const topPickSection = page.locator('text=Top Pick').locator('../..')
    await expect(topPickSection).not.toContainText('undefined')
    await expect(topPickSection).not.toContainText('null')
  })

  test('result shows score within 0–10 range', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Good')

    const reasoning = await page.getByText(/scores \d+\.\d+\/10/).textContent()
    expect(reasoning).toBeTruthy()

    const match = reasoning!.match(/scores (\d+\.\d+)\/10/)
    expect(match).toBeTruthy()
    const score = parseFloat(match![1])
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(10)
  })

  test('result price is non-negative', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Good')

    // All price displays in result card
    const priceTexts = await page.locator('text=/\\$[\\d.]+\\/1M/').allTextContents()
    expect(priceTexts.length).toBeGreaterThan(0)

    for (const text of priceTexts) {
      const match = text.match(/\$([\d.]+)\/1M/)
      if (match) {
        const price = parseFloat(match[1])
        expect(price).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('result reasoning does not contain placeholder values', async ({ page }) => {
    await getRecommendation(page, 'Writing', 'Decent')

    const reasoning = page.locator('p').filter({ hasText: /scores.*\/10.*\/1M/ })
    const text = await reasoning.textContent()
    expect(text).not.toContain('-1000000')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
    expect(text).not.toContain('NaN')
  })

  test('runner up is shown when available', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Good')

    // Runner up section may or may not appear — if it does, validate it
    const runnerUp = page.getByText('Runner Up')
    const isVisible = await runnerUp.isVisible()
    if (isVisible) {
      const runnerUpSection = page.locator('text=Runner Up').locator('../..')
      await expect(runnerUpSection).not.toContainText('undefined')
      await expect(runnerUpSection).not.toContainText('null')

      const priceText = await runnerUpSection.locator('text=/\\$.*\/1M/').textContent()
      const match = priceText?.match(/\$([\d.]+)/)
      if (match) {
        expect(parseFloat(match[1])).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('context window displays as K or M format', async ({ page }) => {
    await getRecommendation(page, 'Analysis', 'High quality')

    // Should show something like "128K" or "2.0M", never raw number like "128000"
    const contextCell = page.locator('text=Context').locator('../..')
    const text = await contextCell.textContent()
    expect(text).toMatch(/\d+(\.\d+)?[KM]/)
  })

  test('speed badge shows fast / medium / slow', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Best in class')

    const speedCell = page.locator('text=Speed').locator('../..')
    const text = await speedCell.textContent()
    expect(text?.toLowerCase()).toMatch(/fast|medium|slow/)
  })

})

test.describe('Recommendation Results — all use cases', () => {

  const useCases = ['Coding', 'Writing', 'Analysis', 'Summarization', 'Agents', 'Vision']

  for (const uc of useCases) {
    test(`${uc} use case returns a valid top pick`, async ({ page }) => {
      await getRecommendation(page, uc, 'Good')

      await expect(page.getByText('Top Pick')).toBeVisible()

      const reasoning = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
      expect(reasoning).toBeTruthy()
      expect(reasoning).not.toContain('-1000000')

      const scoreMatch = reasoning!.match(/scores (\d+\.\d+)\/10/)
      expect(scoreMatch).toBeTruthy()
      expect(parseFloat(scoreMatch![1])).toBeGreaterThanOrEqual(0)
      expect(parseFloat(scoreMatch![1])).toBeLessThanOrEqual(10)
    })
  }

})

test.describe('Recommendation Results — budget constraint', () => {

  test('result price respects budget cap', async ({ page }) => {
    const budget = 5  // $5/1M
    await getRecommendation(page, 'Coding', 'Good', budget)

    const reasoning = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
    const priceMatch = reasoning!.match(/at \$([\d.]+)\/1M/)
    if (priceMatch) {
      const price = parseFloat(priceMatch[1])
      // Allow small float tolerance
      expect(price).toBeLessThanOrEqual(budget + 0.01)
    }
  })

  test('no-limit budget returns a result', async ({ page }) => {
    await getRecommendation(page, 'Agents', 'Best in class', 0)
    await expect(page.getByText('Top Pick')).toBeVisible()
  })

  test('tight budget does not produce negative price', async ({ page }) => {
    await getRecommendation(page, 'Writing', 'Good enough', 1)

    const allPrices = await page.locator('text=/\\$[\\d.]+\\/1M/').allTextContents()
    for (const t of allPrices) {
      const m = t.match(/\$([\d.]+)\/1M/)
      if (m) expect(parseFloat(m[1])).toBeGreaterThanOrEqual(0)
    }
  })

})

test.describe('Recommendation Results — quality tiers', () => {

  test('quality tier 1 (Good enough) returns a result', async ({ page }) => {
    await getRecommendation(page, 'Summarization', 'Good enough')
    await expect(page.getByText('Top Pick')).toBeVisible()
  })

  test('quality tier 5 (Best in class) returns a result', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Best in class')
    await expect(page.getByText('Top Pick')).toBeVisible()
  })

  test('higher quality tier tends to have higher or equal price', async ({ page }) => {
    // Get price at quality 1
    await getRecommendation(page, 'Coding', 'Good enough')
    const cheapText = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
    const cheapMatch = cheapText!.match(/at \$([\d.]+)\/1M/)
    const cheapPrice = cheapMatch ? parseFloat(cheapMatch[1]) : 0

    // Get price at quality 5
    await getRecommendation(page, 'Coding', 'Best in class')
    const premiumText = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
    const premiumMatch = premiumText!.match(/at \$([\d.]+)\/1M/)
    const premiumPrice = premiumMatch ? parseFloat(premiumMatch[1]) : 0

    // Best-in-class should not be cheaper than good-enough (soft check)
    expect(premiumPrice).toBeGreaterThanOrEqual(cheapPrice - 0.1)
  })

})

test.describe('Wizard UX', () => {

  test('Start Over resets to use case step', async ({ page }) => {
    await getRecommendation(page, 'Coding', 'Good')

    await page.getByRole('button', { name: /start over/i }).click()
    await expect(page.getByText("Describe what you're building")).toBeVisible()
  })

  test('error state shown when backend is unavailable', async ({ page }) => {
    // Intercept API call and return 500
    await page.route('**/api/recommend**', route => route.fulfill({ status: 500, body: 'error' }))

    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()
    await page.getByRole('button', { name: /good$/i }).first().click()
    await page.getByRole('button', { name: /get recommendation/i }).click()

    await expect(page.locator('text=/API error|Failed to get/i')).toBeVisible({ timeout: 10_000 })
  })

  test('loading state shown while fetching', async ({ page }) => {
    // Delay the API response
    await page.route('**/api/recommend**', async route => {
      await new Promise(r => setTimeout(r, 300))
      await route.continue()
    })

    await openRecommendTab(page)
    await page.getByRole('button', { name: /coding/i }).first().click()
    await page.getByRole('button', { name: /good$/i }).first().click()
    await page.getByRole('button', { name: /get recommendation/i }).click()

    await expect(page.getByText('Finding best model...')).toBeVisible()
  })

})
