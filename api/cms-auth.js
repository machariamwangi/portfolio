import { createHash, randomBytes } from 'node:crypto';

const editorOrigin = 'https://elijahmwangi.net';
const callbackUrl = editorOrigin + '/api/cms-auth';
const cookieName = '__Host-decap-github';
const cookieFlags = '; Path=/; HttpOnly; Secure; SameSite=Lax';

// Decap sends the handshake back before it starts listening for the result.
function finish(res, statusCode, message, token) {
  const nonce = randomBytes(16).toString('base64');
  const result = token
    ? 'authorization:github:success:' + JSON.stringify({ token, provider: 'github' })
    : 'authorization:github:error:' + JSON.stringify({ message });
  const scriptData = JSON.stringify(result).replaceAll('<', '\\u003c');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
  // Only the fixed, locally authored message is rendered as visible text.
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Portfolio sign-in</title>
<p>${message}</p><p>You can close this window and return to the editor.</p>
<script nonce="${nonce}">
  history.replaceState(null, '', '/api/cms-auth');
  const origin = ${JSON.stringify(editorOrigin)};
  const editor = window.opener;
  if (editor) {
    function receive(event) {
      if (event.origin !== origin || event.source !== editor || event.data !== 'authorizing:github') return;
      window.removeEventListener('message', receive);
      editor.postMessage(${scriptData}, origin);
    }
    window.addEventListener('message', receive);
    editor.postMessage('authorizing:github', origin);
  }
</script></html>`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Use GET to sign in.');
  }
  if (req.headers.host?.toLowerCase().replace(/:443$/, '') !== 'elijahmwangi.net') {
    res.statusCode = 403;
    return res.end('Open https://elijahmwangi.net/admin/ to sign in.');
  }

  const { searchParams } = new URL(req.url, editorOrigin);
  const callback = ['code', 'error', 'state'].some(key => searchParams.has(key));
  if (callback) res.setHeader('Set-Cookie', cookieName + '=; Max-Age=0' + cookieFlags);

  const clientId = process.env.CMS_GITHUB_CLIENT_ID;
  const clientSecret = process.env.CMS_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return finish(res, 503, 'Hosted sign-in needs a GitHub OAuth app. Configure its client ID and secret in the Vercel project.');
  }

  if (!callback) {
    if (searchParams.get('provider') !== 'github' || searchParams.get('site_id') !== 'elijahmwangi.net') {
      return finish(res, 400, 'Start GitHub sign-in from the portfolio editor.');
    }
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    res.setHeader('Set-Cookie', `${cookieName}=${state}.${verifier}; Max-Age=600${cookieFlags}`);
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'public_repo',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    res.writeHead(302, { Location: authorize.href });
    return res.end();
  }

  const session = (req.headers.cookie || '').split(/;\s*/)
    .find(cookie => cookie.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const match = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(session || '');
  if (!match || searchParams.getAll('state').length !== 1 || searchParams.get('state') !== match[1]) {
    return finish(res, 400, 'Your sign-in session has expired or changed. Start again from the portfolio editor.');
  }
  if (searchParams.has('error') || !searchParams.get('code') || searchParams.getAll('code').length !== 1) {
    return finish(res, 400, 'GitHub sign-in was cancelled or could not be authorized.');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        code: searchParams.get('code'),
        code_verifier: match[2],
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.access_token === 'string' && data.access_token && data.token_type === 'bearer') {
        return finish(res, 200, 'GitHub sign-in is complete.', data.access_token);
      }
    }
  } catch {
    // The exchange may contain credentials. Show only a fixed error to the editor.
  }
  return finish(res, 502, 'GitHub could not finish sign-in. Try again from the portfolio editor.');
}
