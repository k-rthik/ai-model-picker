# CLI Router Progress

Updated: 2026-09-23

The router now ships in two places: a standalone Node package in [`cli-router/`](./cli-router/)
and a **CLI Router** tab inside the Next app in [`frontend/`](./frontend/). Both read the same
catalog file, so tiers, model IDs, and prices cannot drift apart.

## Shared catalog

[`frontend/app/lib/cli-router/catalog.json`](./frontend/app/lib/cli-router/catalog.json) is the one
source of truth for tiers, model IDs, reasoning effort, and prices. The Next app bundles it;
`cli-router/src/catalog.js` imports the same file from the repository. Prices are standard,
uncached, short-context API USD per 1M tokens.

| Tier | Codex model | Effort | Claude Code model | Effort |
| --- | --- | --- | --- | --- |
| quick | `gpt-6-luna` | low | `claude-haiku-4-5` | omitted |
| balanced | `gpt-6-sol` | medium | `claude-sonnet-5` | medium |
| strong | `gpt-6-sol` | high | `claude-opus-5` | high |
| frontier | `gpt-6-astra` | xhigh | `claude-fable-5-1` | max |

The Claude rows were corrected on 2026-09-23. The previous entries named `claude-sonnet-4-6` and
`claude-opus-4-7`, which are prior-generation IDs, and the Haiku row carried a date suffix that
the current ID does not use. Current first-party rates are $1/$5 for Haiku 4.5, $2/$10 for
Sonnet 5, $5/$25 for Opus 5, and $10/$50 for Fable 5.1. Codex rows were left as previously
verified. Claude execution still clears `CLAUDE_CODE_EFFORT_LEVEL` so an inherited environment
setting cannot override the selected effort.

## In the Next app

### CLI Router tab

`frontend/app/components/cli/CliRouterPanel.tsx` is a fourth tab beside Recommend, Compare, and
Cost Calc. One prompt produces two answers side by side:

1. **Run it in the CLI.** The prompt, chosen agent, and cost priority route to a tier, and the card
   shows the model, reasoning effort, whether the choice was confident or fell back, a copyable
   native command, and a four-tier cost comparison.
2. **Or pick a model to call directly.** The same words go to the backend's existing rule-based
   natural-language endpoint, which picks from every model the site tracks. The card shows the top
   pick, how the prompt was read, the reasoning, price, context, speed, and a runner-up.

The two requests are independent. When the backend is asleep the catalog card says so and the CLI
answer still appears. Editing any field invalidates the result on screen so a stale command cannot
be copied. Advanced settings hold an optional working directory, the assumed output-token count,
and strict routing.

`/cli-router` is a shareable URL that opens the app on that tab. The page body lives in
`frontend/app/components/HomeShell.tsx`, which both `/` and `/cli-router` render with a different
`initialTab`; this keeps the tab out of the URL query string and avoids reading `window` during
render.

### API handlers

- `GET /api/cli-router/config` reports whether a routing key is configured, plus the catalog,
  pricing date, and thresholds. The key itself never appears in the response.
- `POST /api/cli-router/route` runs the routing core. It requires JSON, rejects cross-site posts by
  comparing `Origin` to `Host`, caps the body at 200 KB, and returns 422 for strict routing that
  would otherwise fall back.

Both are `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and `Cache-Control: no-store`. The Jev
key is read from `JEV_API_KEY` or `TYPESAFE_API_KEY` on the server only.

### Hosted routing core

`frontend/app/lib/cli-router/core.ts` is the deployable twin of `cli-router/src/router.js`: same
thresholds, same typed-choice validation, same privacy contract, same shell quoting, same native
argument rejection. It differs in two deliberate ways.

- It never touches the filesystem. The working directory named in the form belongs to the
  visitor's machine, so it is optional, validated for shape only, and never stat'd. When it is
  present the command gets a `cd` prefix; when it is absent the command runs wherever you paste it.
- It emits only the native command. The consent wrapper stays a local-CLI feature, because it needs
  a checkout to run.

This is a deliberate second implementation rather than a shared import, because the frontend
deploys from its own directory and cannot reach a sibling package at build time. The catalog is
shared as data; the logic is not.

## Standalone package

[`cli-router/`](./cli-router/) is unchanged apart from the catalog rewire. It still offers the CLI,
the loopback UI on port 4317, Jev-or-fallback routing, consent-gated launching, and passthrough of
native arguments. Its own `public/app.js` carries a `hosted` branch from an earlier plan to serve
that same vanilla UI from Next. The Next integration uses a React panel instead, so that branch is
now unreachable; it was left in place rather than removed.

## Verification

| Check | Result |
| --- | --- |
| Standalone package tests | 29 passed (verified with loopback networking enabled) |
| Playwright API tests (`tests/cli-router-api.spec.ts`) | 16 passed |
| Frontend typecheck | clean (`npx tsc --noEmit`) |
| Frontend lint | 3 existing errors remain in `app/admin/page.tsx`, `app/components/HomeShell.tsx`, and `app/components/shared/ThemeToggle.tsx`; 2 warnings remain |
| Frontend production build | succeeded in a run with network access (`next build`, 8 routes, both API handlers dynamic). A sandboxed run without network fails earlier in `next/font`, which is a network constraint rather than a fault in the router code |

Both HTTP server tests in the standalone package now pass when loopback binding is permitted. The
default restricted sandbox rejects `127.0.0.1` with `EPERM`, so an ordinary in-sandbox `npm test`
run reports those two tests as blocked even though the code paths pass under the permitted run.

The API handlers were exercised directly: routing with and without a working directory, shell
quoting against a prompt containing `$(...)` and an apostrophe, strict routing returning 422, five
invalid-input cases returning 400, a cross-origin post returning 403, and a non-JSON content type
returning 415. The tab was driven in a browser end to end against a stub backend, confirming both
result cards, the four-tier cost table, and the graceful catalog-unavailable message.

Two local gotchas worth knowing before the next run.

- Browse the dev server on `localhost`, not `127.0.0.1`. Next blocks cross-origin dev resources, so
  `127.0.0.1` serves the HTML but not the client chunks, and the page renders without hydrating.
- Playwright is the opposite: it resolves `localhost` to IPv6 while the dev server binds IPv4, so
  point `BASE_URL` at `http://127.0.0.1:<port>`. Start the server with `PORT=<port> npm run dev`,
  because passing `--port` through `npm run dev --` did not take effect.

## Remaining work

1. Point the deployed frontend at a routing key. Without `JEV_API_KEY` or `TYPESAFE_API_KEY` every
   CLI answer is the balanced tier, which the tab states plainly.
2. Re-verify the Codex rows. The Claude rows were corrected against current first-party pricing;
   `gpt-6-luna`, `gpt-6-sol`, and `gpt-6-astra` were carried over unchecked.
3. Decide whether the standalone loopback server stays. It is redundant with the tab for anyone
   running the Next app locally, and it is the only remaining consumer of `public/app.js`.
4. ~~Add Playwright coverage for the tab alongside `frontend/tests/recommendations.spec.ts`.~~ Done —
   [`frontend/tests/cli-router-api.spec.ts`](./frontend/tests/cli-router-api.spec.ts) (16 tests) covers
   the API routes directly, and [`frontend/tests/cli-router-panel.spec.ts`](./frontend/tests/cli-router-panel.spec.ts)
   (16 tests) drives the tab itself: layout defaults, routing to the balanced fallback tier, switching
   agents, the keyboard shortcut, the catalog card (top pick, runner-up, China-provider notice, and
   graceful degradation when its backend 503s, via `page.route` mocks), the empty-prompt and
   relative-working-directory validation errors, stale-result invalidation on edit, and clipboard copy.
   All 32 pass. One note for whoever runs these next: in this sandbox, `npx playwright install
   chromium-headless-shell` downloaded a shell (`ABOUT`/`LICENSE` only, no binary) twice in a row with
   no error — a concurrent `playwright install` from another session sharing the same
   `~/Library/Caches/ms-playwright` looked like the cause. Deleting the cache dir and reinstalling, or
   running with `use: { channel: 'chrome' }` against the system-installed Chrome, both worked around it.

Standalone usage is documented in [`cli-router/README.md`](./cli-router/README.md).
