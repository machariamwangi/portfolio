import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ServerResponse } from 'node:http';
import { beforeEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import handler from '../api/cms-auth.js';

const editor = 'https://elijahmwangi.net';
const endpoint = '/api/cms-auth';
const start = { provider: 'github', site_id: 'elijahmwangi.net' };
const clientSecret = 'test-only-client-secret';

beforeEach(t => {
  t.mock.property(process, 'env', { ...process.env, CMS_GITHUB_CLIENT_ID: 'test-client', CMS_GITHUB_CLIENT_SECRET: clientSecret });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected token exchange'); });
});

async function request(params, cookie = '') {
  const req = { method: 'GET', url: endpoint + '?' + new URLSearchParams(params), headers: { host: 'elijahmwangi.net', cookie } };
  const res = new ServerResponse(req);
  let body = '';
  res.end = (text = '') => { body = text; };
  await handler(req, res);
  assert.match(res.getHeader('cache-control'), /no-store/);
  assert.ok(!body.includes(clientSecret));
  return { status: res.statusCode, headers: res.getHeaders(), body };
}

test('hosted editing points at the portfolio OAuth function and requests public repository access', async () => {
  const config = await readFile(new URL('../public/admin/config.yml', import.meta.url), 'utf8');
  assert.match(config, /^\s*base_url: https:\/\/elijahmwangi\.net\s*$/m);
  assert.match(config, /^\s*auth_endpoint: api\/cms-auth\s*$/m);
  assert.match(config, /^\s*auth_scope: public_repo\s*$/m);
  assert.match(config, /^publish_mode: editorial_workflow\s*$/m);
});

test('the editor completes a state-bound GitHub PKCE exchange and receives the token after the popup handshake', async () => {
  const first = await request({ ...start, scope: 'repo' });
  assert.equal(first.status, 302);
  const authorize = new URL(first.headers.location);
  assert.equal(authorize.origin + authorize.pathname, 'https://github.com/login/oauth/authorize');
  const params = authorize.searchParams;
  assert.equal(params.get('scope'), 'public_repo');
  assert.equal(params.get('redirect_uri'), editor + endpoint);
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.ok(params.get('state'));
  assert.ok(!authorize.href.includes(clientSecret));
  const cookie = first.headers['set-cookie'];
  for (const flag of ['__Host-', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=600']) assert.ok(cookie.includes(flag), flag);

  const token = 'test-only-editor-token';
  fetch.mock.mockImplementation(() => Response.json({ token_type: 'bearer', access_token: token }));
  const completed = await request({ code: 'test-code', state: params.get('state') }, cookie.split(';')[0]);
  assert.equal(completed.status, 200);
  assert.match(completed.headers['set-cookie'], /Max-Age=0/);
  assert.equal(completed.headers['referrer-policy'], 'no-referrer');
  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://github.com/login/oauth/access_token');
  assert.equal(options.method, 'POST');
  const exchange = new URLSearchParams(options.body);
  assert.equal(exchange.get('client_secret'), clientSecret);
  assert.equal(exchange.get('redirect_uri'), editor + endpoint);
  assert.equal(exchange.get('code'), 'test-code');
  assert.equal(createHash('sha256').update(exchange.get('code_verifier')).digest('base64url'), params.get('code_challenge'));

  const messages = [];
  const popup = Object.assign(new EventTarget(), { opener: { postMessage: (message, target) => messages.push([message, target]) } });
  const script = completed.body.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(script, 'the callback must start the Decap popup handshake');
  runInNewContext(script[1], { window: popup, history: { replaceState() {} } }, { timeout: 1000 });
  const handshake = 'authorizing:github';
  function reply(origin, source) {
    popup.dispatchEvent(Object.assign(new Event('message'), { origin, source, data: handshake }));
  }
  reply('https://other.example', popup.opener);
  reply(editor, {});
  assert.deepEqual(messages, [[handshake, editor]]);
  reply(editor, popup.opener);
  reply(editor, popup.opener);
  assert.equal(messages.length, 2);
  const [result, target] = messages[1];
  const prefix = 'authorization:github:success:';
  assert.equal(target, editor);
  assert.ok(result.startsWith(prefix));
  assert.deepEqual(JSON.parse(result.slice(prefix.length)), { token, provider: 'github' });
});

test('cancelled sign-in or a mismatched state ends without a token exchange', async () => {
  const { headers } = await request(start);
  const cookie = headers['set-cookie'].split(';')[0];
  const state = new URL(headers.location).searchParams.get('state');
  for (const params of [{ error: 'access_denied', state }, { code: 'test-code', state: 'different' }]) {
    const failed = await request(params, cookie);
    assert.equal(failed.status, 400);
    assert.match(failed.headers['set-cookie'], /Max-Age=0/);
    assert.match(failed.body, /authorization:github:error:/);
    assert.doesNotMatch(failed.body, /authorization:github:success:/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('missing GitHub configuration gives the editor a setup error before authorization', async () => {
  delete process.env.CMS_GITHUB_CLIENT_ID;
  const failed = await request(start);
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.location, undefined);
  assert.match(failed.body, /GitHub OAuth app/i);
  assert.equal(fetch.mock.callCount(), 0);
});
