const DEFAULTS = Object.freeze({
  theme: 'system', sidebarMode: 'expanded', sidebarWidth: 260,
  widePage: false, focusMode: false, fontFamily: 'sans', fontSize: 18,
  lineHeight: 1.75, documentSort: 'updated', collapsedDocumentIds: [],
});

export function createPreferencesController({ request, getCurrentUser, apply, showToast }) {
  let settings = { ...DEFAULTS };
  let pending = {};
  let scope = null;
  let queue = Promise.resolve();
  let failed = false;
  const status = document.querySelector('#preferences-status');
  const retry = document.querySelector('#preferences-retry');
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function cache() {
    try {
      localStorage.setItem(`squareone.preferences.v1:${scope}`, JSON.stringify(settings));
      if (getCurrentUser().authenticated) localStorage.setItem(`squareone.preferences-pending.v1:${scope}`, JSON.stringify(pending));
    } catch (error) { console.warn('Unable to cache preferences:', error); }
  }
  function showStatus(text = '') {
    status.textContent = text;
    retry.hidden = !failed;
  }
  async function flush() {
    if (!getCurrentUser().authenticated) return true;
    const operationScope = scope;
    const operation = queue.then(async () => {
      if (scope !== operationScope) return false;
      if (!Object.keys(pending).length) return !failed;
      const patch = pending; pending = {};
      showStatus('Saving settings…');
      try {
        const saved = await request('/api/preferences', { method: 'PATCH', body: JSON.stringify(patch) });
        if (scope !== operationScope) return false;
        settings = { ...saved, ...pending };
        failed = false; cache(); showStatus('Settings saved'); return true;
      } catch {
        pending = { ...patch, ...pending }; failed = true; cache();
        showStatus('Settings are waiting to sync.');
        showToast('Settings could not be saved. Retry when connected.'); return false;
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }
  async function load() {
    const user = getCurrentUser();
    scope = user.authenticated ? user.userId : `guest:${user.workspaceId}`;
    pending = {}; failed = false;
    if (user.authenticated) {
      settings = { ...DEFAULTS, ...await request('/api/preferences') };
      pending = read(`squareone.preferences-pending.v1:${scope}`, {});
      settings = { ...settings, ...pending };
    } else {
      const cached = read(`squareone.preferences.v1:${scope}`, null);
      const organization = read(`squareone.organization.v1:${user.workspaceId}`, {});
      let legacy = {};
      try {
        legacy = {
          theme: localStorage.getItem('squareone.theme.v1') || 'system',
          sidebarMode: localStorage.getItem('squareone.sidebar-mode.v1') || 'expanded',
          sidebarWidth: Number(localStorage.getItem('squareone.sidebar-width.v1')) || 260,
          widePage: localStorage.getItem('squareone.wide-page.v1') === 'true',
          documentSort: organization.sort || 'updated', collapsedDocumentIds: organization.collapsed || [],
        };
      } catch { /* Browser caches are optional. */ }
      settings = { ...DEFAULTS, ...legacy, ...(cached || {}) };
    }
    apply(settings); cache(); showStatus();
    if (Object.keys(pending).length) void flush();
  }
  function update(patch) {
    if (!scope) return;
    settings = { ...settings, ...patch };
    if (getCurrentUser().authenticated) pending = { ...pending, ...patch };
    apply(settings); cache();
    if (getCurrentUser().authenticated) void flush();
    else showStatus('Settings saved in this browser');
  }
  retry.addEventListener('click', () => void flush());
  window.addEventListener('online', () => void flush());
  return { load, update, flush, get settings() { return settings; } };
}
