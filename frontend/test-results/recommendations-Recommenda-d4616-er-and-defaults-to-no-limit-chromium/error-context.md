# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recommendations.spec.ts >> Recommendation Wizard >> step 2 shows budget slider and defaults to no limit
- Location: tests/recommendations.spec.ts:84:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /good$/i }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e5]:
        - link "🤖 AI Model Picker Benchmarks · Cost · Recommendations" [ref=e6] [cursor=pointer]:
          - /url: /
          - generic [ref=e7]: 🤖
          - generic [ref=e8]:
            - generic [ref=e9]: AI Model Picker
            - generic [ref=e10]: Benchmarks · Cost · Recommendations
        - button "Toggle dark mode" [ref=e12]: 🌙
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Models tracked
          - generic [ref=e17]: "406"
        - generic [ref=e18]:
          - generic [ref=e19]: Cheapest input
          - generic [ref=e20]: $0.000/1M
        - generic [ref=e21]:
          - generic [ref=e22]: Largest context
          - generic [ref=e23]: 10.0M tokens
        - generic [ref=e24]:
          - generic [ref=e25]: Providers
          - generic [ref=e26]: "60"
      - generic [ref=e27]:
        - button "🎯 Recommend" [ref=e28]:
          - generic [ref=e29]: 🎯
          - text: Recommend
        - button "📊 Compare" [ref=e30]:
          - generic [ref=e31]: 📊
          - text: Compare
        - button "💰 Cost Calc" [ref=e32]:
          - generic [ref=e33]: 💰
          - text: Cost Calc
      - generic [ref=e35]:
        - generic [ref=e36]:
          - generic [ref=e37]:
            - generic [ref=e38]: "1"
            - generic [ref=e39]: Use Case
          - generic [ref=e41]:
            - generic [ref=e42]: "2"
            - generic [ref=e43]: Quality
          - generic [ref=e45]:
            - generic [ref=e46]: "3"
            - generic [ref=e47]: Budget
          - generic [ref=e49]:
            - generic [ref=e50]: "4"
            - generic [ref=e51]: Result
          - button "🏠 Start Over" [ref=e52]
        - generic [ref=e53]:
          - heading "How important is quality?" [level=3] [ref=e54]
          - generic [ref=e55]:
            - button "1 Good enough Fast and cheap, minor errors acceptable" [ref=e56]:
              - generic [ref=e57]: "1"
              - generic [ref=e58]:
                - generic [ref=e59]: Good enough
                - generic [ref=e60]: Fast and cheap, minor errors acceptable
            - button "2 Decent Mostly accurate, occasional mistakes ok" [ref=e61]:
              - generic [ref=e62]: "2"
              - generic [ref=e63]:
                - generic [ref=e64]: Decent
                - generic [ref=e65]: Mostly accurate, occasional mistakes ok
            - button "3 Good Reliable quality for production use" [ref=e66]:
              - generic [ref=e67]: "3"
              - generic [ref=e68]:
                - generic [ref=e69]: Good
                - generic [ref=e70]: Reliable quality for production use
            - button "4 High quality Near-perfect, minimal hallucination" [ref=e71]:
              - generic [ref=e72]: "4"
              - generic [ref=e73]:
                - generic [ref=e74]: High quality
                - generic [ref=e75]: Near-perfect, minimal hallucination
            - button "5 Best in class Top model regardless of cost" [ref=e76]:
              - generic [ref=e77]: "5"
              - generic [ref=e78]:
                - generic [ref=e79]: Best in class
                - generic [ref=e80]: Top model regardless of cost
          - button "← Back" [ref=e81]
  - alert [ref=e82]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test'
  2   | 
  3   | // ── Helpers ────────────────────────────────────────────────────────────────
  4   | 
  5   | /** Navigate to the Recommend tab (default tab; click is belt-and-braces) */
  6   | async function openRecommendTab(page: Page) {
  7   |   await page.goto('/')
  8   |   await page.getByRole('button', { name: /^🎯 Recommend$/ }).click()
  9   |   await expect(page.getByText("Describe what you're building")).toBeVisible({ timeout: 90_000 })
  10  | }
  11  | 
  12  | /** Walk through the full wizard and return the result panel */
  13  | async function getRecommendation(
  14  |   page: Page,
  15  |   useCase: string,
  16  |   qualityLabel: string,
  17  |   budget: number = 0
  18  | ) {
  19  |   await openRecommendTab(page)
  20  | 
  21  |   // Step 0 — pick use case
  22  |   await page.getByRole('button', { name: new RegExp(useCase, 'i') }).first().click()
  23  | 
  24  |   // Step 1 — pick quality
  25  |   await page.getByRole('button', { name: new RegExp(qualityLabel, 'i') }).first().click()
  26  | 
  27  |   // Step 2 — set budget and submit
  28  |   if (budget > 0) {
  29  |     await page.locator('input[type=range]').fill(String(budget))
  30  |   }
  31  |   await page.getByRole('button', { name: /get recommendation/i }).click()
  32  | 
  33  |   // Wait for result
  34  |   await expect(page.getByText('Top Pick')).toBeVisible({ timeout: 15_000 })
  35  | }
  36  | 
  37  | // ── Suite ──────────────────────────────────────────────────────────────────
  38  | 
  39  | test.describe('Recommendation Wizard', () => {
  40  | 
  41  |   test('wizard renders all 4 steps in order', async ({ page }) => {
  42  |     await openRecommendTab(page)
  43  | 
  44  |     // Step indicators present
  45  |     await expect(page.getByText('Use Case')).toBeVisible()
  46  |     await expect(page.getByText('Quality')).toBeVisible()
  47  |     await expect(page.getByText('Budget')).toBeVisible()
  48  |     await expect(page.getByText('Result')).toBeVisible()
  49  |   })
  50  | 
  51  |   test('step 0 shows all 8 use cases', async ({ page }) => {
  52  |     await openRecommendTab(page)
  53  | 
  54  |     const useCases = ['Coding', 'Writing', 'Analysis', 'Summarization', 'RAG', 'Agents', 'Vision', 'Long Context']
  55  |     for (const uc of useCases) {
  56  |       await expect(page.getByText(uc).first()).toBeVisible()
  57  |     }
  58  |   })
  59  | 
  60  |   test('clicking use case advances to quality step', async ({ page }) => {
  61  |     await openRecommendTab(page)
  62  |     await page.getByRole('button', { name: /coding/i }).first().click()
  63  |     await expect(page.getByText('How important is quality?')).toBeVisible()
  64  |   })
  65  | 
  66  |   test('step 1 shows all 5 quality tiers', async ({ page }) => {
  67  |     await openRecommendTab(page)
  68  |     await page.getByRole('button', { name: /coding/i }).first().click()
  69  | 
  70  |     for (const label of ['Good enough', 'Decent', 'Good', 'High quality', 'Best in class']) {
  71  |       await expect(page.getByText(label)).toBeVisible()
  72  |     }
  73  |   })
  74  | 
  75  |   test('back button returns to use case step', async ({ page }) => {
  76  |     await openRecommendTab(page)
  77  |     await page.getByRole('button', { name: /coding/i }).first().click()
  78  |     await expect(page.getByText('How important is quality?')).toBeVisible()
  79  | 
  80  |     await page.getByRole('button', { name: /← back/i }).click()
  81  |     await expect(page.getByText("Describe what you're building")).toBeVisible()
  82  |   })
  83  | 
  84  |   test('step 2 shows budget slider and defaults to no limit', async ({ page }) => {
  85  |     await openRecommendTab(page)
  86  |     await page.getByRole('button', { name: /coding/i }).first().click()
> 87  |     await page.getByRole('button', { name: /good$/i }).first().click()
      |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  88  | 
  89  |     await expect(page.getByText('No limit')).toBeVisible()
  90  |     await expect(page.locator('input[type=range]')).toBeVisible()
  91  |     await expect(page.getByRole('button', { name: /get recommendation/i })).toBeVisible()
  92  |   })
  93  | 
  94  | })
  95  | 
  96  | test.describe('Recommendation Results — correctness', () => {
  97  | 
  98  |   test('result shows Top Pick with name, provider badge, and reasoning', async ({ page }) => {
  99  |     await getRecommendation(page, 'Coding', 'Good')
  100 | 
  101 |     await expect(page.getByText('Top Pick')).toBeVisible()
  102 |     // Model name should be non-empty text inside the result card
  103 |     const topPickSection = page.locator('text=Top Pick').locator('../..')
  104 |     await expect(topPickSection).not.toContainText('undefined')
  105 |     await expect(topPickSection).not.toContainText('null')
  106 |   })
  107 | 
  108 |   test('result shows score within 0–10 range', async ({ page }) => {
  109 |     await getRecommendation(page, 'Coding', 'Good')
  110 | 
  111 |     const reasoning = await page.getByText(/scores \d+\.\d+\/10/).textContent()
  112 |     expect(reasoning).toBeTruthy()
  113 | 
  114 |     const match = reasoning!.match(/scores (\d+\.\d+)\/10/)
  115 |     expect(match).toBeTruthy()
  116 |     const score = parseFloat(match![1])
  117 |     expect(score).toBeGreaterThanOrEqual(0)
  118 |     expect(score).toBeLessThanOrEqual(10)
  119 |   })
  120 | 
  121 |   test('result price is non-negative', async ({ page }) => {
  122 |     await getRecommendation(page, 'Coding', 'Good')
  123 | 
  124 |     // All price displays in result card
  125 |     const priceTexts = await page.locator('text=/\\$[\\d.]+\\/1M/').allTextContents()
  126 |     expect(priceTexts.length).toBeGreaterThan(0)
  127 | 
  128 |     for (const text of priceTexts) {
  129 |       const match = text.match(/\$([\d.]+)\/1M/)
  130 |       if (match) {
  131 |         const price = parseFloat(match[1])
  132 |         expect(price).toBeGreaterThanOrEqual(0)
  133 |       }
  134 |     }
  135 |   })
  136 | 
  137 |   test('result reasoning does not contain placeholder values', async ({ page }) => {
  138 |     await getRecommendation(page, 'Writing', 'Decent')
  139 | 
  140 |     const reasoning = page.locator('p').filter({ hasText: /scores.*\/10.*\/1M/ })
  141 |     const text = await reasoning.textContent()
  142 |     expect(text).not.toContain('-1000000')
  143 |     expect(text).not.toContain('undefined')
  144 |     expect(text).not.toContain('null')
  145 |     expect(text).not.toContain('NaN')
  146 |   })
  147 | 
  148 |   test('runner up is shown when available', async ({ page }) => {
  149 |     await getRecommendation(page, 'Coding', 'Good')
  150 | 
  151 |     // Runner up section may or may not appear — if it does, validate it
  152 |     const runnerUp = page.getByText('Runner Up')
  153 |     const isVisible = await runnerUp.isVisible()
  154 |     if (isVisible) {
  155 |       const runnerUpSection = page.locator('text=Runner Up').locator('../..')
  156 |       await expect(runnerUpSection).not.toContainText('undefined')
  157 |       await expect(runnerUpSection).not.toContainText('null')
  158 | 
  159 |       const priceText = await runnerUpSection.locator('text=/\\$.*\/1M/').textContent()
  160 |       const match = priceText?.match(/\$([\d.]+)/)
  161 |       if (match) {
  162 |         expect(parseFloat(match[1])).toBeGreaterThanOrEqual(0)
  163 |       }
  164 |     }
  165 |   })
  166 | 
  167 |   test('context window displays as K or M format', async ({ page }) => {
  168 |     await getRecommendation(page, 'Analysis', 'High quality')
  169 | 
  170 |     // Should show something like "128K" or "2.0M", never raw number like "128000"
  171 |     const contextCell = page.locator('text=Context').locator('../..')
  172 |     const text = await contextCell.textContent()
  173 |     expect(text).toMatch(/\d+(\.\d+)?[KM]/)
  174 |   })
  175 | 
  176 |   test('speed badge shows fast / medium / slow', async ({ page }) => {
  177 |     await getRecommendation(page, 'Coding', 'Best in class')
  178 | 
  179 |     const speedCell = page.locator('text=Speed').locator('../..')
  180 |     const text = await speedCell.textContent()
  181 |     expect(text?.toLowerCase()).toMatch(/fast|medium|slow/)
  182 |   })
  183 | 
  184 | })
  185 | 
  186 | test.describe('Recommendation Results — all use cases', () => {
  187 | 
```