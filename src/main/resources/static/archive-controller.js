export function createArchiveController({ request, onRestore, showToast }) {
  const dialog = document.querySelector('#archive-dialog');
  const list = document.querySelector('#archive-list');
  let entries = [];
  function render() {
    list.replaceChildren();
    if (!entries.length) { list.textContent = 'Archive is empty. Archived documents stay saved and can be restored.'; return; }
    for (const entry of entries) {
      const row = document.createElement('li'); row.className = 'trash-row';
      const title = document.createElement('strong'); title.textContent = entry.title?.trim() || 'Untitled';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Restore to workspace';
      button.setAttribute('aria-label', `Unarchive: ${title.textContent}`);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const restored = await request(`/api/documents/${entry.id}/organization`, { method: 'PUT',
            body: JSON.stringify({ parentId: null, favorite: entry.favorite, archived: false, rowVersion: entry.rowVersion }) });
          entries = entries.filter((item) => item.id !== entry.id); render(); onRestore(restored);
          showToast('Document restored to your workspace.');
          (list.querySelector('button') || document.querySelector('#archive-close')).focus();
        } catch (error) { showToast(error.message || 'Could not restore this document.'); button.disabled = false; }
      });
      row.append(title, button); list.append(row);
    }
  }
  async function load() {
    list.textContent = 'Loading Archive…';
    document.querySelector('#archive-retry').hidden = true;
    try { entries = await request('/api/documents/archive'); render(); }
    catch { list.textContent = 'Archive could not be loaded. Check your connection and try again.'; document.querySelector('#archive-retry').hidden = false; }
  }
  document.querySelector('#archive-close').addEventListener('click', () => dialog.close());
  document.querySelector('#archive-retry').addEventListener('click', () => void load());
  return { open() { dialog.showModal(); void load(); } };
}
