# Jev Router

A local CLI and browser UI that route a prompt to Codex CLI or Claude Code. Requires Node.js 22+ and whichever native agent you want to run. No package dependencies or build step.

The same routing is also available as the **CLI Router** tab in this repository's Next app, which adds a second answer picking from every model the site tracks. See [`../CLI_ROUTER_PROGRESS.md`](../CLI_ROUTER_PROGRESS.md). This package stays the way to launch an agent, since a website cannot and should not run commands on your machine.

## Start

```sh
cd ~/Code/jev-router
npm start
```

Open **http://127.0.0.1:4317**. Enter a prompt, select an agent, and answer **“Is token cost a priority?”**. The result contains the selected model, reasoning effort, a copyable native command, and a token-cost comparison. Advanced options include working directory, estimated generated/reasoning tokens, and strict routing. The browser only recommends commands; launching through the wrapper requires terminal consent.

To enable Jev, provide an official TypeSafe API key in the environment before starting:

```sh
export TYPESAFE_API_KEY='your-key'
npm start
```

`JEV_API_KEY` is accepted as an alias. Alternatively, put the key in a local `.env` file and run `node --env-file=.env src/cli.js ui`. Keys never reach the browser. No key is needed to use the explicit balanced fallback.

## CLI

```sh
# Recommend only; never starts the agent
node src/cli.js codex --prompt 'Fix the failing tests' --dry-run

# Machine-readable recommendation; no interactive prompts or execution
node src/cli.js claude --prompt 'Explain this function' --json --cost-priority cost

# Preview the exact command, then ask for a fresh terminal confirmation
node src/cli.js codex --prompt 'Implement pagination' --run --cost-priority balanced

# Require a confident Jev decision instead of allowing balanced fallback
node src/cli.js claude --prompt 'Review the architecture' --strict --dry-run

# Native arguments after -- are passed as separate arguments without shell evaluation
node src/cli.js codex --prompt 'Review this change' --run -- --sandbox read-only
node src/cli.js codex --prompt 'Summarize the code' --dry-run -- exec --json
node src/cli.js claude --prompt 'Summarize the code' --dry-run -- --print
```

Run `node src/cli.js --help` for all flags. Optional local installation: `npm link` exposes `jev-router` on your PATH. Installation is not required.

Without a cost preference, an interactive terminal asks you to choose **cost**, **balanced**, or **quality**. Noninteractive use defaults to balanced and reports that assumption. Pass `--cost-priority` to make automation explicit. Preferences alter a fixed routing rubric; uncertain routing always falls back to balanced even when cost is the priority.

`--run` always asks you to type `yes` after displaying the exact command. There is no `--yes` bypass, and piped input cannot authorize a launch. `--dry-run` and `--json` never execute; combining either with `--run` is an error. The copied native command runs directly when you paste it into your terminal; use the secondary wrapper command if you want the consent prompt. That wrapper re-evaluates routing and previews its final choice before asking.

Model, effort, provider, pricing-tier, and working-directory overrides in native arguments are rejected to keep the recommendation and command consistent. Other native options remain the agent's responsibility. The router does not weaken native sandbox/approval settings; explicitly passed native settings are shown before launch. Supported modes are the default interactive CLI, Codex `exec`, and Claude `--print`; administration subcommands are outside the wrapper's scope.

## Routing contract

The router calls TypeSafe's [typed choice API](https://docs.typesafe.ai/api) with the `jev-latest` model and four named choices. It validates the answer type, chosen tier, all four finite probabilities in [0, 1], a distribution summing to 1 (rounding tolerance 0.001), and consistency between the chosen tier and the largest probability.

A choice is accepted only when **confidence ≥ 0.65** and **largest probability − second-largest probability ≥ 0.15**. Equality passes. Missing credentials, a six-second timeout, network/HTTP errors, invalid answers, or uncertainty select **balanced** with a visible reason. `--strict` returns a nonzero exit code and prevents launch on fallback; the browser returns an error without a copyable fallback command.

Only the prompt, agent name, and working-directory path are sent as Jev's `state`. The request also carries the fixed four-tier rubric selected by your cost preference. The router never opens repository files, invokes git, attaches native arguments, or sends environment variables to Jev. It checks only whether the working directory exists. API authentication uses the authorization header. Jev redirects are rejected, provider errors are sanitized, and prompts/history are not saved by this application. Once you consent to launching Codex or Claude, that native agent follows its own context and privacy behavior.

The UI binds only to 127.0.0.1, checks host/origin, uses a per-process CSRF token, and has no execution endpoint. Keep it local.

## Default catalog and cost estimates

| Tier | Codex | Effort | Claude Code | Effort |
| --- | --- | --- | --- | --- |
| quick | gpt-6-luna | low | claude-haiku-4-5-20251001 | unsupported; omitted |
| balanced | gpt-6-sol | medium | claude-sonnet-5 | medium |
| strong | gpt-6-sol | high | claude-opus-5-5 | high |
| frontier | gpt-6-astra | xhigh | claude-fable-5-1 | max |

Claude defaults use current first-party model IDs; Haiku's carries a date suffix, the others do not. Haiku does not support effort. The generated Claude command unsets `CLAUDE_CODE_EFFORT_LEVEL`, which would otherwise override the selected effort. Account/provider access to individual models must still be available.

Tiers, model IDs, effort, and prices live in [`../frontend/app/lib/cli-router/catalog.json`](../frontend/app/lib/cli-router/catalog.json), which [src/catalog.js](src/catalog.js) imports so this package and the Next app cannot drift apart. Edit that JSON file to change model mappings or rates. Prices are an explicit **2026-09-23** snapshot of standard, uncached, short-context API USD per million tokens, sourced from [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

The estimate uses prompt UTF-8 bytes / 4 as a rough input-token count, plus an editable output/reasoning-token assumption (default 2,000), held constant across tiers. It shows signed cost differences relative to balanced. Identical model rates produce identical estimates even when effort differs: higher effort can consume more tokens, but has no invented cost multiplier. These are comparisons, **not full task quotes or subscription bills**. Repository context, repeated tool calls, extra turns, cache effects, long-context uplifts, and Jev routing fees are excluded.

Command/effort references: [Codex CLI](https://learn.chatgpt.com/docs/developer-commands?surface=cli), [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [Claude CLI](https://code.claude.com/docs/en/cli-reference), and [Claude model configuration](https://code.claude.com/docs/en/model-config).

## Verification

```sh
npm test
npm run check
```

Tests mock Jev and agent execution. They cover threshold boundaries, invalid distributions, fallback, outbound payload privacy, command quoting, argument passthrough, cost arithmetic, strict mode, consent behavior, and local HTTP protections. They do not make paid model calls.
