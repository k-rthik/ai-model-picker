#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { ReadStream, WriteStream } from 'node:tty';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage:
  jev-router <codex|claude> --prompt "your task" [options] -- [native arguments]
  jev-router <codex|claude> "your task" [options]
  jev-router ui [--port 4317]

Options:
  --cwd DIR                       Working directory (default: current directory)
  --cost-priority cost|balanced|quality
                                  Ask interactively if omitted; otherwise balanced
  --output-tokens N               Output-token estimate (default: 2000)
  --dry-run                       Recommend without running an agent
  --json                          Print the recommendation as JSON; never run
  --strict                        Exit 2 on fallback; never launch a fallback
  --run                           Offer to launch after fresh terminal consent
  --help                          Show this help

Recommendations never launch by default. --run always requires typing yes in a
terminal after the exact command is shown. There is no automatic-approval flag.
Native arguments must follow --. --run cannot combine with --dry-run or --json.
Costs are estimates; subscriptions, caching, tools, and token usage can differ.
`;

const BOOLEAN_OPTIONS = new Map([
  ['--dry-run', 'dryRun'], ['--json', 'json'], ['--strict', 'strict'], ['--run', 'run'],
]);
const VALUE_OPTIONS = new Map([
  ['--prompt', 'prompt'], ['--cwd', 'cwd'], ['--cost-priority', 'costPriority'],
  ['--output-tokens', 'outputTokens'],
]);

function integer(value, name, min, max = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return Number(value);
}

export function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') return { help: true };
  const [agent, ...args] = argv;
  if (agent === 'ui') {
    const result = { ui: true, port: 4317 };
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === '--help' || args[i] === '-h') return { help: true };
      if (args[i] === '--port') result.port = integer(args[++i], '--port', 0, 65535);
      else if (args[i].startsWith('--port=')) result.port = integer(args[i].slice(7), '--port', 0, 65535);
      else throw new Error(`Unknown UI argument: ${args[i]}`);
    }
    return result;
  }
  if (!['codex', 'claude'].includes(agent)) throw new Error('Agent must be codex or claude (or use the ui subcommand).');
  const result = { agent, nativeArgs: [], outputTokens: 2000 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      result.nativeArgs = args.slice(i + 1);
      break;
    }
    if (arg === '--help' || arg === '-h') return { help: true };
    if (BOOLEAN_OPTIONS.has(arg)) {
      result[BOOLEAN_OPTIONS.get(arg)] = true;
      continue;
    }
    const equals = arg.indexOf('=');
    const key = equals === -1 ? arg : arg.slice(0, equals);
    if (VALUE_OPTIONS.has(key)) {
      const value = equals === -1 ? args[++i] : arg.slice(equals + 1);
      if (value === undefined || (equals === -1 && value.startsWith('--'))) throw new Error(`Missing value for ${key}.`);
      const property = VALUE_OPTIONS.get(key);
      if (property === 'prompt' && result.prompt !== undefined) throw new Error('Provide the prompt only once.');
      result[property] = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown wrapper option: ${arg}. Put native CLI arguments after --.`);
    } else {
      if (result.prompt !== undefined) throw new Error('Use one quoted prompt; put native CLI arguments after --.');
      result.prompt = arg;
    }
  }
  if (typeof result.prompt !== 'string' || result.prompt.trim() === '') throw new Error('Provide a non-empty prompt with --prompt or one quoted positional argument.');
  if (result.costPriority !== undefined && !['cost', 'balanced', 'quality'].includes(result.costPriority)) {
    throw new Error('--cost-priority must be cost, balanced, or quality.');
  }
  result.outputTokens = integer(result.outputTokens, '--output-tokens', 0, 1000000);
  if (result.run && (result.dryRun || result.json)) throw new Error('--run cannot combine with --dry-run or --json.');
  return result;
}

// Open a new controlling-terminal stream for every answer. Discard bytes already
// waiting before showing the question so piped or pre-buffered answers cannot
// approve a later launch. Never reuse stdin or the cost-priority question stream.
async function freshTerminalQuestion(question, preview = '') {
  let input;
  let output;
  let rl;
  const wasRaw = Boolean(process.stdin.isRaw);
  try {
    input = new ReadStream(openSync('/dev/tty', 'r'));
    output = new WriteStream(openSync('/dev/tty', 'w'));
    input.setRawMode(true);
    const discard = () => {};
    input.on('data', discard);
    input.resume();
    await new Promise(resolve => setTimeout(resolve, 75));
    input.pause();
    input.removeListener('data', discard);
    rl = createInterface({ input, output, terminal: true });
    if (preview) output.write(`${preview}\n`);
    return await new Promise(resolve => {
      rl.once('SIGINT', () => resolve(null));
      rl.once('close', () => resolve(null));
      rl.question(question, answer => resolve(answer));
    });
  } catch (error) {
    throw new Error(`Cannot read fresh consent from the controlling terminal: ${error.message}`);
  } finally {
    rl?.close();
    if (input) {
      input.setRawMode(wasRaw);
      input.destroy();
    }
    output?.destroy();
  }
}

async function askCostPriority() {
  const answer = await freshTerminalQuestion('Is token cost a priority? [cost / balanced / quality] (balanced): ');
  if (answer === null) throw new Error('Cost-priority selection cancelled.');
  const value = answer.trim().toLowerCase() || 'balanced';
  if (!['cost', 'balanced', 'quality'].includes(value)) throw new Error('Choose cost, balanced, or quality.');
  return value;
}

async function confirmRun(preview) {
  const answer = await freshTerminalQuestion('Run this command now? Type yes to consent: ', preview);
  return answer?.trim().toLowerCase() === 'yes';
}

function printRecommendation(result, stdout) {
  stdout.write(`${result.model}${result.effort ? ` · reasoning ${result.effort}` : ''} · ${result.tier}\n`);
  stdout.write(`Routing: ${result.source}${result.reason ? ` — ${result.reason}` : ''}\n`);
  stdout.write(`Token-cost priority: ${result.costPriority}\n`);
  if (Array.isArray(result.costs?.rows)) {
    const costs = result.costs;
    const money = value => `$${value.toFixed(6)}`;
    const difference = value => `${value < 0 ? '-' : '+'}${money(Math.abs(value))}`;
    const rows = [
      ['Tier', 'Model', 'Effort', 'Input / 1M', 'Output / 1M', 'Estimate', 'vs balanced'],
      ...costs.rows.map(row => [
        `${row.tier === result.tier ? '*' : ' '}${row.tier}`, row.model, row.effort ?? 'default',
        `$${row.inputPerMillion}`, `$${row.outputPerMillion}`, money(row.estimatedUsd), difference(row.deltaVsBalancedUsd),
      ]),
    ];
    const widths = rows[0].map((_, column) => Math.max(...rows.map(row => row[column].length)));
    stdout.write(`\nToken cost comparison (USD estimates; * selected):\n`);
    stdout.write(`${rows.map(row => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n')}\n`);
    stdout.write(`Assumed tokens: ${costs.inputTokens} input + ${costs.outputTokens} output/reasoning. Prices: ${costs.pricingDate}.\n`);
    stdout.write(`${costs.basis}\n${costs.note}\n`);
  } else if (result.costs) {
    stdout.write(`Token cost comparison (estimates):\n${JSON.stringify(result.costs, null, 2)}\n`);
  }
  stdout.write(`\nCopy into your terminal:\n${result.command}\n`);
}

async function launch(execution, spawnImpl, inheritedEnv) {
  if (!execution || typeof execution.executable !== 'string' || !Array.isArray(execution.args) ||
      !execution.args.every(arg => typeof arg === 'string') || typeof execution.cwd !== 'string') {
    throw new Error('Router did not return a valid execution command.');
  }
  return await new Promise((resolve, reject) => {
    const env = { ...inheritedEnv };
    for (const key of execution.unsetEnv ?? []) delete env[key];
    const child = spawnImpl(execution.executable, execution.args, { cwd: execution.cwd, stdio: 'inherit', shell: false, env });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdin = dependencies.stdin ?? process.stdin;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  try {
    const options = parseArgs(argv);
    if (options.help) { stdout.write(USAGE); return 0; }
    if (options.ui) {
      const start = dependencies.startServer ?? (await import('./server.js')).startServer;
      const { url } = await start({ port: options.port });
      stdout.write(`Jev Router UI: ${url}\nPress Ctrl+C to stop.\n`);
      return 0;
    }
    let costPriority = options.costPriority;
    const costPriorityDefaulted = costPriority === undefined && (options.json || !(stdin.isTTY && stdout.isTTY));
    if (costPriority === undefined) {
      if (!options.json && stdin.isTTY && stdout.isTTY) costPriority = await (dependencies.askCostPriority ?? askCostPriority)();
      else {
        costPriority = 'balanced';
        if (!options.json) stderr.write('Token-cost priority was not supplied; using balanced. Set --cost-priority cost|balanced|quality to choose.\n');
      }
    }
    const route = dependencies.route ?? (await import('./router.js')).route;
    const recommendation = await route({
      prompt: options.prompt, agent: options.agent, cwd: options.cwd ?? dependencies.cwd ?? process.cwd(),
      costPriority, outputTokens: options.outputTokens, nativeArgs: options.nativeArgs,
    });
    const result = { ...recommendation, costPriority, costPriorityDefaulted };
    if (options.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printRecommendation(result, stdout);
    if (options.strict && result.source === 'fallback') {
      if (!options.json) stderr.write('Strict routing requires a confident Jev choice; fallback was not launched.\n');
      return 2;
    }
    if (!options.run) return 0;
    const preview = `Command to launch:\n${result.command}`;
    stderr.write(`${preview}\n`);
    if (!(stdin.isTTY && stdout.isTTY)) {
      stderr.write('Launch requires an interactive terminal and fresh consent. Copy the command or run again in a terminal with --run.\n');
      return 1;
    }
    const consent = await (dependencies.confirmRun ?? confirmRun)(preview);
    if (consent !== true) { stderr.write('Not launched.\n'); return 0; }
    return await launch(result.execution, dependencies.spawn ?? spawn, dependencies.env ?? process.env);
  } catch (error) {
    stderr.write(`jev-router: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
