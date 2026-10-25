const API_URL = "/api/documents";
const SAVE_DELAY = 650;
const LOCAL_DRAFT_PREFIX = "squareone.document-draft.v1:";
const LOCAL_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SIDEBAR_WIDTH_KEY = "squareone.sidebar-width.v1";
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;

const elements = {
  list: document.querySelector("#document-list"),
  sidebarDocumentOutline: document.querySelector("#sidebar-document-outline"),
  sidebarDocumentTitle: document.querySelector("#sidebar-document-title"),
  sidebarOutlineList: document.querySelector("#sidebar-outline-list"),
  sidebarOutlineEmpty: document.querySelector("#sidebar-outline-empty"),
  sidebarBack: document.querySelector("#sidebar-back"),
  count: document.querySelector("#document-count"),
  search: document.querySelector("#search"),
  newButton: document.querySelector("#new-document"),
  welcomeCreate: document.querySelector("#welcome-create"),
  welcome: document.querySelector("#welcome-state"),
  editor: document.querySelector("#editor"),
  title: document.querySelector("#title-input"),
  content: document.querySelector("#content-input"),
  breadcrumb: document.querySelector("#breadcrumb-title"),
  date: document.querySelector("#document-date"),
  wordCount: document.querySelector("#word-count"),
  deleteButton: document.querySelector("#delete-document"),
  documentActions: document.querySelector("#document-actions"),
  whatsappButton: document.querySelector("#share-whatsapp"),
  saveStatus: document.querySelector("#save-status"),
  saveStatusText: document.querySelector("#save-status-text"),
  toast: document.querySelector("#toast"),
  appShell: document.querySelector(".app-shell"),
  sidebar: document.querySelector(".sidebar"),
  sidebarResizeHandle: document.querySelector("#sidebar-resize-handle"),
};

let documents = [];
let activeDocumentId = null;
let saveTimer = null;
let saveQueue = Promise.resolve();
let toastTimer = null;
let localDraftWarningShown = false;
let sidebarResizePointerId = null;
let sidebarWidth = 278;
let documentOpenRequest = 0;

function setSaveStatus(status, text) {
  elements.saveStatus.classList.remove("saving", "error");
  if (status !== "saved") {
    elements.saveStatus.classList.add(status);
  }
  elements.saveStatusText.textContent = text;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4000);
}

function reportLocalDraftError(error) {
  if (!localDraftWarningShown) {
    showToast("Browser storage is unavailable. Your local draft may not be saved.");
    localDraftWarningShown = true;
  }
  console.error("Unable to access local document storage:", error);
}

function removeLocalDraft(documentId) {
  try {
    window.localStorage.removeItem(`${LOCAL_DRAFT_PREFIX}${documentId}`);
  } catch (error) {
    reportLocalDraftError(error);
  }
}

function saveLocalDraft(document) {
  try {
    window.localStorage.setItem(
      `${LOCAL_DRAFT_PREFIX}${document.id}`,
      JSON.stringify({
        title: document.title,
        content: document.content,
        updatedAt: document.updatedAt,
        expiresAt: Date.now() + LOCAL_DRAFT_TTL_MS,
      }),
    );
    localDraftWarningShown = false;
  } catch (error) {
    reportLocalDraftError(error);
  }
}

function loadLocalDraft(documentId) {
  let serializedDraft;
  try {
    serializedDraft = window.localStorage.getItem(`${LOCAL_DRAFT_PREFIX}${documentId}`);
  } catch (error) {
    reportLocalDraftError(error);
    return null;
  }
  if (!serializedDraft) {
    return null;
  }

  let draft;
  try {
    draft = JSON.parse(serializedDraft);
  } catch (error) {
    console.warn("Removing an unreadable local document draft:", error);
    removeLocalDraft(documentId);
    return null;
  }

  if (
    !draft
    || typeof draft.title !== "string"
    || typeof draft.content !== "string"
    || !Number.isFinite(draft.updatedAt)
    || !Number.isFinite(draft.expiresAt)
  ) {
    removeLocalDraft(documentId);
    return null;
  }
  if (draft.expiresAt <= Date.now()) {
    removeLocalDraft(documentId);
    return null;
  }
  return draft;
}

function loadLocalDraftDocuments() {
  try {
    const documentIds = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LOCAL_DRAFT_PREFIX)) {
        documentIds.push(key.slice(LOCAL_DRAFT_PREFIX.length));
      }
    }

    return documentIds.flatMap((id) => {
      const draft = loadLocalDraft(id);
      return draft
        ? [{ id, title: draft.title, content: draft.content, createdAt: draft.updatedAt, updatedAt: draft.updatedAt }]
        : [];
    });
  } catch (error) {
    reportLocalDraftError(error);
    return [];
  }
}

async function request(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function sortDocuments() {
  documents.sort((first, second) => second.updatedAt - first.updatedAt);
}

function showSidebarDocument(documentEntry) {
  elements.sidebarDocumentTitle.textContent = documentEntry.title?.trim() || "Untitled";
  renderSidebarOutline(documentEntry.content || "");
  elements.sidebarDocumentOutline.hidden = false;
  elements.sidebar.classList.add("sidebar-showing-document");
}

function renderSidebarOutline(content) {
  elements.sidebarOutlineList.replaceChildren();
  const paragraphs = [];
  let blockStart = 0;
  const separatorPattern = /\n[ \t]*\n+/gu;

  for (const separator of content.matchAll(separatorPattern)) {
    paragraphs.push({ text: content.slice(blockStart, separator.index), start: blockStart });
    blockStart = separator.index + separator[0].length;
  }
  paragraphs.push({ text: content.slice(blockStart), start: blockStart });

  let paragraphNumber = 0;
  for (const paragraph of paragraphs) {
    const leadingWhitespace = paragraph.text.match(/^\s*/u)[0].length;
    const text = paragraph.text.trim();
    if (!text) {
      continue;
    }
    paragraphNumber += 1;

    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-outline-item";
    button.setAttribute("aria-label", `Go to paragraph ${paragraphNumber}: ${text}`);
    button.addEventListener("click", () => {
      const start = paragraph.start + leadingWhitespace;
      elements.content.focus();
      elements.content.setSelectionRange(start, start + text.length);
    });

    const number = document.createElement("span");
    number.className = "sidebar-outline-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(paragraphNumber);

    const preview = document.createElement("span");
    preview.className = "sidebar-outline-text";
    preview.textContent = text.replace(/\s+/gu, " ");

    button.append(number, preview);
    item.append(button);
    elements.sidebarOutlineList.append(item);
  }

  elements.sidebarOutlineEmpty.hidden = paragraphNumber > 0;
}

function showDocumentList() {
  elements.sidebarDocumentOutline.hidden = true;
  elements.sidebar.classList.remove("sidebar-showing-document");
  const activeItem = Array.from(elements.list.children).find(
    (item) => item.dataset.documentId === activeDocumentId,
  );
  activeItem?.focus();
}

function renderList() {
  sortDocuments();
  elements.count.textContent = String(documents.length);
  elements.list.replaceChildren();

  const query = elements.search.value.trim().toLocaleLowerCase();
  const visibleDocuments = documents.filter((document) => {
    const title = (document.title || "").toLocaleLowerCase();
    const content = (document.content || "").toLocaleLowerCase();
    return title.includes(query) || content.includes(query);
  });

  if (visibleDocuments.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "sidebar-empty";
    emptyMessage.textContent = documents.length === 0
      ? "Your notes will find a home here."
      : "No documents match your search.";
    elements.list.append(emptyMessage);
    return;
  }

  for (const entry of visibleDocuments) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "document-item";
    item.classList.toggle("active", entry.id === activeDocumentId);
    item.setAttribute("aria-current", entry.id === activeDocumentId ? "page" : "false");
    item.dataset.documentId = entry.id;

    const icon = document.createElement("span");
    icon.className = "document-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✳";

    const copy = document.createElement("span");
    copy.className = "document-item-copy";

    const title = document.createElement("span");
    title.className = "document-item-title";
    title.textContent = entry.title?.trim() || "Untitled";

    const preview = document.createElement("span");
    preview.className = "document-item-preview";
    preview.textContent = entry.content?.trim() || "No additional text";

    copy.append(title, preview);
    item.append(icon, copy);
    item.addEventListener("click", () => {
      void openDocument(entry.id);
    });
    elements.list.append(item);
  }
}

function renderEditor() {
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const hasDocument = Boolean(activeDocument);
  elements.welcome.hidden = hasDocument;
  elements.editor.hidden = !hasDocument;
  elements.deleteButton.disabled = !hasDocument;
  elements.documentActions.classList.toggle("disabled", !hasDocument);

  if (!activeDocument) {
    elements.breadcrumb.textContent = "Welcome";
    return;
  }

  elements.title.value = activeDocument.title || "";
  elements.content.value = activeDocument.content || "";
  resizeContentInput();
  elements.breadcrumb.textContent = activeDocument.title?.trim() || "Untitled";
  elements.date.textContent = `Last edited ${formatDate(activeDocument.updatedAt)}`;
  updateWordCount();
}

function resizeContentInput() {
  elements.content.style.height = "auto";
  elements.content.style.height = `${elements.content.scrollHeight}px`;
}

function clampSidebarWidth(width) {
  const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 328);
  return Math.round(Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, width)));
}

function setSidebarWidth(width) {
  const clampedWidth = clampSidebarWidth(width);
  sidebarWidth = clampedWidth;
  elements.appShell.style.setProperty("--sidebar-width", `${clampedWidth}px`);
  elements.sidebarResizeHandle.setAttribute("aria-valuenow", String(clampedWidth));
  return clampedWidth;
}

function saveSidebarWidth(width) {
  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch (error) {
    console.warn("Unable to save sidebar width preference:", error);
  }
}

function endSidebarResize(event) {
  if (event.pointerId !== sidebarResizePointerId) {
    return;
  }
  sidebarResizePointerId = null;
  elements.appShell.classList.remove("resizing-sidebar");
  if (elements.sidebarResizeHandle.hasPointerCapture(event.pointerId)) {
    elements.sidebarResizeHandle.releasePointerCapture(event.pointerId);
  }
  saveSidebarWidth(elements.sidebar.getBoundingClientRect().width);
}

try {
  const savedSidebarWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (Number.isFinite(savedSidebarWidth) && savedSidebarWidth > 0) {
    setSidebarWidth(savedSidebarWidth);
  }
} catch (error) {
  console.warn("Unable to load sidebar width preference:", error);
}

elements.sidebarResizeHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  sidebarResizePointerId = event.pointerId;
  elements.sidebarResizeHandle.setPointerCapture(event.pointerId);
  elements.appShell.classList.add("resizing-sidebar");
  event.preventDefault();
});
elements.sidebarResizeHandle.addEventListener("pointermove", (event) => {
  if (event.pointerId === sidebarResizePointerId) {
    setSidebarWidth(event.clientX);
  }
});
elements.sidebarResizeHandle.addEventListener("pointerup", endSidebarResize);
elements.sidebarResizeHandle.addEventListener("pointercancel", endSidebarResize);
elements.sidebarResizeHandle.addEventListener("keydown", (event) => {
  const currentWidth = elements.sidebar.getBoundingClientRect().width;
  const step = event.shiftKey ? 40 : 16;
  let nextWidth;
  if (event.key === "ArrowLeft") {
    nextWidth = currentWidth - step;
  } else if (event.key === "ArrowRight") {
    nextWidth = currentWidth + step;
  } else if (event.key === "Home") {
    nextWidth = MIN_SIDEBAR_WIDTH;
  } else if (event.key === "End") {
    nextWidth = MAX_SIDEBAR_WIDTH;
  } else {
    return;
  }
  event.preventDefault();
  saveSidebarWidth(setSidebarWidth(nextWidth));
});

function formatDate(timestamp) {
  if (!timestamp) {
    return "just now";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(timestamp));
}

function updateWordCount() {
  const text = elements.content.value.trim();
  const count = text ? text.split(/\s+/u).length : 0;
  elements.wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function scheduleSave() {
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  if (!activeDocument) {
    return;
  }

  activeDocument.title = elements.title.value;
  activeDocument.content = elements.content.value;
  activeDocument.updatedAt = Date.now();
  saveLocalDraft(activeDocument);
  if (elements.sidebar.classList.contains("sidebar-showing-document")) {
    showSidebarDocument(activeDocument);
  }
  elements.breadcrumb.textContent = activeDocument.title.trim() || "Untitled";
  elements.date.textContent = `Last edited ${formatDate(activeDocument.updatedAt)}`;
  renderList();
  setSaveStatus("saving", "Saving changes...");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void saveDocument(activeDocument.id);
  }, SAVE_DELAY);
}

async function saveDocument(documentId) {
  window.clearTimeout(saveTimer);
  const current = documents.find((document) => document.id === documentId);
  if (!current) {
    return true;
  }

  const snapshot = { title: current.title, content: current.content };
  const operation = saveQueue.then(async () => {
    const savedDocument = await request(`${API_URL}/${encodeURIComponent(documentId)}`, {
      method: "PUT",
      body: JSON.stringify(snapshot),
    });
    const index = documents.findIndex((document) => document.id === documentId);
    if (index !== -1) {
      const latest = documents[index];
      const hasNewerEdits = latest.title !== snapshot.title || latest.content !== snapshot.content;
      documents[index] = hasNewerEdits
        ? { ...savedDocument, title: latest.title, content: latest.content, updatedAt: latest.updatedAt }
        : savedDocument;
      if (hasNewerEdits) {
        setSaveStatus("saving", "Saving changes...");
      }
    }
    renderList();
    if (activeDocumentId === documentId) {
      elements.date.textContent = `Last edited ${formatDate(savedDocument.updatedAt)}`;
      if (index === -1 || (documents[index].title === snapshot.title && documents[index].content === snapshot.content)) {
        setSaveStatus("saved", "All changes saved");
      }
    }
    return true;
  });
  saveQueue = operation.catch(() => {});

  try {
    return await operation;
  } catch (error) {
    if (activeDocumentId === documentId) {
      setSaveStatus("error", "Couldn't save changes");
    }
    showToast("Your changes couldn't be saved. Please try again.");
    console.error("Unable to save document:", error);
    return Boolean(loadLocalDraft(documentId));
  }
}

async function flushSave() {
  window.clearTimeout(saveTimer);
  if (!activeDocumentId) {
    return true;
  }
  return saveDocument(activeDocumentId);
}

async function openDocument(documentId) {
  const requestId = ++documentOpenRequest;
  if (!(await flushSave())) {
    return;
  }
  let selectedDocument = documents.find((entry) => entry.id === documentId);
  if (!selectedDocument) {
    showToast("Couldn't find that document. Please refresh and try again.");
    return;
  }

  try {
    const fetchedDocument = await request(`${API_URL}/${encodeURIComponent(documentId)}`);
    if (requestId !== documentOpenRequest) {
      return;
    }
    const localDraft = loadLocalDraft(documentId);
    selectedDocument = localDraft && localDraft.updatedAt >= fetchedDocument.updatedAt
      ? { ...fetchedDocument, title: localDraft.title, content: localDraft.content, updatedAt: localDraft.updatedAt }
      : fetchedDocument;
    const index = documents.findIndex((entry) => entry.id === documentId);
    if (index !== -1) {
      documents[index] = selectedDocument;
    }
    if (selectedDocument !== fetchedDocument) {
      void saveDocument(documentId);
    }
  } catch (error) {
    console.error("Unable to fetch document:", error);
    showToast("Couldn't refresh this document. Showing its last loaded version.");
  }

  if (requestId !== documentOpenRequest) {
    return;
  }
  activeDocumentId = selectedDocument.id;
  renderEditor();
  renderList();
  showSidebarDocument(selectedDocument);
  setSaveStatus("saved", "All changes saved");
}

elements.sidebarBack.addEventListener("click", showDocumentList);

async function createDocument() {
  if (!(await flushSave())) {
    return;
  }
  try {
    const createdDocument = await request(API_URL, { method: "POST" });
    documents.unshift(createdDocument);
    activeDocumentId = createdDocument.id;
    elements.search.value = "";
    renderEditor();
    renderList();
    showSidebarDocument(createdDocument);
    elements.title.focus();
    elements.title.select();
    setSaveStatus("saved", "All changes saved");
  } catch (error) {
    showToast("Couldn't create a document. Please try again.");
    console.error("Unable to create document:", error);
  }
}

async function deleteDocument() {
  const documentId = activeDocumentId;
  if (!documentId || !(await flushSave())) {
    return;
  }
  if (!window.confirm("Delete this document? This can't be undone.")) {
    return;
  }

  try {
    await request(`${API_URL}/${encodeURIComponent(documentId)}`, { method: "DELETE" });
    removeLocalDraft(documentId);
    documents = documents.filter((document) => document.id !== documentId);
    activeDocumentId = documents[0]?.id ?? null;
    renderEditor();
    renderList();
    showDocumentList();
    setSaveStatus("saved", "All changes saved");
  } catch (error) {
    showToast("Couldn't delete this document. Please try again.");
    console.error("Unable to delete document:", error);
  }
}

async function exportDocument(format) {
  if (!activeDocumentId || !(await flushSave())) {
    return;
  }
  if (elements.saveStatus.classList.contains("error")) {
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
    if (!(await flushSave()) || elements.saveStatus.classList.contains("error")) {
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

async function initialize() {
  try {
    documents = await request(API_URL);
  } catch (error) {
    documents = loadLocalDraftDocuments();
    if (documents.length > 0) {
      sortDocuments();
      activeDocumentId = documents[0].id;
      renderEditor();
      renderList();
      setSaveStatus("error", "Showing local copies");
      showToast("The server is unavailable. Showing saved browser copies.");
      console.error("Unable to load documents from the server:", error);
      return;
    }
    setSaveStatus("error", "Couldn't load documents");
    showToast("Your documents couldn't be loaded. Refresh to try again.");
    console.error("Unable to load documents:", error);
    return;
  }

  const restoredDocumentIds = [];
  for (const entry of documents) {
    const draft = loadLocalDraft(entry.id);
    if (
      draft
      && draft.updatedAt >= entry.updatedAt
      && (draft.title !== entry.title || draft.content !== entry.content)
    ) {
      entry.title = draft.title;
      entry.content = draft.content;
      entry.updatedAt = draft.updatedAt;
      restoredDocumentIds.push(entry.id);
    }
  }
  sortDocuments();
  activeDocumentId = documents[0]?.id ?? null;
  renderEditor();
  renderList();
  for (const documentId of restoredDocumentIds) {
    void saveDocument(documentId);
  }
}

elements.newButton.addEventListener("click", () => void createDocument());
elements.welcomeCreate.addEventListener("click", () => void createDocument());
elements.deleteButton.addEventListener("click", () => void deleteDocument());
elements.documentActions.querySelectorAll("[data-export-format]").forEach((button) => {
  button.addEventListener("click", () => void exportDocument(button.dataset.exportFormat));
});
elements.whatsappButton.addEventListener("click", () => void shareWithWhatsApp());
elements.search.addEventListener("input", renderList);
elements.title.addEventListener("input", scheduleSave);
elements.content.addEventListener("input", () => {
  resizeContentInput();
  updateWordCount();
  scheduleSave();
});
window.addEventListener("resize", () => {
  setSidebarWidth(sidebarWidth);
  resizeContentInput();
});

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLocaleLowerCase() === "n") {
    event.preventDefault();
    void createDocument();
  } else if (event.key === "/" && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  } else if (event.key === "Escape" && document.activeElement === elements.search) {
    elements.search.value = "";
    renderList();
    elements.search.blur();
  }
});

void initialize();
