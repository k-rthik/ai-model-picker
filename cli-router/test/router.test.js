import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { route, evaluateAnswer, buildJevRequest, shellQuote, THRESHOLDS } from '../src/router.js';

const input = { agent: 'codex', prompt: 'Fix the failing test.', cwd: process.cwd(), costPriority: 'balanced' };
const answer = (choice = 'strong', probabilities = { quick: 0.05, balanced: 0.10, strong: 0.8, frontier: 0.05 }, confidence = 0.9) => ({ answers: { tier: { type: 'choice', choice, probabilities, confidence } } });
const mock = body => ({ env: { JEV_API_KEY: 'test-key' }, fetchImpl: async () => new Response(JSON.stringify(body)) });

test('accepted Jev decision routes model AND effort', async () => {
  const result = await route(input, mock(answer()));
  assert.equal(result.tier, 'strong');
  assert.equal(result.model, 'gpt-6-sol');
  assert.equal(result.effort, 'high');
  assert.equal(result.source, 'jev');
  assert.ok(result.execution.args.includes('model_reasoning_effort="high"'));
});
test('inclusive threshold boundaries and independent gates', () => {
  const boundary = answer('strong', { quick: .1, balanced: .3, strong: .45, frontier: .15 }, .65);
  assert.equal(evaluateAnswer(boundary).accepted, true);
  boundary.answers.tier.confidence = .6499;
  assert.equal(evaluateAnswer(boundary).accepted, false);
  const narrow = answer('strong', { quick: .05, balanced: .40, strong: .5, frontier: .05 }, .99);
  assert.equal(evaluateAnswer(narrow).accepted, false);
  assert.deepEqual(THRESHOLDS, { confidence: .65, margin: .15 });
});
test('unavailable, failed, timed out, malformed and uncertain all fall back balanced', async () => {
  const cases = [
    { env: {}, fetchImpl: () => { throw new Error('should not request'); } },
    { env: { JEV_API_KEY: 'test' }, fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } },
    { env: { JEV_API_KEY: 'test' }, fetchImpl: async () => new Response('server problem', { status: 503 }) },
    { env: { JEV_API_KEY: 'test' }, fetchImpl: async () => new Response('not JSON') },
    mock(answer('strong', { quick: .1, balanced: .35, strong: .45, frontier: .1 })),
    mock({ answers: { tier: { choice: 'quick' } } }),
  ];
  for (const options of cases) {
    const result = await route(input, options);
    assert.equal(result.tier, 'balanced');
    assert.equal(result.source, 'fallback');
  }
});
test('reject malformed distributions even with high confidence', () => {
  const invalid = [
    answer('quick'),
    answer('strong', { quick: 0, balanced: 0, strong: 1, frontier: 0, extra: 0 }),
    answer('strong', { quick: 0, balanced: 0, strong: .8, frontier: 0 }),
    answer('strong', { quick: -.1, balanced: 0, strong: 1, frontier: .1 }),
    answer('strong', { quick: 0, balanced: 0, strong: NaN, frontier: 0 }),
    answer('strong', { quick: 0, balanced: 0, strong: 1, frontier: 0 }, true),
  ];
  invalid.forEach(body => assert.throws(() => evaluateAnswer(body)));
});
test('privacy contract: exact state fields and native arguments never transmitted', async () => {
  let request;
  await route({ ...input, nativeArgs: ['--search'] }, {
    env: { TYPESAFE_API_KEY: 'test' },
    fetchImpl: async (url, options) => {
      request = JSON.parse(options.body);
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer test');
      return new Response(JSON.stringify(answer()));
    },
  });
  assert.deepEqual(request.state, { prompt: input.prompt, agent: input.agent, cwd: input.cwd });
  assert.equal(JSON.stringify(request).includes('--search'), false);
  assert.deepEqual(Object.keys(request.questions.tier.criteria), ['quick', 'balanced', 'strong', 'frontier']);
  assert.notEqual(buildJevRequest({ ...input, costPriority: 'cost' }).questions.tier.instructions, request.questions.tier.instructions);
});
test('shell quoting protects apostrophes, substitutions and multiline prompts', () => {
  const text = "don't run $(printf BAD) `printf BAD` ;\n--help";
  const output = execFileSync('/bin/sh', ['-c', `printf %s ${shellQuote(text)}`], { encoding: 'utf8' });
  assert.equal(output, text);
});
test('passthrough is preserved, exec supported, conflicting overrides rejected', async () => {
  const result = await route({ ...input, nativeArgs: ['exec', '--json', '--sandbox', 'read-only'] }, { env: {} });
  assert.deepEqual(result.execution.args.slice(0, 5), ['exec', '--json', '--sandbox', 'read-only', '--model']);
  assert.deepEqual(result.execution.args.slice(-2), ['--', input.prompt]);
  for (const nativeArgs of [['--model=x'], ['-mx'], ['-c', 'model="x"'], ['-C/tmp'], ['--oss']]) {
    await assert.rejects(route({ ...input, nativeArgs }, { env: {} }), /override/);
  }
});
test('Claude Haiku omits unsupported effort; others route effort and neutralize env override', async () => {
  const quick = await route({ ...input, agent: 'claude' }, mock(answer('quick', { quick: .9, balanced: .1, strong: 0, frontier: 0 })));
  assert.equal(quick.effort, null);
  assert.equal(quick.execution.args.includes('--effort'), false);
  const balanced = await route({ ...input, agent: 'claude' }, { env: {} });
  assert.ok(balanced.execution.args.includes('--effort'));
  assert.deepEqual(balanced.execution.unsetEnv, ['CLAUDE_CODE_EFFORT_LEVEL']);
  assert.match(balanced.command, /env -u CLAUDE_CODE_EFFORT_LEVEL/);
});
test('cost arithmetic compares same tokens, without inventing effort multipliers', async () => {
  const result = await route({ ...input, prompt: '1234', outputTokens: 2000 }, { env: {} });
  assert.equal(result.costs.inputTokens, 1);
  assert.equal(result.costs.selectedUsd, (2 + 2000 * 10) / 1000000);
  assert.equal(result.costs.deltaVsBalancedUsd, 0);
  assert.equal(result.costs.rows[1].estimatedUsd, result.costs.rows[2].estimatedUsd);
  assert.ok(result.costs.rows[0].deltaVsBalancedUsd < 0);
});
test('invalid inputs stop before any outbound API call', async () => {
  for (const patch of [{ prompt: '' }, { agent: '__proto__' }, { costPriority: 'invalid' }, { outputTokens: -1 }, { outputTokens: '20' }, { prompt: '\u001bBAD' }, { cwd: '/does/not/exist' }]) {
    await assert.rejects(route({ ...input, ...patch }, { env: {}, fetchImpl: () => assert.fail('must not request') }));
  }
});
