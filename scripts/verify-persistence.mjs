import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

// Runs only against a fresh temporary H2 file, or an explicitly supplied TEST database.
const temporary = await mkdtemp(join(tmpdir(), 'squareone-persistence-'));
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const jars = (await readdir('build/libs')).filter((name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'));
assert.equal(jars.length, 1, 'Run ./gradlew bootJar first');
let processHandle;
let output = '';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function start() {
  output = '';
  processHandle = spawn('java', ['-jar', `build/libs/${jars[0]}`,
    '--spring.config.import=', '--debug=false', '--logging.level.root=WARN',
    `--server.port=${port}`, '--server.address=127.0.0.1',
    `--spring.profiles.active=${process.env.SQUAREONE_TEST_PROFILE || (process.env.SQUAREONE_TEST_DATABASE_URL?.startsWith('jdbc:postgresql:') ? '' : 'h2-test')}`,
    `--server.servlet.session.cookie.secure=${process.env.SQUAREONE_TEST_PROFILE === 'production'}`,
    '--spring.sql.init.mode=never', '--spring.flyway.baseline-on-migrate=false',
    `--DATABASE_SCHEMA=${process.env.SQUAREONE_TEST_DATABASE_SCHEMA || 'PUBLIC'}`,
    `--spring.datasource.url=${process.env.SQUAREONE_TEST_DATABASE_URL || `jdbc:h2:file:${join(temporary, 'database')}`}`,
    `--spring.datasource.username=${process.env.SQUAREONE_TEST_DATABASE_USERNAME || 'sa'}`,
    `--spring.datasource.password=${process.env.SQUAREONE_TEST_DATABASE_PASSWORD || ''}`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  processHandle.stdout.on('data', (chunk) => { output += chunk; });
  processHandle.stderr.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 240; attempt++) {
    if (processHandle.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try { if ((await fetch(`${base}/api/documents/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await wait(250);
  }
  throw new Error(`Server startup timed out: ${output}`);
}
async function stop() {
  if (!processHandle || processHandle.exitCode !== null) return;
  const child = processHandle;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
}
class Browser {
  cookies = new Map();
  async request(path, { method = 'GET', body, status = 200 } = {}) {
    const headers = { Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ') };
    if (!['GET', 'HEAD'].includes(method)) {
      const csrf = await this.request('/api/auth/csrf');
      headers[csrf.headerName] = csrf.token;
      headers.Cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    }
    if (body) headers['Content-Type'] = body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json';
    const response = await fetch(`${base}${path}`, { method, headers, body: body instanceof URLSearchParams ? body.toString() : body ? JSON.stringify(body) : undefined });
    for (const cookie of response.headers.getSetCookie()) {
      if (process.env.SQUAREONE_TEST_PROFILE === 'production' && cookie.startsWith('JSESSIONID=')) {
        assert.match(cookie, /;\s*Secure/i, 'Production session cookies must be Secure');
      }
      const [pair] = cookie.split(';'); const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const text = await response.text();
    assert.equal(response.status, status, `${method} ${path}: ${text}`);
    return text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  }
}
try {
  await start();
  const guest = new Browser();
  const account = new Browser();
  const guestSession = await guest.request('/api/auth/session');
  const guestNote = await guest.request('/api/documents', { method: 'POST', status: 201, body: { title: 'Guest restart', content: '<p>Private guest content Ω हिन्दी</p>' } });
  await account.request('/api/auth/session');
  const note = await account.request('/api/documents', { method: 'POST', status: 201 });
  const email = `release-${Date.now()}@example.test`;
  await account.request('/api/auth/signup', { method: 'POST', status: 201, body: { name: 'Release check', email, password: 'releasePass123' } });
  await account.request('/api/auth/login', { method: 'POST', status: 204, body: new URLSearchParams({ email, password: 'releasePass123' }) });
  const identity = await account.request('/api/auth/session');
  assert.equal(identity.authenticated, true);
  assert.equal((await account.request(`/api/documents/${note.id}`)).ownerId, identity.userId);
  await guest.request(`/api/documents/${note.id}`, { status: 404 });
  const contentJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich Ω हिन्दी' }] }] };
  const saved = await account.request(`/api/documents/${note.id}`, { method: 'PUT', body: { title: 'Saved note', content: '<p>Rich Ω हिन्दी</p>', contentJson, revision: 1 } });
  assert.equal(saved.revision, 2);
  assert.deepEqual(saved.contentJson, contentJson);
  await account.request(`/api/documents/${note.id}`, { method: 'PUT', status: 409, body: { title: 'Stale', content: 'Do not overwrite', revision: 1 } });
  const versions = await account.request(`/api/documents/${note.id}/versions`);
  assert.equal(versions.length, 2);
  const restored = await account.request(`/api/documents/${note.id}/versions/${versions.find((v) => v.revision === 1).id}/restore`, { method: 'POST', body: { revision: saved.revision } });
  assert.equal(restored.revision, 3);
  assert.equal(restored.content, '');
  const prefs = { theme: 'dark', sidebarWidth: 300, widePage: true, fontFamily: 'serif', fontSize: 22, collapsedDocumentIds: [note.id] };
  await account.request('/api/preferences', { method: 'PATCH', body: prefs });
  await account.request('/api/preferences', { method: 'PATCH', body: { fontSize: 100 }, status: 400 });
  await guest.request('/api/preferences', { status: 401 });
  const workspace = await account.request('/api/workspaces', { method: 'POST', status: 201, body: { name: 'Second workspace', description: 'Isolated space' } });
  const otherNote = await account.request('/api/documents', { method: 'POST', status: 201, body: { workspaceId: workspace.id, title: 'Separate', content: 'Separate body' } });
  assert.equal((await account.request(`/api/documents?workspaceId=${workspace.id}`))[0].id, otherNote.id);
  await guest.request(`/api/documents?workspaceId=${workspace.id}`, { status: 404 });
  await account.request(`/api/documents/${note.id}/organization`, { method: 'PUT', body: { parentId: otherNote.id }, status: 404 });
  const archived = await account.request(`/api/documents/${note.id}/organization`, { method: 'PUT', body: { archived: true, rowVersion: restored.rowVersion } });
  assert.equal((await account.request('/api/documents')).length, 0);
  assert.equal((await account.request('/api/documents/archive'))[0].id, note.id);
  const active = await account.request(`/api/documents/${note.id}/organization`, { method: 'PUT', body: { archived: false, rowVersion: archived.rowVersion } });
  await account.request(`/api/documents/${note.id}/appearance`, { method: 'PUT', body: { icon: '✳', coverRef: '/cover.png', rowVersion: active.rowVersion } });
  await account.request(`/api/documents/${note.id}/appearance`, { method: 'PUT', status: 409, body: { icon: 'Stale', rowVersion: active.rowVersion } });
  const unsecured = await fetch(`${base}/api/documents`, { method: 'POST' });
  assert.equal(unsecured.status, 403, 'CSRF must remain required');
  const home = await fetch(base);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  await stop();
  await start();
  assert.equal((await guest.request('/api/auth/session')).workspaceId, guestSession.workspaceId);
  assert.equal((await guest.request(`/api/documents/${guestNote.id}`)).content, guestNote.content);
  assert.equal((await account.request('/api/auth/session')).authenticated, true, 'Login must survive server restart');
  assert.equal((await account.request(`/api/documents/${note.id}`)).icon, '✳');
  const persistedPreferences = await account.request('/api/preferences');
  for (const [key, value] of Object.entries(prefs)) assert.deepEqual(persistedPreferences[key], value);
  assert.equal((await account.request(`/api/documents/${note.id}/versions`)).length, 3);
  console.log('PASS: restart preserves guest/account sessions, notes, JSON, preferences, workspaces and history; stale writes, ownership and CSRF are enforced.');
} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
