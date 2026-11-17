import { Editor } from './vendor/editor.js?v=31';
import { createEditorExtensions } from './editor-extensions.js?v=31';

export function createDocumentDetails({ request, getActiveDocument, syncPendingChanges, onUpdate, showToast }) {
  const history = document.querySelector('#history-dialog');
  const list = document.querySelector('#version-list');
  const preview = document.querySelector('#version-preview');
  const restore = document.querySelector('#version-restore');
  const details = document.querySelector('#document-details-dialog');
  let current = null, selected = null, editor = null;
  let previewRequest = 0;
  function failure(message) { document.querySelector('#history-status').textContent = message; }
  async function selectVersion(summary) {
    const requestId = ++previewRequest;
    restore.disabled = true; failure('Loading version…');
    try {
      const version = await request(`/api/documents/${current.id}/versions/${summary.id}`);
      if (requestId !== previewRequest || !history.open) return;
      selected = version;
      document.querySelector('#version-preview-title').textContent = version.title || 'Untitled';
      editor?.destroy(); preview.replaceChildren();
      editor = new Editor({ element: preview, editable: false, extensions: createEditorExtensions(),
        content: version.contentJson || version.content || '',
        editorProps: { attributes: { class: 'tiptap-content', 'aria-label': 'Version content preview' } } });
      list.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.versionId === version.id)));
      restore.disabled = version.revision === current.revision;
      restore.textContent = `Restore revision ${version.revision}`;
      failure(`Revision ${version.revision} · ${new Date(version.createdAt).toLocaleString()}`);
    } catch (error) { if (requestId === previewRequest) failure(error.message || 'Could not load this version.'); }
  }
  async function loadHistory() {
    list.replaceChildren(); restore.disabled = true; failure('Loading history…');
    try {
      current = await request(`/api/documents/${current.id}`); onUpdate(current);
      await request(`/api/documents/${current.id}/versions`, { method: 'POST' });
      const versions = await request(`/api/documents/${current.id}/versions`);
      for (const version of versions) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.versionId = version.id;
        button.textContent = `Revision ${version.revision} · ${new Date(version.createdAt).toLocaleString()}`;
        button.addEventListener('click', () => void selectVersion(version)); list.append(button);
      }
      if (versions.length) await selectVersion(versions[0]); else failure('No versions are available.');
    } catch (error) { failure(error.message || 'Could not load history. Try again.'); }
  }
  restore.addEventListener('click', async () => {
    if (!selected || !current || !(await syncPendingChanges())) return;
    if (!window.confirm(`Restore revision ${selected.revision}? Your current version will also be kept in history.`)) return;
    restore.disabled = true;
    try {
      const restored = await request(`/api/documents/${current.id}/versions/${selected.id}/restore`, {
        method: 'POST', body: JSON.stringify({ revision: current.revision }),
      });
      onUpdate(restored); history.close(); showToast('Earlier version restored. The previous version is still in history.');
    } catch (error) { failure(error.message || 'Could not restore this version.'); restore.disabled = false; }
  });
  document.querySelector('#history-close').addEventListener('click', () => history.close());
  document.querySelector('#history-retry').addEventListener('click', () => void loadHistory());
  history.addEventListener('close', () => { ++previewRequest; editor?.destroy(); editor = null; selected = null; });
  document.querySelector('#document-details-close').addEventListener('click', () => details.close());
  document.querySelector('#document-details-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#document-details-save'); submit.disabled = true;
    try {
      const entry = getActiveDocument(); if (!entry) return;
      const updated = await request(`/api/documents/${entry.id}/appearance`, { method: 'PUT', body: JSON.stringify({
        icon: document.querySelector('#document-icon-input').value,
        coverRef: document.querySelector('#document-cover-input').value, rowVersion: entry.rowVersion,
      }) });
      onUpdate(updated); details.close(); showToast('Document details saved.');
    } catch (error) { document.querySelector('#document-details-error').textContent = error.message || 'Could not save document details.'; }
    finally { submit.disabled = false; }
  });
  return {
    async openHistory() {
      if (!(await syncPendingChanges())) { showToast('Sync or resolve your pending edits before opening history.'); return; }
      current = getActiveDocument(); if (!current) return;
      history.showModal(); await loadHistory();
    },
    async openDetails() {
      if (!(await syncPendingChanges())) { showToast('Sync your pending edits before changing document details.'); return; }
      const entry = getActiveDocument(); if (!entry) return;
      document.querySelector('#document-icon-input').value = entry.icon || '';
      document.querySelector('#document-cover-input').value = entry.coverRef || '';
      document.querySelector('#document-details-error').textContent = ''; details.showModal();
    },
  };
}
