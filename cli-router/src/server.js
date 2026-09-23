import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CATALOG, PRICING_DATE } from './catalog.js';
import { route } from './router.js';

const ASSETS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 200000) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function equalToken(value, expected) {
  return typeof value === 'string' && value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function startServer({ port = 4317, env = process.env, routeImpl = route } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be between 0 and 65535.');
  const csrfToken = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const allowedHost = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== allowedHost || (req.headers.origin && req.headers.origin !== `http://${allowedHost}`)) {
      return json(res, 403, { error: 'Use this app from its local 127.0.0.1 URL.' });
    }
    const pathname = req.url?.split('?')[0];
    try {
      if (req.method === 'GET' && pathname === '/api/config') {
        return json(res, 200, { cwd: process.cwd(), jevConfigured: Boolean(env.JEV_API_KEY || env.TYPESAFE_API_KEY), csrfToken, catalog: CATALOG, pricingDate: PRICING_DATE });
      }
      if (req.method === 'GET' && Object.hasOwn(ASSETS, pathname)) {
        const [file, contentType] = ASSETS[pathname];
        const bytes = await readFile(new URL(`../public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(bytes);
      }
      if (req.method === 'POST' && pathname === '/api/route') {
        if (!equalToken(req.headers['x-csrf-token'], csrfToken)) return json(res, 403, { error: 'Refresh this page before routing.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || Array.isArray(body) || (body.strict !== undefined && typeof body.strict !== 'boolean')) throw new Error('Invalid routing request.');
        const { prompt, agent, cwd, costPriority, outputTokens } = body;
        const result = await routeImpl({ prompt, agent, cwd, costPriority, outputTokens }, { env });
        if (body.strict && result.source === 'fallback') {
          return json(res, 422, { error: result.reason, code: 'STRICT_ROUTING_FAILED' });
        }
        return json(res, 200, result);
      }
      return json(res, 404, { error: 'Not found.' });
    } catch (error) {
      return json(res, 400, { error: error instanceof SyntaxError ? 'Invalid JSON.' : error.message });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
