import { test, expect } from '@playwright/test';

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
});
test.afterEach(() => expect(errors).toEqual([]));

async function open(page) {
  await page.goto('/');
  await expect(page.locator('#workspace-loading')).toBeHidden();
  await expect(page.locator('#workspace-error')).toBeHidden();
}
async function mutate(page, method, path, data) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const response = await page.request.fetch(path, { method, data, headers: { [csrf.headerName]: csrf.token } });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function note(page, content = '<p>Start here.</p>', title = 'Writing room') {
  await open(page);
  const entry = await mutate(page, 'POST', '/api/documents', { title, content });
  await page.reload();
  await page.locator('#home-recent button').filter({ hasText: title }).click();
  await expect(page.locator('#editor-dock')).toBeVisible();
  return entry;
}
async function saved(page) {
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
}
async function more(page, label) {
  await page.getByRole('button', { name: 'More block commands', exact: true }).click();
  await page.locator('#editor-command-menu').getByRole('menuitem', { name: label, exact: true }).click();
}
const richBlocks = '<details open><summary>Project notes</summary><div data-type="detailsContent"><p>Nested writing stays here.</p></div></details>'
  + '<p>November 18, 2026</p><img src="https://images.example.test/diagram.png" alt="Architecture sketch"><p>After the image.</p>';

test('existing HTML stays unchanged, long titles grow, and Enter moves into the body', async ({ page }) => {
  const entry = await note(page, '<p>Existing <strong>bold</strong> writing.</p>');
  expect((await (await page.request.get(`/api/documents/${entry.id}`)).json()).revision).toBe(entry.revision);
  await page.setViewportSize({ width: 390, height: 844 });
  const title = page.getByRole('textbox', { name: 'Document title', exact: true });
  const long = 'A long document title that wraps naturally and gives every thought enough room to grow';
  await title.fill(long);
  const dimensions = await title.evaluate(el => ({ height: el.clientHeight, line: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(dimensions.height).toBeGreaterThan(dimensions.line * 2);
  await title.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeFocused();
  await saved(page);
  const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(stored.title).toBe(long);
  expect(stored.title).not.toContain('\n');
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(title).toHaveValue(long);
  expect((await title.boundingBox()).height).toBeGreaterThan(dimensions.line * 2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => (await title.boundingBox()).height).toBeLessThan(dimensions.height);
});

test('dark, light and system themes use neutral surfaces without altering document colors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await note(page, '<p><span style="color: #d44c47">Chosen color</span> <mark data-color="#fef3c7" style="background-color: #fef3c7">Chosen highlight</mark></p>');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(25, 25, 25)');
  for (const [theme, color] of [['light', 'rgb(247, 247, 244)'], ['dark', 'rgb(10, 10, 10)'], ['system', 'rgb(10, 10, 10)']]) {
    await page.locator('#account-menu-trigger').click();
    await page.locator('#account-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('body')).toHaveCSS('background-color', color);
    await expect(page.locator('.tiptap-content span')).toHaveCSS('color', 'rgb(212, 76, 71)');
    await expect(page.locator('.tiptap-content mark')).toHaveCSS('background-color', 'rgb(254, 243, 199)');
    if (await page.locator('#account-theme').isVisible()) await page.locator('#account-menu-trigger').click();
  }
});

test('slash menu has the requested order, keyboard selection, filtering and empty state', async ({ page }) => {
  await note(page, '<p></p>');
  const editor = page.locator('#editor .tiptap-content');
  await editor.fill('/');
  const menu = page.getByRole('listbox', { name: 'Block commands', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.locator('.slash-command-title')).toHaveText([
    'Heading 1', 'Heading 2', 'Heading 3', 'Table', 'Dropdown', 'Bulleted list', 'Checklist',
    'Code block', 'Date', 'Divider', 'Image', 'Numbered list', 'Quote', 'Callout',
  ]);
  for (let index = 0; index < 13; index++) await editor.press('ArrowDown');
  const active = menu.getByRole('option', { name: 'Callout', exact: true });
  await expect(active).toHaveAttribute('aria-selected', 'true');
  await expect(editor).toHaveAttribute('aria-activedescendant', await active.getAttribute('id'));
  const bounds = await menu.boundingBox();
  const optionBounds = await active.boundingBox();
  expect(optionBounds.y + optionBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await editor.fill('/zzzzzz');
  await expect(page.locator('#slash-command-empty')).toHaveText('No matching commands');
  await editor.fill('/todo');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await editor.press('Enter');
  await expect(editor.locator('ul[data-type="taskList"]')).toBeVisible();
  await expect(editor).not.toContainText('/todo');
  await expect(editor).toBeFocused();
});

test('slashes in URLs and code stay literal, Escape dismisses, and IME keys do not execute commands', async ({ page }) => {
  await note(page, '<p></p>');
  const editor = page.locator('.tiptap-content');
  await editor.fill('https://example.com/a/b');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await editor.fill('/code');
  await editor.press('Enter');
  await expect(editor.locator('pre')).toBeVisible();
  await editor.pressSequentially('/table');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await expect(editor.locator('pre')).toContainText('/table');
  await page.getByRole('button', { name: 'Text style', exact: true }).click();
  await page.locator('#editor-command-menu').getByRole('menuitem', { name: 'Text', exact: true }).click();
  await editor.fill('/table');
  await editor.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(editor.locator('table')).toHaveCount(0);
  await expect(editor).toHaveText('/table');
  await editor.press('Escape');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
});

test('bottom toolbar inserts and transforms blocks without a slash query', async ({ page }) => {
  await note(page, '<p>Keep these words.</p>');
  const editor = page.locator('.tiptap-content');
  await editor.click();
  await page.getByRole('button', { name: 'Text style', exact: true }).click();
  await page.locator('#editor-command-menu').getByRole('menuitem', { name: 'Heading 2', exact: true }).click();
  await expect(editor.locator('h2')).toHaveText('Keep these words.');
  await editor.press('ControlOrMeta+End');
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(editor.locator('table')).toBeVisible();
  await expect(editor.locator('td')).toHaveCount(9);
  await editor.locator('td p').first().click();
  await editor.pressSequentially('A cell');
  await editor.press('ControlOrMeta+Enter');
  await page.getByRole('button', { name: 'Toggle checklist', exact: true }).click();
  await expect(editor.locator('[data-type="taskList"]')).toBeVisible();
  await expect(editor.locator('h2')).toHaveText('Keep these words.');
  await saved(page);
});

test('date insertion uses the saved cursor and the selected local calendar day', async ({ page }) => {
  await note(page, '<p>Before after</p>');
  const editor = page.locator('.tiptap-content');
  await editor.fill('Before after');
  for (let index = 0; index < 5; index++) await editor.press('ArrowLeft');
  await more(page, 'Date');
  await expect(page.locator('#editor-dock')).toBeHidden();
  await page.getByLabel('Date', { exact: true }).fill('2026-11-18');
  await page.locator('#editor-insert-dialog').getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(editor).toHaveText('Before November 18, 2026after');
  await expect(editor).toBeFocused();
  await saved(page);
});

test('image dialog validates HTTPS and keeps a readable failure state after reload', async ({ page }) => {
  const entry = await note(page, '<p>Before the photo.</p>');
  await page.locator('.tiptap-content').press('ControlOrMeta+End');
  await page.getByRole('button', { name: 'Insert image', exact: true }).click();
  await page.getByLabel('HTTPS image URL', { exact: true }).fill('http://images.example.test/missing.png');
  await page.locator('#editor-insert-dialog').getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.locator('#editor-insert-error')).toContainText('HTTPS');
  await page.getByLabel('HTTPS image URL', { exact: true }).fill('https://images.example.test/missing.png');
  await page.getByLabel('Alt text (optional)', { exact: true }).fill('A useful photo description');
  await page.locator('#editor-insert-dialog').getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.locator('.editor-image figcaption')).toHaveText("Image couldn't load: A useful photo description");
  await saved(page);
  const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(stored.content).toContain('<img');
  expect(stored.contentJson.content.some(node => node.type === 'image')).toBe(true);
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(page.locator('.editor-image figcaption')).toContainText('A useful photo description');
  const text = await (await page.request.get(`/api/documents/${entry.id}/export/txt`)).text();
  expect(text).toContain('A useful photo description (https://images.example.test/missing.png)');
});

test('switching documents cancels an open insertion dialog', async ({ page }) => {
  const entry = await note(page);
  await page.getByRole('button', { name: 'Insert image', exact: true }).click();
  await page.getByLabel('HTTPS image URL', { exact: true }).fill('https://images.example.test/photo.png');
  await page.goBack();
  await expect(page.locator('#welcome-state')).toBeVisible();
  await expect(page.locator('#editor-insert-dialog')).not.toBeVisible();
  const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(stored.content).not.toContain('<img');
});

test('dropdown open state, nested content, images and dates survive reload and duplication', async ({ page }) => {
  const entry = await note(page, richBlocks, 'Persistent blocks');
  const editor = page.locator('#editor .tiptap-content');
  await expect(editor.locator('summary')).toHaveText('Project notes');
  await editor.locator('[data-type="detailsContent"] p').fill('Updated nested writing.');
  await editor.getByRole('button', { name: 'Collapse dropdown', exact: true }).click();
  await saved(page);
  const stored = await (await page.request.get(`/api/documents/${entry.id}`)).json();
  expect(stored.contentJson.content.find(node => node.type === 'details').attrs.open).toBe(false);
  expect(stored.content).toContain('<details>');
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(editor.getByRole('button', { name: 'Expand dropdown', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Expand dropdown', exact: true }).click();
  await expect(editor.locator('[data-type="detailsContent"]')).toContainText('Updated nested writing.');
  await saved(page);
  await page.getByRole('button', { name: 'Open document: Persistent blocks', exact: true }).hover();
  await page.getByLabel('Actions for Persistent blocks', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('#title-input')).toHaveValue('Persistent blocks (copy)');
  await expect(editor.locator('summary')).toHaveText('Project notes');
  await expect(editor.locator('.editor-image img')).toHaveAttribute('src', 'https://images.example.test/diagram.png');
  await expect(editor).toContainText('November 18, 2026');
});

test('new blocks retain content through history restoration and offline draft recovery', async ({ page }) => {
  const entry = await note(page, richBlocks, 'Recover these blocks');
  const editor = page.locator('#editor .tiptap-content');
  await editor.click();
  await editor.press('ControlOrMeta+a');
  await page.keyboard.insertText('A later plain version.');
  await saved(page);
  await page.getByLabel('Share and export document', { exact: true }).click();
  await page.locator('#open-history').click();
  await page.locator('#version-list button').filter({ hasText: 'Revision 1 ·' }).click();
  await expect(page.locator('#version-restore')).toHaveText('Restore revision 1');
  await expect(page.locator('#version-preview summary')).toHaveText('Project notes');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#version-restore').click();
  await expect(page.locator('#history-dialog')).not.toBeVisible();
  await expect(editor.locator('summary')).toHaveText('Project notes');
  await page.route('**/api/documents/*', route => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await editor.locator('[data-type="detailsContent"] p').fill('Offline nested writing.');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'local');
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(editor.locator('[data-type="detailsContent"]')).toContainText('Offline nested writing.');
  await expect(editor.locator('.editor-image img')).toHaveAttribute('src', 'https://images.example.test/diagram.png');
  await expect(editor).toContainText('November 18, 2026');
  await page.unroute('**/api/documents/*');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await saved(page);
  const text = await (await page.request.get(`/api/documents/${entry.id}/export/txt`)).text();
  expect(text).toContain('Project notes');
  expect(text).toContain('Offline nested writing.');
  expect(text).toContain('Architecture sketch (https://images.example.test/diagram.png)');
  await page.locator('#workspace-home').click();
  await page.locator('#search').fill('Architecture sketch');
  await expect(page.locator(`#document-tree-${entry.id}`)).toBeVisible();
});

test('dropdown insertion works from slash and toolbar, and whole-block reordering can be undone', async ({ page }) => {
  await note(page, '<p>First paragraph.</p><p></p>');
  const editor = page.locator('.tiptap-content');
  await editor.locator(':scope > p').last().fill('/toggle');
  await editor.press('Enter');
  await expect(editor.locator('summary')).toBeVisible();
  await editor.locator('summary').fill('A movable dropdown');
  await editor.locator('[data-type="detailsContent"] p').fill('Keep its nested content.');
  await editor.press('Alt+ArrowUp');
  await expect(editor.locator(':scope > :first-child')).toHaveAttribute('data-type', 'details');
  await editor.press('ControlOrMeta+z');
  await expect(editor.locator(':scope > p').first()).toHaveText('First paragraph.');
  await expect(editor.locator('[data-type="detailsContent"]')).toContainText('Keep its nested content.');
  await editor.press('ControlOrMeta+End');
  await page.getByRole('button', { name: 'Insert dropdown', exact: true }).click();
  await expect(editor.locator('summary')).toHaveCount(2);
});

test('toolbar follows the actual workspace, wide mode expands, and focus restores sidebar state', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1100 });
  await note(page, '<h2>An outline heading</h2><p>Some writing.</p>');
  const dock = page.locator('#editor-dock');
  async function centered() {
    await expect.poll(async () => {
      const d = await dock.boundingBox();
      const w = await page.locator('.workspace').boundingBox();
      return Math.abs(d.x + d.width / 2 - w.x - w.width / 2);
    }).toBeLessThan(2);
  }
  await centered();
  const normal = (await page.locator('#editor').boundingBox()).width;
  await page.locator('#wide-page-toggle').click();
  await expect.poll(async () => (await page.locator('#editor').boundingBox()).width).toBeGreaterThan(normal + 80);
  await page.getByRole('button', { name: 'Text style', exact: true }).click();
  await page.locator('#sidebar-resize-handle').focus();
  await page.keyboard.press('End');
  await centered();
  await expect(page.locator('#editor-command-menu')).toBeVisible();
  const menu = await page.locator('#editor-command-menu').boundingBox();
  const workspace = await page.locator('.workspace').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(workspace.x);
  expect(menu.x + menu.width).toBeLessThanOrEqual(workspace.x + workspace.width);
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-compact/);
  await centered();
  await page.locator('#focus-toggle').click();
  await centered();
  await expect(page.locator('#document-outline-pane')).toBeHidden();
  await page.locator('#focus-toggle').click();
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-compact/);
  await centered();
});

test('mobile viewport changes, drawers and dialogs keep floating controls clear of writing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await note(page, '<p>Writing on a phone.</p>');
  const dock = page.locator('#editor-dock');
  await page.locator('#sidebar-toggle').click();
  await expect(dock).toBeHidden();
  await page.locator('#sidebar-close').click();
  await expect(dock).toBeVisible();
  await page.getByRole('button', { name: 'Insert image', exact: true }).click();
  await expect(dock).toBeHidden();
  await page.getByRole('button', { name: 'Cancel insertion', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { width: 390, height: 400, offsetTop: 0, offsetLeft: 0 } });
    window.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => { const d = await dock.boundingBox(); return d.y + d.height; }).toBeLessThanOrEqual(382);
  await expect(page.locator('#editor')).toHaveCSS('padding-bottom', '588px');
  await page.locator('.tiptap-content').fill('/');
  const menu = page.locator('#slash-command-menu');
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(400);
});

test('focus mode keeps unsynced-save messages and recovery controls visible on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await note(page);
  await page.locator('#focus-toggle').click();
  await page.route('**/api/documents/*', route => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await page.locator('.tiptap-content').fill('An offline edit.');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'local');
  await expect(page.locator('#save-status')).toBeInViewport();
  await expect(page.locator('#retry-sync')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Back to workspace', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('loaded body images fit a narrow document and remain selectable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('https://images.example.test/wide.svg', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="#808080"/></svg>' }));
  await note(page, '<p>Before an image.</p><img src="https://images.example.test/wide.svg" alt="A wide sketch"><p>After an image.</p>');
  const image = page.getByRole('img', { name: 'A wide sketch', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBe(1600);
  const box = await image.boundingBox();
  const documentBox = await page.locator('.tiptap-content').boundingBox();
  expect(box.width).toBeLessThanOrEqual(documentBox.width);
  expect(Math.abs(box.width / box.height - 2)).toBeLessThan(0.02);
  await image.click();
  await expect(page.locator('.editor-image')).toHaveClass(/ProseMirror-selectednode/);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.tiptap-content')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('table resizing, navigation, column actions and whole-table movement preserve cells', async ({ page }) => {
  const entry = await note(page, '<p>Above the table.</p><table><tbody><tr><td><p>One</p></td><td><p>Two</p></td></tr><tr><td><p>Three</p></td><td><p>Four</p></td></tr></tbody></table><p>Below the table.</p>');
  const editor = page.locator('.tiptap-content');
  const cell = editor.locator('td').first();
  await cell.locator('p').click();
  const before = await cell.boundingBox();
  await page.mouse.move(before.x + before.width - 2, before.y + before.height / 2);
  await expect(editor).toHaveClass(/resize-cursor/);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 58, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await cell.boundingBox()).width).toBeGreaterThan(before.width + 35);
  await cell.locator('p').click();
  await editor.press('Tab');
  expect(await page.evaluate(() => window.getSelection().anchorNode.parentElement.closest('td').cellIndex)).toBe(1);
  await page.getByRole('button', { name: 'Table actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Insert column after', exact: true }).click();
  await expect(editor.locator('tr').first().locator('td')).toHaveCount(3);
  await cell.locator('p').click();
  await editor.press('Alt+ArrowUp');
  await expect(editor.locator(':scope > :first-child')).toHaveClass('tableWrapper');
  await editor.press('ControlOrMeta+z');
  await expect(editor.locator(':scope > p').first()).toHaveText('Above the table.');
  await expect(editor.locator('td').first()).toHaveText('One');
  await expect(editor.locator('td').nth(4)).toHaveText('Four');
  await cell.locator('p').click();
  await editor.press('ControlOrMeta+Enter');
  await page.keyboard.insertText('A paragraph after the table.');
  await expect(editor.locator('.tableWrapper + p')).toHaveText('A paragraph after the table.');
  await saved(page);
  expect((await (await page.request.get(`/api/documents/${entry.id}`)).json()).content).toContain('colwidth=');
});

test('writing preferences persist without replacing the active editor or its undo history', async ({ page }) => {
  await note(page, '<p>Keep writing.</p>');
  await page.locator('#guest-signup').click();
  await page.locator('#account-name-input').fill('Writing preferences tester');
  await page.locator('#account-email-input').fill(`writing-${Date.now()}@example.test`);
  await page.locator('#account-password-input').fill('BrowserTestPass123!');
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  const editor = page.locator('#editor .tiptap-content');
  await editor.fill('One continuous thought');
  await editor.evaluate(el => { window.originalWritingEditor = el; });
  await saved(page);
  await page.locator('#account-menu-trigger').click();
  await page.locator('#account-settings').click();
  await page.getByRole('combobox', { name: 'Font', exact: true }).selectOption('serif');
  await page.getByLabel('Font size', { exact: true }).fill('22');
  await page.getByLabel('Line height', { exact: true }).fill('1.9');
  await page.getByRole('button', { name: 'Save writing preferences', exact: true }).click();
  await expect(page.locator('#preferences-status')).toHaveText('Settings saved');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveCSS('font-size', '22px');
  await expect(editor).toHaveCSS('line-height', '41.8px');
  expect(await editor.evaluate(el => el === window.originalWritingEditor)).toBe(true);
  await editor.pressSequentially(' continues.');
  await expect(editor).toHaveText('One continuous thought continues.');
  await saved(page);
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveText('One continuous thought');
  await saved(page);
  await page.reload();
  await page.locator('#home-recent button').click();
  await expect(editor).toHaveCSS('font-size', '22px');
  await expect(editor).toHaveCSS('line-height', '41.8px');
  await expect(editor).toHaveText('One continuous thought');
});

test('block menus and selected-text formatting work from the keyboard', async ({ page }) => {
  await note(page, '<p></p>');
  const editor = page.locator('.tiptap-content');
  await editor.fill('Keyboard writing');
  const style = page.getByRole('button', { name: 'Text style', exact: true });
  await style.focus();
  await style.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(editor.locator('h1')).toHaveText('Keyboard writing');
  await editor.press('ControlOrMeta+a');
  const bold = page.getByRole('toolbar', { name: 'Text formatting', exact: true }).getByRole('button', { name: 'Bold', exact: true });
  await bold.focus();
  await bold.press('Enter');
  await expect(editor.locator('h1 strong')).toHaveText('Keyboard writing');
  await page.locator('#focus-toggle').click();
  await style.focus();
  await style.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-command-menu')).toBeHidden();
  await expect(page.locator('.app-shell')).toHaveClass(/focus-mode/);
  await saved(page);
});

test.describe('touch block insertion', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test('slash commands and the bottom toolbar accept taps', async ({ page }) => {
    await note(page, '<p></p>');
    const editor = page.locator('.tiptap-content');
    await editor.fill('/todo');
    await page.getByRole('option', { name: 'Checklist', exact: true }).tap();
    await expect(editor.locator('[data-type="taskList"]')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle checklist', exact: true }).tap();
    await expect(editor.locator('[data-type="taskList"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Insert dropdown', exact: true }).tap();
    await expect(editor.locator('summary')).toBeVisible();
    await editor.getByRole('button', { name: 'Collapse dropdown', exact: true }).tap();
    await expect(editor.getByRole('button', { name: 'Expand dropdown', exact: true })).toBeVisible();
    await saved(page);
  });
});

test('mouse dragging moves a whole dropdown and undo preserves its nested writing', async ({ page }) => {
  await note(page, '<p>Above the dropdown.</p><details open><summary>Move these notes</summary><div data-type="detailsContent"><p>Keep the whole block.</p></div></details><p>Below the dropdown.</p>');
  const editor = page.locator('.tiptap-content');
  await editor.locator('summary').hover();
  await expect(page.getByRole('button', { name: 'Move dropdown block', exact: true })).toBeVisible();
  await page.locator('#block-drag-button').dragTo(editor.locator(':scope > p').first(), { targetPosition: { x: 20, y: 1 } });
  await expect(editor.locator(':scope > :first-child')).toHaveAttribute('data-type', 'details');
  await editor.locator('summary').click();
  await editor.press('ControlOrMeta+z');
  await expect(editor.locator(':scope > p').first()).toHaveText('Above the dropdown.');
  await expect(editor.locator('[data-type="detailsContent"]')).toHaveText('Keep the whole block.');
  await saved(page);
});
