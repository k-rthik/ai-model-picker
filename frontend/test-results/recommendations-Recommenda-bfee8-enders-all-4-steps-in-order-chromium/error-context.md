# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recommendations.spec.ts >> Recommendation Wizard >> wizard renders all 4 steps in order
- Location: tests/recommendations.spec.ts:41:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Use Case')
Expected: visible
Error: strict mode violation: getByText('Use Case') resolved to 2 elements:
    1) <span class="text-sm text-gray-900 dark:text-gray-100 font-medium">Use Case</span> aka getByText('Use Case', { exact: true })
    2) <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-4">Or choose your use case manually</h3> aka getByRole('heading', { name: 'Or choose your use case' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Use Case')

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - button "🎯 Recommend" [active] [ref=e28]:
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
        - generic [ref=e52]:
          - generic [ref=e53]:
            - heading "Describe what you're building" [level=3] [ref=e54]
            - generic [ref=e55]:
              - textbox "e.g. \"cheap chatbot over our docs for a weekend project\"" [ref=e56]
              - button "Recommend →" [disabled] [ref=e57]
          - generic [ref=e58]:
            - heading "Or pick a preset persona" [level=3] [ref=e59]
            - paragraph [ref=e60]: Presets answer the quality and budget questions for you.
            - generic [ref=e61]:
              - button "👨‍💻 Solo hacker Cheapest API that works" [ref=e62]:
                - generic [ref=e63]: 👨‍💻
                - generic [ref=e64]: Solo hacker
                - generic [ref=e65]: Cheapest API that works
              - button "🚀 Startup MVP Optimize for shipping speed" [ref=e66]:
                - generic [ref=e67]: 🚀
                - generic [ref=e68]: Startup MVP
                - generic [ref=e69]: Optimize for shipping speed
              - button "🏢 Enterprise Compliance and privacy" [ref=e70]:
                - generic [ref=e71]: 🏢
                - generic [ref=e72]: Enterprise
                - generic [ref=e73]: Compliance and privacy
              - button "🔬 Researcher Maximum reasoning power" [ref=e74]:
                - generic [ref=e75]: 🔬
                - generic [ref=e76]: Researcher
                - generic [ref=e77]: Maximum reasoning power
              - button "🎓 Student Free & open-source only" [ref=e78]:
                - generic [ref=e79]: 🎓
                - generic [ref=e80]: Student
                - generic [ref=e81]: Free & open-source only
            - heading "Or choose your use case manually" [level=3] [ref=e82]
            - generic [ref=e83]:
              - button "💻 Coding Code generation, debugging, review" [ref=e84]:
                - generic [ref=e85]: 💻
                - generic [ref=e86]: Coding
                - generic [ref=e87]: Code generation, debugging, review
              - button "✍️ Writing Content, emails, documentation" [ref=e88]:
                - generic [ref=e89]: ✍️
                - generic [ref=e90]: Writing
                - generic [ref=e91]: Content, emails, documentation
              - button "🔬 Analysis Data analysis, research, reasoning" [ref=e92]:
                - generic [ref=e93]: 🔬
                - generic [ref=e94]: Analysis
                - generic [ref=e95]: Data analysis, research, reasoning
              - button "📝 Summarization Documents, articles, long texts" [ref=e96]:
                - generic [ref=e97]: 📝
                - generic [ref=e98]: Summarization
                - generic [ref=e99]: Documents, articles, long texts
              - button "🔍 RAG / Search Retrieval-augmented generation, Q&A" [ref=e100]:
                - generic [ref=e101]: 🔍
                - generic [ref=e102]: RAG / Search
                - generic [ref=e103]: Retrieval-augmented generation, Q&A
              - button "🤖 Agents Multi-step autonomous tasks, tool use" [ref=e104]:
                - generic [ref=e105]: 🤖
                - generic [ref=e106]: Agents
                - generic [ref=e107]: Multi-step autonomous tasks, tool use
              - button "👁️ Vision Image understanding, multimodal tasks" [ref=e108]:
                - generic [ref=e109]: 👁️
                - generic [ref=e110]: Vision
                - generic [ref=e111]: Image understanding, multimodal tasks
              - button "📚 Long Context Very large inputs, 100k+ tokens" [ref=e112]:
                - generic [ref=e113]: 📚
                - generic [ref=e114]: Long Context
                - generic [ref=e115]: Very large inputs, 100k+ tokens
  - alert [ref=e116]
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
> 45  |     await expect(page.getByText('Use Case')).toBeVisible()
      |                                              ^ Error: expect(locator).toBeVisible() failed
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
  87  |     await page.getByRole('button', { name: /good$/i }).first().click()
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
```