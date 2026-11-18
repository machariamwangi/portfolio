import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../out/', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function isInside(directory, target) {
  const relative = path.relative(directory, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function requestedFile(requestUrl) {
  // Validate the original pathname before URL parsing can normalize away '..'.
  const rawPath = requestUrl.split('?')[0];
  const pathname = decodeURIComponent(rawPath);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\u0000-\u001f\u007f<>:"|?*]/.test(pathname)) {
    throw new Error('Invalid path');
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..' || /[. ]$/.test(segment))) {
    throw new Error('Invalid path');
  }
  const target = path.resolve(outputDirectory, `.${pathname}`);
  if (!isInside(outputDirectory, target)) throw new Error('Invalid path');
  return target;
}

async function findFile(candidate) {
  let target = candidate;
  let info = await stat(target);
  if (info.isDirectory()) {
    target = path.join(target, 'index.html');
    info = await stat(target);
  }
  if (!info.isFile()) return null;
  // Do not follow a symlink out of the generated site directory.
  const [root, resolved] = await Promise.all([realpath(outputDirectory), realpath(target)]);
  if (!isInside(root, resolved)) return null;
  return { filename: resolved, size: info.size };
}

function sendText(response, status, message, method) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(method === 'HEAD' ? undefined : message);
}

function sendFile(request, response, file, status) {
  response.writeHead(status, {
    'Content-Type': mimeTypes[path.extname(file.filename).toLowerCase()] || 'application/octet-stream',
    'Content-Length': file.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(file.filename);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

async function handleRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Method not allowed', request.method);
    return;
  }
  let candidate;
  try {
    candidate = requestedFile(request.url || '/');
  } catch {
    sendText(response, 400, 'Invalid request path', request.method);
    return;
  }
  try {
    const file = await findFile(candidate);
    if (file) {
      sendFile(request, response, file, 200);
      return;
    }
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
  }
  try {
    const notFound = await findFile(path.join(outputDirectory, '404.html'));
    if (notFound) {
      sendFile(request, response, notFound, 404);
      return;
    }
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
  }
  sendText(response, 404, 'Page not found', request.method);
}

export async function startServer({ port = process.env.PORT || 4173 } = {}) {
  const resolvedPort = Number(port);
  if (!Number.isInteger(resolvedPort) || resolvedPort < 0 || resolvedPort > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error('Preview request failed:', error.message);
      if (!response.headersSent) sendText(response, 500, 'Could not serve this page', request.method);
      else response.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(resolvedPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  console.log(`Portfolio preview: http://localhost:${server.address().port}`);
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const server = await startServer();
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      server.close();
      server.closeIdleConnections();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    console.error('Could not start the preview:', error.message);
    process.exitCode = 1;
  }
}
