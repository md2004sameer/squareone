const API_URL = "/api/documents";
const SAVE_DELAY = 650;

export function createDocumentController({
  elements,
  getDocuments,
  setDocuments,
  getActiveDocumentId,
  setActiveDocumentId,
  getEditorUi,
  documentStorage,
  documentUi,
  setSaveStatus,
  showToast,
}) {
  const {
    loadLocalDraft,
    loadLocalDraftDocuments,
    removeLocalDraft,
    request,
    saveLocalDraft,
  } = documentStorage;
  let saveTimer = null;
  let saveQueue = Promise.resolve();
  let documentOpenRequest = 0;

  const pendingDocumentIds = new Set();
  const conflictedDocumentIds = new Set();
  const locallySavedIds = new Set();
  let syncing = false;
  let syncFailed = false;

  function refreshSaveStatus() {
    if (conflictedDocumentIds.size) {
      setSaveStatus("error", "Another device saved changes");
      document.querySelector("#retry-sync").textContent = "Resolve changes";
      return;
    }
    document.querySelector("#retry-sync").textContent = "Retry sync";
    if (pendingDocumentIds.size === 0) {
      setSaveStatus("saved", "Saved");
    } else if (syncing) {
      setSaveStatus("saving", "Syncing changes…");
    } else if ([...pendingDocumentIds].every((id) => locallySavedIds.has(id))) {
      setSaveStatus("local", "Saved locally · Waiting to sync");
    } else if (syncFailed || !navigator.onLine) {
      setSaveStatus("error", "Changes not saved · Retry sync");
    } else {
      setSaveStatus("waiting", "Waiting to sync…");
    }
  }

  function rememberDraft(entry) {
    if (saveLocalDraft(entry)) locallySavedIds.add(entry.id);
    else locallySavedIds.delete(entry.id);
  }

  function scheduleSave() {
    const activeDocument = getDocuments().find((entry) => entry.id === getActiveDocumentId());
    if (!activeDocument) return;
    activeDocument.title = elements.title.value;
    activeDocument.content = getEditorUi().editor.getHTML();
    activeDocument.contentJson = getEditorUi().editor.getJSON();
    activeDocument.updatedAt = Date.now();
    activeDocument.pendingSync = true;
    pendingDocumentIds.add(activeDocument.id);
    rememberDraft(activeDocument);
    documentUi.showDocumentOutline(activeDocument);
    elements.date.textContent = `Last edited ${documentUi.formatDate(activeDocument.updatedAt)}`;
    documentUi.renderList();
    refreshSaveStatus();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveDocument(activeDocument.id), SAVE_DELAY);
  }

  async function saveDocument(documentId) {
    const operation = saveQueue.then(async () => {
      const current = getDocuments().find((entry) => entry.id === documentId);
      if (!current || !pendingDocumentIds.has(documentId)) return true;
      if (conflictedDocumentIds.has(documentId)) return false;
      const snapshot = { title: current.title, content: current.content, contentJson: current.contentJson, revision: current.revision };
      syncing = true;
      refreshSaveStatus();
      try {
        const saved = await request(`${API_URL}/${encodeURIComponent(documentId)}`, {
          method: "PUT", body: JSON.stringify(snapshot),
        });
        const latest = getDocuments().find((entry) => entry.id === documentId);
        if (!latest) return true;
        const hasNewerEdits = latest.title !== snapshot.title || latest.content !== snapshot.content
          || JSON.stringify(latest.contentJson) !== JSON.stringify(snapshot.contentJson);
        latest.revision = saved.revision;
        latest.rowVersion = saved.rowVersion;
        if (!hasNewerEdits) {
          Object.assign(latest, { ...saved, pendingSync: false });
          pendingDocumentIds.delete(documentId);
          rememberDraft(latest);
        }
        rememberDraft(latest);
        syncFailed = false;
        documentUi.renderList();
        if (getActiveDocumentId() === documentId) {
          elements.date.textContent = `Last edited ${documentUi.formatDate(latest.updatedAt)}`;
        }
        return true;
      } catch (error) {
        if (error.status === 409) {
          conflictedDocumentIds.add(documentId);
          rememberDraft(current);
          showToast("Another device saved changes. Your draft is safe here; resolve changes to continue syncing.");
        }
        if (!syncFailed && error.status !== 409) showToast(locallySavedIds.has(documentId)
          ? "Changes are saved in this browser. They will sync when the connection returns."
          : "Changes couldn't be saved. Keep this tab open and retry sync.");
        syncFailed = true;
        console.error("Unable to sync document:", error);
        return false;
      } finally {
        syncing = false;
        refreshSaveStatus();
      }
    });
    saveQueue = operation.catch(() => {});
    return operation;
  }

  async function flushSave() {
    window.clearTimeout(saveTimer);
    const activeDocumentId = getActiveDocumentId();
    if (!activeDocumentId) return true;
    const synced = await saveDocument(activeDocumentId);
    return synced || locallySavedIds.has(activeDocumentId);
  }

  async function syncPendingChanges() {
    window.clearTimeout(saveTimer);
    for (const id of [...pendingDocumentIds]) await saveDocument(id);
    refreshSaveStatus();
    return pendingDocumentIds.size === 0;
  }

  function resetSyncState() {
    pendingDocumentIds.clear();
    conflictedDocumentIds.clear();
    locallySavedIds.clear();
    syncFailed = false;
  }

  window.addEventListener("online", () => void syncPendingChanges());
  window.addEventListener("offline", refreshSaveStatus);
  window.addEventListener("beforeunload", (event) => {
    if ([...pendingDocumentIds].some((id) => !locallySavedIds.has(id))) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function restoreLocalEdits(server) {
    const memory = pendingDocumentIds.has(server.id) ? getDocuments().find((entry) => entry.id === server.id) : null;
    const draft = memory || loadLocalDraft(server.id);
    if (!draft?.pendingSync || (draft.title === server.title && draft.content === server.content
        && (!draft.contentJson || JSON.stringify(draft.contentJson) === JSON.stringify(server.contentJson)))) return server;
    const restored = { ...server, title: draft.title, content: draft.content, contentJson: draft.contentJson || null,
      updatedAt: draft.updatedAt, pendingSync: true };
    pendingDocumentIds.add(server.id);
    if (loadLocalDraft(server.id)) locallySavedIds.add(server.id);
    if (draft.revision !== server.revision) conflictedDocumentIds.add(server.id);
    return restored;
  }

  function clearWorkspaceState() {
    ++documentOpenRequest;
    resetSyncState();
    setDocuments([]); setActiveDocumentId(null);
  }

  async function resolveConflicts() {
    const id = [...conflictedDocumentIds][0];
    const entry = getDocuments().find((document) => document.id === id);
    if (!entry) return;
    const dialog = document.querySelector("#conflict-dialog");
    document.querySelector("#conflict-document-title").textContent = entry.title?.trim() || "Untitled";
    dialog.showModal();
  }

  async function finishConflict(copyDraft) {
    const id = [...conflictedDocumentIds][0];
    const entry = getDocuments().find((document) => document.id === id);
    if (!entry) return;
    if (!copyDraft && !window.confirm("Use the saved version and discard this browser's unsynced edits?")) return;
    const controls = [...document.querySelectorAll("#conflict-dialog button")];
    controls.forEach((button) => { button.disabled = true; });
    try {
      let copy;
      if (copyDraft) copy = await request(API_URL, { method: "POST", body: JSON.stringify({
        title: `${(entry.title?.trim() || "Untitled").slice(0, 140)} (recovered copy)`, content: entry.content,
        contentJson: entry.contentJson, workspaceId: entry.workspaceId,
      }) });
      let server;
      try { server = await request(`${API_URL}/${encodeURIComponent(id)}`); }
      catch (error) { if (error.status !== 404) throw error; }
      setDocuments(getDocuments().filter((document) => document.id !== id));
      if (server && !server.archived) getDocuments().push(server);
      if (copy) getDocuments().push(copy);
      pendingDocumentIds.delete(id); conflictedDocumentIds.delete(id); locallySavedIds.delete(id); removeLocalDraft(id);
      setActiveDocumentId(copy?.id || (server && !server.archived ? server.id : null));
      document.querySelector("#conflict-dialog").close();
      documentUi.renderEditor(); documentUi.renderList(); refreshSaveStatus();
      showToast(copyDraft ? "Your draft was saved as a new document. The other device's changes are preserved." : "Showing the saved version.");
    } catch (error) { showToast(error.message || "Couldn't resolve changes. Your draft is still safe here."); }
    finally { controls.forEach((button) => { button.disabled = false; }); }
  }
  document.querySelector("#conflict-copy").addEventListener("click", () => void finishConflict(true));
  document.querySelector("#conflict-use-server").addEventListener("click", () => void finishConflict(false));
  document.querySelector("#conflict-close").addEventListener("click", () => document.querySelector("#conflict-dialog").close());

  async function openDocument(documentId) {
    const requestId = ++documentOpenRequest;
    if (!(await flushSave())) {
      return;
    }
    let selectedDocument = getDocuments().find((entry) => entry.id === documentId);
    if (!selectedDocument) {
      showToast("Couldn't find that document. Please refresh and try again.");
      return;
    }

    try {
      const fetchedDocument = await request(`${API_URL}/${encodeURIComponent(documentId)}`);
      if (requestId !== documentOpenRequest) {
        return;
      }
      selectedDocument = restoreLocalEdits(fetchedDocument);
      const documents = getDocuments();
      const index = documents.findIndex((entry) => entry.id === documentId);
      if (index !== -1) documents[index] = selectedDocument;
      if (pendingDocumentIds.has(documentId) && !conflictedDocumentIds.has(documentId)) void saveDocument(documentId);
    } catch (error) {
      console.error("Unable to fetch document:", error);
      showToast("Couldn't refresh this document. Showing its last loaded version.");
    }

    if (requestId !== documentOpenRequest) {
      return;
    }
    setActiveDocumentId(selectedDocument.id);
    documentUi.renderEditor();
    documentUi.renderList();
    refreshSaveStatus();
  }

  async function showHome() {
    if (!(await flushSave())) return;
    ++documentOpenRequest;
    setActiveDocumentId(null);
    elements.appShell.classList.remove("focus-mode");
    elements.focusToggle.setAttribute("aria-pressed", "false");
    elements.focusToggle.textContent = "Focus";
    documentUi.renderEditor();
    documentUi.renderList();
    refreshSaveStatus();
  }

  async function createDocument() {
    if (!elements.workspaceLoading.hidden || !elements.workspaceError.hidden) {
      return;
    }
    if (!(await flushSave())) {
      return;
    }
    try {
      const createdDocument = await request(API_URL, { method: "POST" });
      getDocuments().unshift(createdDocument);
      setActiveDocumentId(createdDocument.id);
      elements.search.value = "";
      documentUi.renderEditor();
      documentUi.renderList();
      elements.title.focus();
      elements.title.select();
      refreshSaveStatus();
    } catch (error) {
      showToast("Couldn't create a document. Please try again.");
      console.error("Unable to create document:", error);
    }
  }

  async function deleteDocument(documentId = getActiveDocumentId()) {
    if (!documentId) return;
    if (!(await syncPendingChanges())) {
      showToast("Sync your pending changes before moving a document to Trash.");
      return;
    }
    const document = getDocuments().find((entry) => entry.id === documentId);
    const title = document?.title?.trim() || "Untitled";
    if (!window.confirm(`Move “${title}” to Trash? You can restore it later. Its child documents will move to the workspace root.`)) {
      return;
    }

    try {
      await request(`${API_URL}/${encodeURIComponent(documentId)}`, { method: "DELETE" });
      removeLocalDraft(documentId);
      pendingDocumentIds.delete(documentId);
      locallySavedIds.delete(documentId);
      getDocuments().forEach((entry) => {
        if (entry.parentId === documentId) {
          entry.parentId = null;
        }
      });
      setDocuments(getDocuments().filter((entry) => entry.id !== documentId));
      if (getActiveDocumentId() === documentId) {
        setActiveDocumentId(null);
        documentUi.renderEditor();
      } else {
        const activeDocument = getDocuments().find((entry) => entry.id === getActiveDocumentId());
        documentUi.updateBreadcrumb(activeDocument || null);
      }
      documentUi.renderList();
      refreshSaveStatus();
      showToast("Moved to Trash. You can restore it from the sidebar.");
    } catch (error) {
      showToast("Couldn't delete this document. Please try again.");
      console.error("Unable to delete document:", error);
    }
  }

  async function updateOrganization(documentId, parentId, favorite, extra = {}) {
    if (!(await syncPendingChanges())) {
      showToast("Sync your pending changes before organizing documents."); return false;
    }
    const document = getDocuments().find((entry) => entry.id === documentId);
    if (!document) {
      return;
    }
    try {
      const updatedDocument = await request(
        `${API_URL}/${encodeURIComponent(documentId)}/organization`,
        {
          method: "PUT",
          body: JSON.stringify({ parentId: parentId || null, favorite, rowVersion: document.rowVersion, ...extra }),
        },
      );
      const refreshed = await request(API_URL);
      setDocuments(refreshed.map((entry) => restoreLocalEdits(entry)));
      if (!getDocuments().some((entry) => entry.id === getActiveDocumentId())) {
        setActiveDocumentId(null); documentUi.renderEditor();
      }
      const activeDocument = getDocuments().find((entry) => entry.id === getActiveDocumentId());
      documentUi.updateBreadcrumb(activeDocument || null);
      documentUi.renderList(); refreshSaveStatus();
      if (extra.archived) showToast("Document archived. Find it in Archive.");
      return true;
    } catch (error) {
      showToast(error.message || "Couldn't update this document. Please try again.");
      console.error("Unable to update document organization:", error);
      return false;
    }
  }

  async function archiveDocument(documentId) {
    const entry = getDocuments().find((document) => document.id === documentId);
    if (entry) return updateOrganization(documentId, entry.parentId, entry.favorite, { archived: true });
    return false;
  }
  async function reorderDocument(documentId, direction) {
    const entry = getDocuments().find((document) => document.id === documentId);
    if (entry) return updateOrganization(documentId, entry.parentId, entry.favorite, { direction });
    return false;
  }
  function applyServerDocument(server) {
    const entries = getDocuments();
    const index = entries.findIndex((entry) => entry.id === server.id);
    if (index === -1) entries.push(server); else entries[index] = server;
    pendingDocumentIds.delete(server.id); conflictedDocumentIds.delete(server.id);
    rememberDraft({ ...server, pendingSync: false });
    documentUi.renderList();
    if (getActiveDocumentId() === server.id) documentUi.renderEditor();
    refreshSaveStatus();
  }

  async function toggleFavorite(documentId) {
    const document = getDocuments().find((entry) => entry.id === documentId);
    if (document) {
      await updateOrganization(documentId, document.parentId, !document.favorite);
    }
  }

  async function moveDocument(documentId, parentId) {
    const document = getDocuments().find((entry) => entry.id === documentId);
    if (document && (document.parentId || null) !== (parentId || null)) {
      await updateOrganization(documentId, parentId, Boolean(document.favorite));
    }
  }

  async function duplicateDocument(documentId) {
    if (!(await syncPendingChanges())) {
      showToast("Sync your pending changes before duplicating a document.");
      return;
    }
    try {
      const duplicate = await request(
        `${API_URL}/${encodeURIComponent(documentId)}/duplicate`,
        { method: "POST" },
      );
      getDocuments().push(duplicate);
      documentUi.sortDocuments();
      setActiveDocumentId(duplicate.id);
      documentUi.renderEditor();
      documentUi.renderList();
      elements.title.focus();
      elements.title.select();
      refreshSaveStatus();
    } catch (error) {
      showToast(error.message || "Couldn't duplicate this document. Please try again.");
      console.error("Unable to duplicate document:", error);
    }
  }

  async function renameDocument(documentId) {
    if (getActiveDocumentId() !== documentId) {
      await openDocument(documentId);
    }
    if (getActiveDocumentId() === documentId) {
      elements.title.focus();
      elements.title.select();
    }
  }

  async function exportDocument(format) {
    const activeDocumentId = getActiveDocumentId();
    if (!activeDocumentId || !(await flushSave())) {
      return;
    }
    if (!(await syncPendingChanges())) {
      showToast("Save your document before exporting it.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(activeDocumentId)}/export/${format}`);
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const file = await response.blob();
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/u)?.[1];
      link.href = downloadUrl;
      link.download = encodedFilename
        ? decodeURIComponent(encodedFilename)
        : `${elements.title.value.trim() || "document"}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      elements.documentActions.open = false;
    } catch (error) {
      showToast("Couldn't export this document. Please try again.");
      console.error("Unable to export document:", error);
    }
  }

  async function shareWithWhatsApp() {
    const activeDocumentId = getActiveDocumentId();
    if (!activeDocumentId) {
      return;
    }
    const shareWindow = window.open("about:blank", "_blank");
    if (!shareWindow) {
      showToast("Allow pop-ups to open WhatsApp sharing.");
      return;
    }
    shareWindow.opener = null;

    try {
      if (!(await syncPendingChanges())) {
        shareWindow.close();
        showToast("Save your document before sharing it.");
        return;
      }
      const response = await request(`${API_URL}/${encodeURIComponent(activeDocumentId)}/share/whatsapp`);
      shareWindow.location.href = response.shareUrl;
      elements.documentActions.open = false;
    } catch (error) {
      shareWindow.close();
      showToast("Couldn't prepare the WhatsApp share. Please try again.");
      console.error("Unable to create WhatsApp share link:", error);
    }
  }

  async function loadWorkspaceDocuments(preferredDocumentId = getActiveDocumentId()) {
    elements.workspaceLoading.hidden = false;
    document.querySelectorAll("[data-workspace-control]").forEach((control) => { control.disabled = true; });
    elements.workspaceError.hidden = true;
    elements.editor.hidden = true;
    elements.welcome.hidden = true;
    elements.newButton.disabled = true;
    elements.search.disabled = true;
    resetSyncState();
    setDocuments([]);
    setActiveDocumentId(null);
    elements.list.replaceChildren();
    elements.favoriteList.replaceChildren();
    elements.count.textContent = "0";
    documentUi.clearDocumentOutline();
    try {
      setDocuments(await request(API_URL));
    } catch (error) {
      setDocuments(loadLocalDraftDocuments());
      for (const entry of getDocuments()) {
        entry.pendingSync = true;
        pendingDocumentIds.add(entry.id);
        locallySavedIds.add(entry.id);
      }
      documentUi.sortDocuments();
      setActiveDocumentId(
        getDocuments().find((entry) => entry.id === preferredDocumentId)?.id
          ?? null,
      );
      documentUi.renderEditor();
      documentUi.renderList();
      if (getDocuments().length > 0) {
        refreshSaveStatus();
        showToast("The server is unavailable. Showing saved browser copies.");
        console.error("Unable to load documents from the server:", error);
        return;
      }
      setSaveStatus("error", "Couldn't load documents");
      elements.workspaceLoading.hidden = true;
      elements.workspaceError.hidden = false;
      document.querySelectorAll("[data-workspace-control]").forEach((control) => { control.disabled = true; });
      document.querySelector("#workspace-error-message").textContent = error.message || "Your documents could not be loaded. Check your connection and try again.";
      elements.welcome.hidden = true;
      showToast("Your documents couldn't be loaded. Refresh to try again.");
      console.error("Unable to load documents:", error);
      return;
    }

    const restoredDocumentIds = [];
    setDocuments(getDocuments().map((entry) => {
      const restored = restoreLocalEdits(entry);
      if (pendingDocumentIds.has(entry.id) && !conflictedDocumentIds.has(entry.id)) restoredDocumentIds.push(entry.id);
      return restored;
    }));
    documentUi.sortDocuments();
    setActiveDocumentId(
      getDocuments().find((entry) => entry.id === preferredDocumentId)?.id
        ?? null,
    );
    documentUi.renderEditor();
    documentUi.renderList();
    for (const documentId of restoredDocumentIds) {
      void saveDocument(documentId);
    }
    refreshSaveStatus();
  }

  return {
    createDocument,
    deleteDocument,
    duplicateDocument,
    exportDocument,
    flushSave,
    loadWorkspaceDocuments,
    moveDocument,
    openDocument,
    renameDocument,
    saveDocument,
    scheduleSave,
    shareWithWhatsApp,
    toggleFavorite,
    showHome,
    clearWorkspaceState,
    archiveDocument, reorderDocument, applyServerDocument,
    resolveConflicts,
    hasConflicts: () => conflictedDocumentIds.size > 0,
    syncPendingChanges,
    refreshSaveStatus,
  };
}
