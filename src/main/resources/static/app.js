const API_URL = "/api/documents";
const SAVE_DELAY = 650;

const elements = {
  list: document.querySelector("#document-list"),
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
  saveStatus: document.querySelector("#save-status"),
  saveStatusText: document.querySelector("#save-status-text"),
  toast: document.querySelector("#toast"),
};

let documents = [];
let activeDocumentId = null;
let saveTimer = null;
let saveQueue = Promise.resolve();
let toastTimer = null;

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

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function sortDocuments() {
  documents.sort((first, second) => second.updatedAt - first.updatedAt);
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

  for (const document of visibleDocuments) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "document-item";
    item.classList.toggle("active", document.id === activeDocumentId);
    item.setAttribute("aria-current", document.id === activeDocumentId ? "page" : "false");

    const icon = document.createElement("span");
    icon.className = "document-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✳";

    const copy = document.createElement("span");
    copy.className = "document-item-copy";

    const title = document.createElement("span");
    title.className = "document-item-title";
    title.textContent = document.title?.trim() || "Untitled";

    const preview = document.createElement("span");
    preview.className = "document-item-preview";
    preview.textContent = document.content?.trim() || "No additional text";

    copy.append(title, preview);
    item.append(icon, copy);
    item.addEventListener("click", () => {
      void selectDocument(document.id);
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

  if (!activeDocument) {
    elements.breadcrumb.textContent = "Welcome";
    return;
  }

  elements.title.value = activeDocument.title || "";
  elements.content.value = activeDocument.content || "";
  elements.breadcrumb.textContent = activeDocument.title?.trim() || "Untitled";
  elements.date.textContent = `Last edited ${formatDate(activeDocument.updatedAt)}`;
  updateWordCount();
}

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
    return false;
  }
}

async function flushSave() {
  window.clearTimeout(saveTimer);
  if (!activeDocumentId) {
    return true;
  }
  return saveDocument(activeDocumentId);
}

async function selectDocument(documentId) {
  if (documentId === activeDocumentId) {
    return;
  }
  if (!(await flushSave())) {
    return;
  }
  activeDocumentId = documentId;
  renderEditor();
  renderList();
  setSaveStatus("saved", "All changes saved");
}

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
    documents = documents.filter((document) => document.id !== documentId);
    activeDocumentId = documents[0]?.id ?? null;
    renderEditor();
    renderList();
    setSaveStatus("saved", "All changes saved");
  } catch (error) {
    showToast("Couldn't delete this document. Please try again.");
    console.error("Unable to delete document:", error);
  }
}

async function initialize() {
  try {
    documents = await request(API_URL);
    sortDocuments();
    activeDocumentId = documents[0]?.id ?? null;
    renderEditor();
    renderList();
  } catch (error) {
    setSaveStatus("error", "Couldn't load documents");
    showToast("Your documents couldn't be loaded. Refresh to try again.");
    console.error("Unable to load documents:", error);
  }
}

elements.newButton.addEventListener("click", () => void createDocument());
elements.welcomeCreate.addEventListener("click", () => void createDocument());
elements.deleteButton.addEventListener("click", () => void deleteDocument());
elements.search.addEventListener("input", renderList);
elements.title.addEventListener("input", scheduleSave);
elements.content.addEventListener("input", () => {
  updateWordCount();
  scheduleSave();
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
