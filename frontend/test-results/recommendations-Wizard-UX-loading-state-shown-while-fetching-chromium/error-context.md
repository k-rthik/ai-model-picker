# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recommendations.spec.ts >> Wizard UX >> loading state shown while fetching
- Location: tests/recommendations.spec.ts:293:7

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
  281 |   test('error state shown when backend is unavailable', async ({ page }) => {
  282 |     // Intercept API call and return 500
  283 |     await page.route('**/api/recommend**', route => route.fulfill({ status: 500, body: 'error' }))
  284 | 
  285 |     await openRecommendTab(page)
  286 |     await page.getByRole('button', { name: /coding/i }).first().click()
  287 |     await page.getByRole('button', { name: /good$/i }).first().click()
  288 |     await page.getByRole('button', { name: /get recommendation/i }).click()
  289 | 
  290 |     await expect(page.locator('text=/API error|Failed to get/i')).toBeVisible({ timeout: 10_000 })
  291 |   })
  292 | 
  293 |   test('loading state shown while fetching', async ({ page }) => {
  294 |     // Delay the API response
  295 |     await page.route('**/api/recommend**', async route => {
  296 |       await new Promise(r => setTimeout(r, 300))
  297 |       await route.continue()
  298 |     })
  299 | 
  300 |     await openRecommendTab(page)
  301 |     await page.getByRole('button', { name: /coding/i }).first().click()
> 302 |     await page.getByRole('button', { name: /good$/i }).first().click()
      |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  303 |     await page.getByRole('button', { name: /get recommendation/i }).click()
  304 | 
  305 |     await expect(page.getByText('Finding best model...')).toBeVisible()
  306 |   })
  307 | 
  308 | })
  309 | 
```