# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recommendations.spec.ts >> Recommendation Results — correctness >> speed badge shows fast / medium / slow
- Location: tests/recommendations.spec.ts:176:7

# Error details

```
Error: locator.textContent: Error: strict mode violation: locator('text=Speed').locator('../..') resolved to 2 elements:
    1) <div class="grid grid-cols-3 gap-4">…</div> aka getByText('Input price$1.75/1MContext400KSpeed➡ Medium')
    2) <div class="space-y-4">…</div> aka locator('div').filter({ hasText: '💡Better value alternative' }).nth(4)

Call log:
  - waiting for locator('text=Speed').locator('../..')

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
          - generic [ref=e54]:
            - generic [ref=e55]: 💡
            - generic [ref=e56]:
              - generic [ref=e57]: Better value alternative found
              - paragraph [ref=e58]:
                - text: "xAI: Grok 4.20 Multi-Agent is"
                - generic [ref=e59]: 68% cheaper
                - text: "than OpenAI: GPT-5.3-Codex for coding, with only a"
                - generic [ref=e60]: 0.6-point
                - text: quality drop.
              - generic [ref=e61]:
                - generic [ref=e62]:
                  - text: "xAI: Grok 4.20 Multi-Agent:"
                  - strong [ref=e63]: $1.25/1M
                - generic [ref=e64]:
                  - text: "OpenAI: GPT-5.3-Codex:"
                  - strong [ref=e65]: $1.75/1M
            - button "Dismiss" [ref=e66]: ×
          - generic [ref=e67]:
            - generic [ref=e68]:
              - generic [ref=e69]:
                - generic [ref=e70]: Top Pick
                - generic [ref=e71]: "OpenAI: GPT-5.3-Codex"
              - generic [ref=e72]: Openai
            - paragraph [ref=e73]: "OpenAI: GPT-5.3-Codex scores 10.0/10 for coding at $1.75/1M input and $14.00/1M output tokens."
            - generic [ref=e74]:
              - generic [ref=e75]:
                - generic [ref=e76]: Input price
                - generic [ref=e77]: $1.75/1M
              - generic [ref=e78]:
                - generic [ref=e79]: Context
                - generic [ref=e80]: 400K
              - generic [ref=e81]:
                - generic [ref=e82]: Speed
                - text: ➡ Medium
          - generic [ref=e83]:
            - generic [ref=e84]: Runner Up
            - generic [ref=e85]:
              - generic [ref=e86]: "OpenAI: GPT-5.1-Codex-Max"
              - generic [ref=e87]: Openai
            - generic [ref=e88]: $1.25/1M input · medium speed
          - button "Start Over" [ref=e89]
  - alert [ref=e90]
```

# Test source

```ts
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
> 180 |     const text = await speedCell.textContent()
      |                                  ^ Error: locator.textContent: Error: strict mode violation: locator('text=Speed').locator('../..') resolved to 2 elements:
  181 |     expect(text?.toLowerCase()).toMatch(/fast|medium|slow/)
  182 |   })
  183 | 
  184 | })
  185 | 
  186 | test.describe('Recommendation Results — all use cases', () => {
  187 | 
  188 |   const useCases = ['Coding', 'Writing', 'Analysis', 'Summarization', 'Agents', 'Vision']
  189 | 
  190 |   for (const uc of useCases) {
  191 |     test(`${uc} use case returns a valid top pick`, async ({ page }) => {
  192 |       await getRecommendation(page, uc, 'Good')
  193 | 
  194 |       await expect(page.getByText('Top Pick')).toBeVisible()
  195 | 
  196 |       const reasoning = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
  197 |       expect(reasoning).toBeTruthy()
  198 |       expect(reasoning).not.toContain('-1000000')
  199 | 
  200 |       const scoreMatch = reasoning!.match(/scores (\d+\.\d+)\/10/)
  201 |       expect(scoreMatch).toBeTruthy()
  202 |       expect(parseFloat(scoreMatch![1])).toBeGreaterThanOrEqual(0)
  203 |       expect(parseFloat(scoreMatch![1])).toBeLessThanOrEqual(10)
  204 |     })
  205 |   }
  206 | 
  207 | })
  208 | 
  209 | test.describe('Recommendation Results — budget constraint', () => {
  210 | 
  211 |   test('result price respects budget cap', async ({ page }) => {
  212 |     const budget = 5  // $5/1M
  213 |     await getRecommendation(page, 'Coding', 'Good', budget)
  214 | 
  215 |     const reasoning = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
  216 |     const priceMatch = reasoning!.match(/at \$([\d.]+)\/1M/)
  217 |     if (priceMatch) {
  218 |       const price = parseFloat(priceMatch[1])
  219 |       // Allow small float tolerance
  220 |       expect(price).toBeLessThanOrEqual(budget + 0.01)
  221 |     }
  222 |   })
  223 | 
  224 |   test('no-limit budget returns a result', async ({ page }) => {
  225 |     await getRecommendation(page, 'Agents', 'Best in class', 0)
  226 |     await expect(page.getByText('Top Pick')).toBeVisible()
  227 |   })
  228 | 
  229 |   test('tight budget does not produce negative price', async ({ page }) => {
  230 |     await getRecommendation(page, 'Writing', 'Good enough', 1)
  231 | 
  232 |     const allPrices = await page.locator('text=/\\$[\\d.]+\\/1M/').allTextContents()
  233 |     for (const t of allPrices) {
  234 |       const m = t.match(/\$([\d.]+)\/1M/)
  235 |       if (m) expect(parseFloat(m[1])).toBeGreaterThanOrEqual(0)
  236 |     }
  237 |   })
  238 | 
  239 | })
  240 | 
  241 | test.describe('Recommendation Results — quality tiers', () => {
  242 | 
  243 |   test('quality tier 1 (Good enough) returns a result', async ({ page }) => {
  244 |     await getRecommendation(page, 'Summarization', 'Good enough')
  245 |     await expect(page.getByText('Top Pick')).toBeVisible()
  246 |   })
  247 | 
  248 |   test('quality tier 5 (Best in class) returns a result', async ({ page }) => {
  249 |     await getRecommendation(page, 'Coding', 'Best in class')
  250 |     await expect(page.getByText('Top Pick')).toBeVisible()
  251 |   })
  252 | 
  253 |   test('higher quality tier tends to have higher or equal price', async ({ page }) => {
  254 |     // Get price at quality 1
  255 |     await getRecommendation(page, 'Coding', 'Good enough')
  256 |     const cheapText = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
  257 |     const cheapMatch = cheapText!.match(/at \$([\d.]+)\/1M/)
  258 |     const cheapPrice = cheapMatch ? parseFloat(cheapMatch[1]) : 0
  259 | 
  260 |     // Get price at quality 5
  261 |     await getRecommendation(page, 'Coding', 'Best in class')
  262 |     const premiumText = await page.locator('text=/scores.*\/10.*\/1M/').textContent()
  263 |     const premiumMatch = premiumText!.match(/at \$([\d.]+)\/1M/)
  264 |     const premiumPrice = premiumMatch ? parseFloat(premiumMatch[1]) : 0
  265 | 
  266 |     // Best-in-class should not be cheaper than good-enough (soft check)
  267 |     expect(premiumPrice).toBeGreaterThanOrEqual(cheapPrice - 0.1)
  268 |   })
  269 | 
  270 | })
  271 | 
  272 | test.describe('Wizard UX', () => {
  273 | 
  274 |   test('Start Over resets to use case step', async ({ page }) => {
  275 |     await getRecommendation(page, 'Coding', 'Good')
  276 | 
  277 |     await page.getByRole('button', { name: /start over/i }).click()
  278 |     await expect(page.getByText("Describe what you're building")).toBeVisible()
  279 |   })
  280 | 
```