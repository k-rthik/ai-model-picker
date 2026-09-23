# CLI Router Progress

Updated: 2026-09-23

## What has been implemented

The router implementation currently lives in [`cli-router/`](./cli-router/). It is a dependency-free Node.js 22+ package that wraps both Codex CLI and Claude Code.

### Routing

- Uses Jev’s typed `choice` response to select `quick`, `balanced`, `strong`, or `frontier`.
- Sends only `{ prompt, agent, cwd }` as Jev state. It does not read or upload repository contents, native arguments, environment variables, or history.
- Accepts a Jev result only when:
  - confidence is at least `0.65`; and
  - the top probability exceeds the second-highest probability by at least `0.15`.
- Falls back to the balanced tier when Jev is unavailable, times out, returns an HTTP error, returns malformed data, or fails either threshold.
- `--strict` refuses fallback instead of continuing.
- Cost preference supports `cost`, `balanced`, and `quality`. Interactive CLI use asks if no preference is supplied; noninteractive use defaults to balanced and discloses that assumption.

### Model mappings

The current catalog is in [`cli-router/src/catalog.js`](./cli-router/src/catalog.js), with prices dated 2026-09-23.

| Tier | Codex model | Effort | Claude Code model | Effort |
| --- | --- | --- | --- | --- |
| quick | `gpt-6-luna` | low | `claude-haiku-4-5-20251001` | omitted |
| balanced | `gpt-6-sol` | medium | `claude-sonnet-4-6` | medium |
| strong | `gpt-6-sol` | high | `claude-opus-4-7` | high |
| frontier | `gpt-6-astra` | xhigh | `claude-opus-4-7` | max |

Claude execution clears `CLAUDE_CODE_EFFORT_LEVEL` so an inherited environment setting cannot override the selected effort.

### CLI

[`cli-router/src/cli.js`](./cli-router/src/cli.js) supports:

- Codex and Claude agent selection.
- Prompt, working-directory, cost-priority, and output-token options.
- `--dry-run`, `--json`, `--strict`, `--run`, and native argument passthrough after `--`.
- Copyable native commands with model and reasoning effort included.
- Cost comparisons for all four tiers, including signed differences from balanced.
- Direct launch only after a fresh explicit `yes` typed into `/dev/tty`.
- No automatic approval or `--yes` bypass.
- No launch when input/output is not a real interactive terminal.
- Shell-disabled child execution with inherited Claude effort overrides removed.

### Cost estimates

The estimate uses an approximate prompt token count (UTF-8 bytes divided by four) and an editable assumed output/reasoning token count, defaulting to 2,000. It shows standard uncached short-context API rates and clearly labels the result as an estimate, not a subscription bill or full coding-session quote. Repository context, tools, cache effects, long-context pricing, extra turns, and actual reasoning-token usage can change the final cost.

### Local UI

[`cli-router/public/`](./cli-router/public/) contains a responsive local UI with:

- Prompt, agent, cost-priority, working-directory, and output-token inputs.
- Selected model and reasoning effort display.
- Jev versus fallback status and confidence/margin details.
- Copyable native command and consent-wrapper command.
- Four-tier token-cost comparison table.
- Stale-request invalidation and safe text-only rendering.
- Local privacy and estimate explanations.

[`cli-router/src/server.js`](./cli-router/src/server.js) serves the static UI on loopback, exposes `/api/config` and `/api/route`, checks host/origin, uses a per-process CSRF token, and has no execution endpoint. This standalone server is kept as a local development option alongside the Next.js integration below.

### Verification

The test suite contains 29 tests covering CLI parsing, consent, strict fallback, command construction, Jev thresholds, malformed responses, privacy of the Jev payload, shell quoting, Claude effort behavior, cost arithmetic, and HTTP validation.

All 29 tests pass (`npm test` in `cli-router/`), including the two HTTP server tests — the earlier note about `EPERM` on loopback binding in a restricted sandbox does not apply in this environment.

## Next.js integration

The router is now wired into the existing Next.js app, not just the standalone package:

- **Routing logic**: reimplemented in TypeScript at [`frontend/app/lib/cli-router/core.ts`](./frontend/app/lib/cli-router/core.ts), with types in [`types.ts`](./frontend/app/lib/cli-router/types.ts) and the catalog ported to [`catalog.json`](./frontend/app/lib/cli-router/catalog.json). This is a separate implementation from `cli-router/src/router.js`, not a shared import — keep both in sync when the routing rules or catalog change.
- **API routes**: [`app/api/cli-router/config/route.ts`](./frontend/app/api/cli-router/config/route.ts) (`GET`, returns catalog/thresholds/whether Jev is configured, never the key itself) and [`app/api/cli-router/route/route.ts`](./frontend/app/api/cli-router/route/route.ts) (`POST`, validates content-type/body size/JSON shape, checks same-origin, enforces `--strict` semantics). No execution endpoint exists here either.
- **UI**: [`app/components/cli/CliRouterPanel.tsx`](./frontend/app/components/cli/CliRouterPanel.tsx) is a full React reimplementation of the local UI (not a port of `cli-router/public/`), fetched via [`app/lib/cliRouterApi.ts`](./frontend/app/lib/cliRouterApi.ts).
- **Navigation**: `HomeShell` (`app/components/HomeShell.tsx`) gained a `cli` tab, and [`app/cli-router/page.tsx`](./frontend/app/cli-router/page.tsx) is a shareable direct link that opens `HomeShell` on that tab.
- **Verification**: `npm run build`, `npm run lint`, and `tsc --noEmit` all pass in `frontend/` with this integration in place. (The 3 remaining lint errors — two `<a>`-vs-`next/link` warnings, one setState-in-effect in `ThemeToggle.tsx` — predate this work and are unrelated.)

The original standalone-only integration checklist (route/page, API handlers, asset/API adaptation, decide on keeping the standalone server, run Next build/lint) is complete. What's left before this can be considered fully shipped:

1. ~~Manual/browser verification of the `cli-router` tab and `/cli-router` deep link.~~ Done — verified in Chrome against `next dev`: the tab loads and highlights correctly, `/cli-router` deep-links straight into it, `GET /api/cli-router/config` and `POST /api/cli-router/route` both return `200` with the expected balanced-tier fallback (no Jev key configured locally), and switching between Claude Code and Codex CLI correctly re-routes the model/command shown. The "pick a model directly" card correctly degrades to a fallback message when the Java backend on `:8080` isn't running — that's an environment gap in this session, not a bug in the panel.
2. Decide whether to keep two parallel routing implementations (`cli-router/src/router.js` vs `frontend/app/lib/cli-router/core.ts`) long-term, or have one call the other / extract a shared package.
3. No automated tests yet for the new Next API routes or `CliRouterPanel` itself — only the standalone `cli-router/` package has test coverage.

The standalone usage is documented in [`cli-router/README.md`](./cli-router/README.md).
