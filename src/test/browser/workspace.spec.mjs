import { test, expect } from '@playwright/test';

let pageErrors;
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Startup and editing must work without any external CDN or font request.
  await page.route('https://**/*', (route) => route.abort());
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function openWorkspace(page) {
  await page.goto('/');
  await expect(page.locator('#workspace-loading')).toBeHidden();
  await expect(page.locator('#workspace-error')).toBeHidden();
}
async function mutate(page, method, url, data) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const response = await page.request.fetch(url, {
    method, headers: { [csrf.headerName]: csrf.token }, data,
  });
  expect(response.ok(), `${method} ${url}: ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function createDocument(page, title, content = '') {
  const entry = await mutate(page, 'POST', '/api/documents');
  return mutate(page, 'PUT', `/api/documents/${entry.id}`, { title, content });
}
async function saved(page) {
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
}

test('startup failure shows recovery and retry opens the workspace', async ({ page }) => {
  await page.route('**/appdocs.js*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#workspace-error')).toBeVisible();
  await expect(page.locator('#workspace-loading')).toBeHidden();
  await page.unroute('**/appdocs.js*');
  await page.locator('#workspace-retry').click();
  await expect(page.locator('#welcome-state')).toBeVisible();
});

test('stalled session request times out with a retry action', async ({ page }) => {
  await page.route('**/api/auth/session', () => {});
  await page.goto('/');
  await expect(page.locator('#workspace-error')).toBeVisible({ timeout: 16000 });
  await expect(page.locator('#workspace-error-message')).toContainText('timed out');
  await expect(page.locator('#workspace-retry')).toBeVisible();
});

test('home opens, creates a document, and shows recent notes and favorites', async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator('#home-empty')).toBeVisible();
  await page.locator('#welcome-create').click();
  await page.locator('#title-input').fill('My first note');
  await page.locator('.tiptap-content').fill('A thought to return to.');
  await saved(page);
  await page.locator('#workspace-home').click();
  await expect(page.locator('#home-summary')).toHaveText('1 document in your space');
  await expect(page.locator('#home-recent')).toContainText('My first note');
  await expect(page.locator('#home-recent')).toContainText('A thought to return to.');
  await page.locator('#home-recent button').click();
  await expect(page.locator('#title-input')).toHaveValue('My first note');
  const [entry] = await (await page.request.get('/api/documents')).json();
  await mutate(page, 'PUT', `/api/documents/${entry.id}/organization`, { parentId: null, favorite: true });
  await page.reload();
  await expect(page.locator('#home-favorites')).toContainText('My first note');
});

test('local edits survive reload and sync on reconnect without false success', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Original');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  await page.route('**/api/documents/*', (route) => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await page.locator('#title-input').fill('Unsynced draft');
  await page.locator('.tiptap-content').fill('Keep these offline edits.');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'local');
  await page.reload();
  await expect(page.locator('#workspace-loading')).toBeHidden();
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'local');
  await page.locator(`#document-tree-${entry.id}`).click();
  await expect(page.locator('#title-input')).toHaveValue('Unsynced draft');
  await expect(page.locator('#save-status-text')).toContainText('Waiting to sync');
  await page.unroute('**/api/documents/*');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await saved(page);
  const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(stored.title).toBe('Unsynced draft');
  expect(stored.content).toContain('Keep these offline edits.');
});

test('trash restores content and permanently deletes only after confirmation', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Recover me', '<p>A note worth keeping.</p>');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#delete-document').click();
  await expect(page.locator(`#document-tree-${entry.id}`)).toHaveCount(0);
  await page.locator('#open-trash').click();
  await page.getByRole('button', { name: 'Restore: Recover me', exact: true }).click();
  await expect(page.locator('#trash-list')).toContainText('Trash is empty');
  await page.locator('#trash-close').click();
  await page.locator(`#document-tree-${entry.id}`).click();
  await expect(page.locator('.tiptap-content')).toContainText('A note worth keeping.');
  await page.locator('#delete-document').click();
  await page.locator('#open-trash').click();
  await page.getByRole('button', { name: 'Delete permanently: Recover me', exact: true }).click();
  await expect(page.locator('#trash-list')).toContainText('Trash is empty');
  expect((await page.request.get(`/api/documents/${entry.id}`)).status()).toBe(404);
});

test('sort and tree collapse persist; search reveals matching descendants', async ({ page }) => {
  await openWorkspace(page);
  const parent = await createDocument(page, 'Zebra');
  const child = await createDocument(page, 'Apple');
  await createDocument(page, 'Middle');
  await mutate(page, 'PUT', `/api/documents/${child.id}/organization`, { parentId: parent.id, favorite: false });
  await page.reload();
  await page.locator('#document-sort').selectOption('title');
  await expect(page.locator('#document-list > .document-tree > li > .document-tree-row .document-item-title')).toHaveText(['Middle', 'Zebra']);
  await page.locator('#collapse-all').click();
  await expect(page.locator(`#document-tree-${child.id}`)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#document-sort')).toHaveValue('title');
  await expect(page.locator(`#document-tree-${child.id}`)).toHaveCount(0);
  await page.locator('#search').fill('Apple');
  await expect(page.locator(`#document-tree-${child.id}`)).toBeVisible();
  await page.locator('#search').fill('');
  await page.locator('#expand-all').click();
  await expect(page.locator(`#document-tree-${child.id}`)).toBeVisible();
  await page.locator(`[data-tree-toggle="${parent.id}"]`).click();
  await expect(page.locator(`#document-tree-${child.id}`)).toHaveCount(0);
  await page.locator('#document-sort').selectOption('created');
  await expect(page.locator('#document-list > .document-tree > li > .document-tree-row .document-item-title')).toHaveText(['Middle', 'Zebra']);
});

test('theme switching and persisted preferences never block startup', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openWorkspace(page);
  for (const mode of ['light', 'dark', 'system']) {
    await page.locator('#account-menu-trigger').click();
    await page.locator('#account-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await page.reload();
    await expect(page.locator('#welcome-state')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  }
});

test('guest guidance explains storage and signup transfers notes and Trash', async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator('#guest-notice')).toContainText('linked to this browser session');
  await page.locator('#guest-notice summary').click();
  await expect(page.locator('#guest-notice')).toContainText('30 days');
  const active = await createDocument(page, 'Guest note', '<p>Take this into my account.</p>');
  const trashed = await createDocument(page, 'Guest trash');
  await mutate(page, 'DELETE', `/api/documents/${trashed.id}`);
  await page.reload();
  await page.locator('#guest-signup').click();
  await expect(page.locator('#account-dialog-copy')).toContainText('including Trash');
  await page.locator('#account-name-input').fill('Workspace tester');
  await page.locator('#account-email-input').fill(`workspace-${Date.now()}@example.test`);
  await page.locator('#account-password-input').fill('BrowserTestPass123!');
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  await expect(page.locator('#guest-notice')).not.toBeVisible();
  await expect(page.locator(`#document-tree-${active.id}`)).toBeVisible();
  await page.locator('#open-trash').click();
  await expect(page.locator('#trash-list')).toContainText('Guest trash');
  await page.locator('#trash-close').click();
  await page.locator('#account-menu-trigger').click();
  await page.locator('#account-logout').click();
  await expect(page.locator('#guest-notice')).toBeVisible();
  await expect(page.locator('#home-summary')).toHaveText('0 documents in your space');
  await expect(page.locator(`#document-tree-${active.id}`)).toHaveCount(0);
});

test('account switching is blocked while server changes are unsynced', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Guest pending edits');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  await page.route('**/api/documents/*', (route) => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await page.locator('#title-input').fill('Only in this browser');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'local');
  await page.locator('#guest-signup').click();
  await page.locator('#account-name-input').fill('Workspace tester');
  await page.locator('#account-email-input').fill(`pending-${Date.now()}@example.test`);
  await page.locator('#account-password-input').fill('BrowserTestPass123!');
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-form-error')).toContainText('Sync your pending changes');
  expect((await (await page.request.get('/api/auth/session')).json()).authenticated).toBe(false);
});

test('workspace home and Trash work at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await expect(page.locator('#welcome-create')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#sidebar-toggle').click();
  await page.locator('#open-trash').click();
  await expect(page.locator('#trash-dialog')).toBeVisible();
  await expect(page.locator('#trash-list')).toContainText('Trash is empty');
  await page.locator('#trash-close').click();
  await page.locator('#sidebar-toggle').click();
  await page.locator('#workspace-home').click();
  await expect(page.locator('#welcome-state')).toBeVisible();
  await page.locator('#sidebar-toggle').click();
  await page.locator('#guest-signup').click();
  await expect(page.locator('#account-name-input')).toBeEditable();
  await page.locator('#account-dialog-close').click();
});

test('an older save response cannot overwrite edits typed while it was pending', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Initial note');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  let releaseFirstSave;
  const firstSaveGate = new Promise((resolve) => { releaseFirstSave = resolve; });
  let firstSaveSeen;
  const firstSave = new Promise((resolve) => { firstSaveSeen = resolve; });
  let delayed = false;
  await page.route('**/api/documents/*', async (route) => {
    if (route.request().method() === 'PUT' && !delayed) {
      delayed = true;
      firstSaveSeen();
      await firstSaveGate;
    }
    await route.continue();
  });
  await page.locator('#title-input').fill('Earlier edit');
  await firstSave;
  await page.locator('#title-input').fill('Latest edit');
  releaseFirstSave();
  await saved(page);
  await expect(page.locator('#title-input')).toHaveValue('Latest edit');
  expect((await (await page.request.get(`/api/documents/${entry.id}`)).json()).title).toBe('Latest edit');
});

test('failed browser storage never claims local edits are saved', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Storage verification');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('squareone.document-draft')) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.route('**/api/documents/*', (route) => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await page.locator('#title-input').fill('Not saved yet');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#save-status-text')).toContainText('Changes not saved');
  await page.unroute('**/api/documents/*');
  await page.locator('#retry-sync').click();
  await saved(page);
  expect((await (await page.request.get(`/api/documents/${entry.id}`)).json()).title).toBe('Not saved yet');
});

test('archived notes remain reachable and can be restored from Archive', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Put away for later', '<p>Keep this archive body.</p>');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).hover();
  await page.getByLabel('Actions for Put away for later', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Archive', exact: true }).click();
  await expect(page.locator(`#document-tree-${entry.id}`)).toHaveCount(0);
  await page.locator('#open-archive').click();
  await expect(page.locator('#archive-list')).toContainText('Put away for later');
  await page.getByLabel('Unarchive: Put away for later', { exact: true }).click();
  await expect(page.locator('#archive-list')).toContainText('Archive is empty');
  await page.locator('#archive-close').click();
  await page.locator(`#document-tree-${entry.id}`).click();
  await expect(page.locator('#editor .tiptap-content')).toContainText('Keep this archive body.');
});

test('rich formatting, version previews, restore and document details work together', async ({ page }) => {
  await openWorkspace(page);
  const html = '<h1>Rich heading</h1><p><strong>Bold text</strong> <u>Underlined text</u> <a href="https://example.com">A link</a> <span style="color: #ff0000">Color text</span></p><table><tbody><tr><td><p>Cell one</p></td><td><p>Cell two</p></td></tr></tbody></table>';
  const entry = await createDocument(page, 'Original rich note', html);
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  await expect(page.locator('#editor h1')).toHaveText('Rich heading');
  await expect(page.locator('#editor strong')).toHaveText('Bold text');
  await expect(page.locator('#editor u')).toHaveText('Underlined text');
  await expect(page.locator('#editor a')).toHaveAttribute('href', 'https://example.com');
  await expect(page.locator('#editor td')).toHaveCount(2);
  await page.locator('#title-input').fill('Later rich note');
  await saved(page);
  await page.getByLabel('Share and export document', { exact: true }).click();
  await page.locator('#open-history').click();
  await page.locator('#version-list button').filter({ hasText: 'Revision 2 ·' }).click();
  await expect(page.locator('#version-preview h1')).toHaveText('Rich heading');
  await expect(page.locator('#version-preview td')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#version-restore').click();
  await expect(page.locator('#history-dialog')).not.toBeVisible();
  await expect(page.locator('#title-input')).toHaveValue('Original rich note');
  await page.getByLabel('Share and export document', { exact: true }).click();
  await page.locator('#open-document-details').click();
  await page.locator('#document-icon-input').fill('🌿');
  await page.locator('#document-details-save').click();
  await expect(page.locator('#document-details-dialog')).not.toBeVisible();
  await expect(page.locator(`#document-tree-${entry.id} .document-item-icon`)).toHaveText('🌿');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  await expect(page.locator('#editor strong')).toHaveText('Bold text');
  await expect(page.locator('#editor td')).toHaveCount(2);
});

test('conflicting edits can be recovered as a copy without overwriting server content', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Shared starting point', '<p>Original body</p>');
  await page.reload();
  await page.locator(`#document-tree-${entry.id}`).click();
  const current = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  await mutate(page, 'PUT', `/api/documents/${entry.id}`, { title: 'Other device title', content: '<p>Other device body</p>', revision: current.revision });
  await page.locator('#title-input').fill('This browser title');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#retry-sync')).toHaveText('Resolve changes');
  await page.locator('#retry-sync').click();
  await page.locator('#conflict-copy').click();
  await expect(page.locator('#conflict-dialog')).not.toBeVisible();
  await expect(page.locator('#title-input')).toHaveValue('This browser title (recovered copy)');
  const server = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(server.title).toBe('Other device title');
  expect(server.content).toContain('Other device body');
  await saved(page);
});

test('slow signup prevents duplicate submissions and login can be retried after a bad password', async ({ page }) => {
  await openWorkspace(page);
  await page.locator('#guest-signup').click();
  const email = `auth-flow-${Date.now()}@example.test`;
  const password = 'AuthFlowTestPass123!';
  await page.locator('#account-name-input').fill('Auth flow tester');
  await page.locator('#account-email-input').fill(email);
  await page.locator('#account-password-input').fill(password);
  let signupRequests = 0;
  let releaseSignup;
  const held = new Promise((resolve) => { releaseSignup = resolve; });
  await page.route('**/api/auth/signup', async (route) => {
    signupRequests += 1;
    await held;
    await route.continue();
  });
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-submit')).toBeDisabled();
  await expect(page.locator('#account-submit')).toHaveText('Creating account…');
  await expect(page.locator('#account-mode-toggle')).toBeDisabled();
  await expect(page.locator('#account-form')).toHaveAttribute('aria-busy', 'true');
  await page.locator('#account-form').dispatchEvent('submit');
  releaseSignup();
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  expect(signupRequests).toBe(1);
  await page.locator('#account-menu-trigger').click();
  await page.locator('#account-logout').click();
  await expect(page.locator('#guest-notice')).toBeVisible();
  await page.locator('#guest-login').click();
  await page.locator('#account-email-input').fill(email);
  await page.locator('#account-password-input').fill('WrongPassword123!');
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-form-error')).toHaveText('Invalid email or password');
  await expect(page.locator('#account-submit')).toBeEnabled();
  await expect(page.locator('#account-submit')).toHaveText('Log in');
  await page.locator('#account-password-input').fill(password);
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  await expect(page.locator('#account-menu-name')).toHaveText('Auth flow tester');
});

test('recent cards open before refresh finishes and a delayed response cannot replace newer edits', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Open recent immediately', '<p>Previously saved content.</p>');
  await page.reload();
  let releaseRefresh;
  const held = new Promise((resolve) => { releaseRefresh = resolve; });
  await page.route(`**/api/documents/${entry.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.locator('#home-recent button').click();
    await expect(page.locator('#editor')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('#title-input')).toHaveValue('Open recent immediately');
    await page.locator('#editor .tiptap-content').fill('New edits made while refresh is pending.');
    await saved(page);
    const refreshed = page.waitForResponse((response) => response.url().endsWith(`/api/documents/${entry.id}`) && response.request().method() === 'GET');
    releaseRefresh();
    await (await refreshed).finished();
    // Another save must use the latest revision, even after that older GET arrives.
    await page.locator('#title-input').fill('Latest recent edits');
    await saved(page);
    const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
    expect(stored.title).toBe('Latest recent edits');
    expect(stored.content).toContain('New edits made while refresh is pending.');
    await expect(page.locator('#editor .tiptap-content')).toContainText('New edits made while refresh is pending.');
  } finally { releaseRefresh(); }
});

test('a recent card remains clickable when a background save completes during the click', async ({ page }) => {
  await openWorkspace(page);
  const entry = await createDocument(page, 'Keep my recent edits', '<p>Earlier content.</p>');
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(page.locator('#editor')).toBeVisible();
  let releaseSave;
  const held = new Promise((resolve) => { releaseSave = resolve; });
  await page.route(`**/api/documents/${entry.id}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.locator('#editor .tiptap-content').fill('My recent edits are still syncing.');
    await page.locator('#workspace-home').click();
    await expect(page.locator('#welcome-state')).toBeVisible({ timeout: 1000 });
    const card = page.locator('#home-recent button');
    const bounds = await card.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    releaseSave();
    await saved(page);
    await page.mouse.up();
    await expect(page.locator('#editor')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('#editor .tiptap-content')).toContainText('My recent edits are still syncing.');
  } finally { releaseSave(); }
});
