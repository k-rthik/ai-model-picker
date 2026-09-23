import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from '../src/server.js';

test('local UI routes real fallback with CSRF and strict handling; cannot execute', async t => {
  const { server, url } = await startServer({ port: 0, env: {} });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const config = await fetch(`${url}/api/config`).then(r => r.json());
  assert.equal(config.jevConfigured, false);
  assert.equal(config.catalog.codex.length, 4);
  assert.equal('key' in config, false);
  const send = (body, extraHeaders = {}) => fetch(`${url}/api/route`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': config.csrfToken, ...extraHeaders }, body: JSON.stringify(body),
  });
  const input = { prompt: 'Test route only', agent: 'codex', cwd: process.cwd(), costPriority: 'cost' };
  const accepted = await send(input);
  const result = await accepted.json();
  assert.equal(accepted.status, 200);
  assert.equal(result.model, 'gpt-6-sol');
  assert.equal(result.source, 'fallback');
  assert.match(result.command, /codex/);
  const strict = await send({ ...input, strict: true });
  assert.equal(strict.status, 422);
  assert.equal((await strict.json()).code, 'STRICT_ROUTING_FAILED');
  assert.equal((await send(input, { 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await send(input, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(`${url}/api/run`, { method: 'POST' })).status, 404);
  assert.equal((await send({ ...input, outputTokens: -3 })).status, 400);
  const badHostStatus = await new Promise(resolve => {
    http.get(`${url}/api/config`, { headers: { Host: 'evil.example' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
  });
  assert.equal(badHostStatus, 403);
});

test('HTTP handler forwards only allowed fields and no arbitrary native arguments', async t => {
  let received;
  const { server, url } = await startServer({ port: 0, env: {}, routeImpl: async input => { received = input; return { source: 'jev', model: 'test' }; } });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const config = await fetch(`${url}/api/config`).then(r => r.json());
  const response = await fetch(`${url}/api/route`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': config.csrfToken },
    body: JSON.stringify({ prompt: 'hello', agent: 'claude', nativeArgs: ['--dangerously-skip-permissions'], environment: 'private', command: 'sh' }),
  });
  assert.equal(response.status, 200);
  assert.equal('nativeArgs' in received, false);
  assert.equal('environment' in received, false);
  assert.equal('command' in received, false);
});
