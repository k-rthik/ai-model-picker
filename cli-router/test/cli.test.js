import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { main, parseArgs } from '../src/cli.js';

function output(isTTY = false) {
  return { isTTY, text: '', write(value) { this.text += value; } };
}

function setup(overrides = {}) {
  const calls = { routes: [], confirmations: [], spawns: [], priorities: 0 };
  const recommendation = {
    tier: 'balanced', model: 'example-model', effort: 'medium', source: 'jev', reason: 'Confident choice',
    command: "cd '/tmp/project' && codex --model example-model 'hello'",
    runCommand: 'jev-router codex --run --prompt hello',
    execution: { executable: 'codex', args: ['--model', 'example-model', 'hello'], cwd: '/tmp/project' },
    costs: { estimatedUsd: 0.01, comparedWithFrontierUsd: -0.02 },
  };
  const dependencies = {
    stdin: { isTTY: false }, stdout: output(), stderr: output(), cwd: '/tmp/project', env: { PATH: '/test/bin' },
    route: async input => { calls.routes.push(input); return recommendation; },
    askCostPriority: async () => { calls.priorities += 1; return 'cost'; },
    confirmRun: async preview => { calls.confirmations.push(preview); return true; },
    spawn: (...args) => {
      calls.spawns.push(args);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
    ...overrides,
  };
  return { dependencies, calls, recommendation };
}

test('parses a prompt and leaves all native arguments after -- untouched', () => {
  assert.deepEqual(parseArgs(['codex', '--prompt', 'fix a bug', '--cwd=/a path', '--cost-priority', 'cost', '--output-tokens', '100', '--', '--json', '--model=custom', 'two words']), {
    agent: 'codex', prompt: 'fix a bug', cwd: '/a path', costPriority: 'cost', outputTokens: 100,
    nativeArgs: ['--json', '--model=custom', 'two words'],
  });
});

test('rejects ambiguous or unknown wrapper input and execution bypass flags', () => {
  for (const args of [
    ['codex'], ['other', 'hello'], ['codex', '--prompt'], ['codex', 'hello', 'again'],
    ['codex', 'hello', '--yes'], ['codex', 'hello', '--model', 'custom'],
    ['codex', 'hello', '--run', '--dry-run'], ['codex', 'hello', '--run', '--json'],
    ['codex', 'hello', '--cost-priority', 'cheap'], ['codex', 'hello', '--output-tokens', '-1'],
    ['codex', 'hello', '--output-tokens', '1000001'],
    ['codex', 'hello', '--output-tokens', '1.5'], ['codex', 'hello', '--output-tokens', '1e3'],
    ['claude', '--prompt='], ['ui', '--port', '65536'], ['ui', '--run'],
  ]) assert.throws(() => parseArgs(args), `Expected rejection for ${args.join(' ')}`);
});

test('default recommendation never executes, discloses balanced priority outside a terminal', async () => {
  const { dependencies, calls } = setup();
  assert.equal(await main(['codex', 'hello'], dependencies), 0);
  assert.equal(calls.routes[0].costPriority, 'balanced');
  assert.match(dependencies.stderr.text, /using balanced/);
  assert.match(dependencies.stdout.text, /example-model/);
  assert.match(dependencies.stdout.text, /Token cost comparison/);
  assert.equal(calls.spawns.length, 0);
  assert.equal(calls.confirmations.length, 0);
});

test('JSON is machine-readable, discloses default priority, and never prompts outside a terminal', async () => {
  const { dependencies, calls } = setup();
  assert.equal(await main(['claude', 'hello', '--json'], dependencies), 0);
  const result = JSON.parse(dependencies.stdout.text);
  assert.equal(result.costPriority, 'balanced');
  assert.equal(result.costPriorityDefaulted, true);
  assert.equal(dependencies.stderr.text, '');
  assert.equal(calls.priorities, 0);
  assert.equal(calls.spawns.length, 0);
});

test('asks whether token cost is a priority interactively when omitted', async () => {
  const { dependencies, calls } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  assert.equal(await main(['codex', 'hello'], dependencies), 0);
  assert.equal(calls.priorities, 1);
  assert.equal(calls.routes[0].costPriority, 'cost');
  assert.equal(calls.spawns.length, 0);
});

test('an explicit cost priority skips the question and routes estimates and native flags', async () => {
  const { dependencies, calls } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  assert.equal(await main(['claude', 'hello', '--cost-priority=quality', '--output-tokens=1500', '--', '--resume', 'session-id'], dependencies), 0);
  assert.equal(calls.priorities, 0);
  assert.deepEqual(calls.routes[0], {
    agent: 'claude', prompt: 'hello', cwd: '/tmp/project', costPriority: 'quality',
    outputTokens: 1500, nativeArgs: ['--resume', 'session-id'],
  });
});

test('dry-run never requests execution consent', async () => {
  const { dependencies, calls } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  assert.equal(await main(['codex', 'hello', '--dry-run', '--cost-priority=balanced'], dependencies), 0);
  assert.equal(calls.confirmations.length, 0);
  assert.equal(calls.spawns.length, 0);
});

test('strict fallback returns the full JSON result and exit 2', async () => {
  const { dependencies, calls, recommendation } = setup();
  recommendation.source = 'fallback';
  assert.equal(await main(['codex', 'hello', '--strict', '--json'], dependencies), 2);
  assert.equal(JSON.parse(dependencies.stdout.text).source, 'fallback');
  assert.equal(dependencies.stderr.text, '');
  assert.equal(calls.spawns.length, 0);
});

test('strict fallback cannot reach a consent prompt or launch', async () => {
  const { dependencies, calls, recommendation } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  recommendation.source = 'fallback';
  assert.equal(await main(['codex', 'hello', '--strict', '--run', '--cost-priority=balanced'], dependencies), 2);
  assert.equal(calls.confirmations.length, 0);
  assert.equal(calls.spawns.length, 0);
  assert.match(dependencies.stderr.text, /fallback was not launched/);
});

test('run refuses piped input or redirected output even if a consent dependency would approve', async () => {
  for (const [inputTTY, outputTTY] of [[false, true], [true, false], [false, false]]) {
    const { dependencies, calls } = setup({ stdin: { isTTY: inputTTY }, stdout: output(outputTTY) });
    assert.equal(await main(['codex', 'hello', '--run', '--cost-priority=balanced'], dependencies), 1);
    assert.equal(calls.confirmations.length, 0);
    assert.equal(calls.spawns.length, 0);
    assert.match(dependencies.stderr.text, /Command to launch:/);
    assert.match(dependencies.stderr.text, /fresh consent/);
  }
});

test('run shows the exact command before fresh consent and spawns with shell disabled', async () => {
  const { dependencies, calls, recommendation } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  dependencies.confirmRun = async preview => {
    assert.ok(dependencies.stderr.text.includes(recommendation.command));
    calls.confirmations.push(preview);
    assert.equal(calls.spawns.length, 0);
    return true;
  };
  assert.equal(await main(['codex', 'hello', '--run', '--cost-priority=balanced'], dependencies), 0);
  assert.deepEqual(calls.confirmations, [`Command to launch:\n${recommendation.command}`]);
  assert.deepEqual(calls.spawns, [[recommendation.execution.executable, recommendation.execution.args, {
    cwd: recommendation.execution.cwd, stdio: 'inherit', shell: false, env: { PATH: '/test/bin' },
  }]]);
});

test('clears effort overrides for child execution without modifying the parent environment', async () => {
  const inheritedEnv = { PATH: '/test/bin', CLAUDE_CODE_EFFORT_LEVEL: 'low', RETAIN_ME: 'yes' };
  const { dependencies, calls, recommendation } = setup({ stdin: { isTTY: true }, stdout: output(true), env: inheritedEnv });
  recommendation.execution.unsetEnv = ['CLAUDE_CODE_EFFORT_LEVEL'];
  assert.equal(await main(['claude', 'hello', '--run', '--cost-priority=balanced'], dependencies), 0);
  assert.deepEqual(calls.spawns[0][2].env, { PATH: '/test/bin', RETAIN_ME: 'yes' });
  assert.equal(inheritedEnv.CLAUDE_CODE_EFFORT_LEVEL, 'low');
});

test('consent must be explicit true and is obtained separately for every launch', async () => {
  for (const consent of [false, undefined, null, 'yes', 1]) {
    const { dependencies, calls } = setup({
      stdin: { isTTY: true }, stdout: output(true), confirmRun: async () => consent,
    });
    assert.equal(await main(['claude', 'hello', '--run', '--cost-priority=balanced'], dependencies), 0);
    assert.equal(calls.spawns.length, 0);
    assert.match(dependencies.stderr.text, /Not launched/);
  }
  const { dependencies, calls } = setup({ stdin: { isTTY: true }, stdout: output(true) });
  await main(['codex', 'hello', '--run', '--cost-priority=balanced'], dependencies);
  await main(['codex', 'hello', '--run', '--cost-priority=balanced'], dependencies);
  assert.equal(calls.confirmations.length, 2);
  assert.equal(calls.spawns.length, 2);
});

test('underlying CLI exit status and launch errors are reported', async () => {
  for (const mode of ['exit', 'error']) {
    const { dependencies } = setup({ stdin: { isTTY: true }, stdout: output(true), spawn: () => {
      const child = new EventEmitter();
      queueMicrotask(() => mode === 'exit' ? child.emit('exit', 7, null) : child.emit('error', new Error('executable not installed')));
      return child;
    } });
    assert.equal(await main(['codex', 'hello', '--run', '--cost-priority=balanced'], dependencies), mode === 'exit' ? 7 : 1);
    if (mode === 'error') assert.match(dependencies.stderr.text, /executable not installed/);
  }
});

test('argument and router errors do not launch agents', async () => {
  const { dependencies, calls } = setup({ route: async () => { throw new Error('Invalid working directory'); } });
  assert.equal(await main(['codex', 'hello', '--cost-priority=balanced'], dependencies), 1);
  assert.match(dependencies.stderr.text, /Invalid working directory/);
  assert.equal(calls.spawns.length, 0);
  assert.equal(await main(['codex', 'hello', '--run', '--json'], dependencies), 1);
  assert.match(dependencies.stderr.text, /cannot combine/);
});

test('UI starts the server and reports its URL', async () => {
  let received;
  const { dependencies } = setup({ startServer: async options => {
    received = options;
    return { server: {}, url: 'http://127.0.0.1:4567' };
  } });
  assert.equal(await main(['ui', '--port', '4567'], dependencies), 0);
  assert.deepEqual(received, { port: 4567 });
  assert.match(dependencies.stdout.text, /http:\/\/127.0.0.1:4567/);
});

test('help explains consent and passthrough', async () => {
  const { dependencies, calls } = setup();
  assert.equal(await main(['--help'], dependencies), 0);
  assert.match(dependencies.stdout.text, /fresh terminal consent/);
  assert.match(dependencies.stdout.text, /Native arguments must follow --/);
  assert.equal(calls.routes.length, 0);
});
