import { Editor, mergeAttributes, Node } from "https://esm.sh/@tiptap/core@2.11.5";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.5";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.11.5";
import Link from "https://esm.sh/@tiptap/extension-link@2.11.5";
import TextStyle from "https://esm.sh/@tiptap/extension-text-style@2.11.5";
import Color from "https://esm.sh/@tiptap/extension-color@2.11.5";
import Highlight from "https://esm.sh/@tiptap/extension-highlight@2.11.5";
import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@2.11.5";
import TaskList from "https://esm.sh/@tiptap/extension-task-list@2.11.5";
import TaskItem from "https://esm.sh/@tiptap/extension-task-item@2.11.5";

const API_URL = "/api/documents";
const SAVE_DELAY = 650;
const LOCAL_DRAFT_PREFIX = "squareone.document-draft.v2:";
const LOCAL_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SIDEBAR_WIDTH_KEY = "squareone.sidebar-width.v1";
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },
});

const slashCommands = [
  {
    title: "Heading 1",
    icon: "H1",
    description: "Large section heading",
    keywords: "heading title h1",
    command: (chain) => chain.setNode("heading", { level: 1 }),
  },
  {
    title: "Heading 2",
    icon: "H2",
    description: "Medium section heading",
    keywords: "heading h2",
    command: (chain) => chain.setNode("heading", { level: 2 }),
  },
  {
    title: "Heading 3",
    icon: "H3",
    description: "Small section heading",
    keywords: "heading h3",
    command: (chain) => chain.setNode("heading", { level: 3 }),
  },
  {
    title: "Bullet List",
    icon: "•",
    description: "Create a simple list",
    keywords: "bullet bulleted list unordered",
    command: (chain) => chain.toggleBulletList(),
  },
  {
    title: "Numbered List",
    icon: "1.",
    description: "Create a numbered list",
    keywords: "numbered ordered list",
    command: (chain) => chain.toggleOrderedList(),
  },
  {
    title: "To-do List",
    icon: "☐",
    description: "Track tasks with a checklist",
    keywords: "todo to-do task checklist",
    command: (chain) => chain.toggleTaskList(),
  },
  {
    title: "Quote",
    icon: "“",
    description: "Capture a quotation",
    keywords: "quote blockquote",
    command: (chain) => chain.toggleBlockquote(),
  },
  {
    title: "Code Block",
    icon: "</>",
    description: "Display code with formatting",
    keywords: "code pre",
    command: (chain) => chain.toggleCodeBlock(),
  },
  {
    title: "Divider",
    icon: "—",
    description: "Separate sections with a line",
    keywords: "divider horizontal rule",
    command: (chain) => chain.setHorizontalRule(),
  },
  {
    title: "Callout",
    icon: "✳",
    description: "Highlight an important note",
    keywords: "callout note",
    command: (chain) => chain.wrapIn("callout"),
  },
];

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
  toolbar: document.querySelector("#formatting-toolbar"),
  textColorPalette: document.querySelector("#text-color-palette"),
  highlightPalette: document.querySelector("#highlight-palette"),
  linkEditor: document.querySelector("#toolbar-link-editor"),
  linkInput: document.querySelector("#toolbar-link-input"),
  slashMenu: document.querySelector("#slash-command-menu"),
  slashOptions: document.querySelector("#slash-command-options"),
  slashEmpty: document.querySelector("#slash-command-empty"),
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
  accountMenu: document.querySelector("#account-menu"),
  accountMenuTrigger: document.querySelector("#account-menu-trigger"),
  accountMenuPanel: document.querySelector("#account-menu-panel"),
  accountAvatar: document.querySelector("#account-avatar"),
  accountMenuName: document.querySelector("#account-menu-name"),
  accountMenuEmail: document.querySelector("#account-menu-email"),
  accountProfile: document.querySelector("#account-profile"),
  accountSettings: document.querySelector("#account-settings"),
  accountLogin: document.querySelector("#account-login"),
  accountLogout: document.querySelector("#account-logout"),
  accountDialog: document.querySelector("#account-dialog"),
  accountDialogEyebrow: document.querySelector("#account-dialog-eyebrow"),
  accountDialogTitle: document.querySelector("#account-dialog-title"),
  accountDialogCopy: document.querySelector("#account-dialog-copy"),
  accountDialogClose: document.querySelector("#account-dialog-close"),
  accountForm: document.querySelector("#account-form"),
  accountNameField: document.querySelector("#account-name-field"),
  accountNameInput: document.querySelector("#account-name-input"),
  accountEmailField: document.querySelector("#account-email-field"),
  accountEmailInput: document.querySelector("#account-email-input"),
  accountPasswordField: document.querySelector("#account-password-field"),
  accountPasswordInput: document.querySelector("#account-password-input"),
  accountAvatarColorField: document.querySelector("#account-avatar-color-field"),
  accountAvatarColorInput: document.querySelector("#account-avatar-color-input"),
  accountCurrentPasswordField: document.querySelector("#account-current-password-field"),
  accountCurrentPasswordInput: document.querySelector("#account-current-password-input"),
  accountNewPasswordField: document.querySelector("#account-new-password-field"),
  accountNewPasswordInput: document.querySelector("#account-new-password-input"),
  accountFormError: document.querySelector("#account-form-error"),
  accountSubmit: document.querySelector("#account-submit"),
  accountModeToggle: document.querySelector("#account-mode-toggle"),
  accountGuestContinue: document.querySelector("#account-guest-continue"),
  sidebarFooterCopy: document.querySelector("#sidebar-footer-copy"),
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
let textEditor = null;
let toolbarHideTimer = null;
let toolbarPositionFrame = null;
let currentUser = { authenticated: false, name: "Guest", email: null, avatar: "G", avatarColor: "#617459" };
let csrfToken = null;
let csrfHeaderName = "X-XSRF-TOKEN";
let accountDialogMode = "login";
let slashRange = null;
let slashMatches = [];
let slashActiveIndex = 0;
let slashQuery = null;

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

function updateAccountMenu() {
  elements.accountAvatar.textContent = currentUser.avatar || "G";
  elements.accountAvatar.style.backgroundColor = currentUser.avatarColor || "#617459";
  elements.accountMenuName.textContent = currentUser.name || "Guest";
  elements.accountMenuEmail.textContent = currentUser.authenticated
    ? currentUser.email
    : "Private guest space";
  elements.accountProfile.hidden = !currentUser.authenticated;
  elements.accountSettings.hidden = !currentUser.authenticated;
  elements.accountLogin.hidden = currentUser.authenticated;
  elements.accountLogout.hidden = !currentUser.authenticated;
  elements.sidebarFooterCopy.textContent = currentUser.authenticated
    ? "Your notes, just yours."
    : "Your private guest space.";
}

function setAccountField(field, input, visible, required = false) {
  field.hidden = !visible;
  input.disabled = !visible;
  input.required = visible && required;
}

function showAccountDialog(mode) {
  accountDialogMode = mode;
  elements.accountFormError.hidden = true;
  elements.accountFormError.textContent = "";
  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isProfile = mode === "profile";
  const isSettings = mode === "settings";

  elements.accountDialogEyebrow.textContent = isProfile || isSettings ? "Your account" : "Your Squareone";
  elements.accountDialogTitle.textContent = {
    login: "Log in",
    signup: "Create your account",
    profile: "Profile",
    settings: "Settings",
  }[mode];
  elements.accountDialogCopy.textContent = {
    login: "Log in to bring your notes with you anywhere.",
    signup: "Your guest notes will move safely into your new account.",
    profile: "Update the name, email, and avatar for your account.",
    settings: "Change your password to keep your account secure.",
  }[mode];
  elements.accountSubmit.textContent = {
    login: "Log in",
    signup: "Create account",
    profile: "Save profile",
    settings: "Update password",
  }[mode];
  setAccountField(elements.accountNameField, elements.accountNameInput, isSignup || isProfile, isSignup || isProfile);
  setAccountField(elements.accountEmailField, elements.accountEmailInput, isLogin || isSignup || isProfile, isLogin || isSignup || isProfile);
  setAccountField(elements.accountPasswordField, elements.accountPasswordInput, isLogin || isSignup, isLogin || isSignup);
  setAccountField(elements.accountAvatarColorField, elements.accountAvatarColorInput, isProfile);
  setAccountField(elements.accountCurrentPasswordField, elements.accountCurrentPasswordInput, isSettings, isSettings);
  setAccountField(elements.accountNewPasswordField, elements.accountNewPasswordInput, isSettings, isSettings);
  elements.accountModeToggle.hidden = !isLogin && !isSignup;
  elements.accountGuestContinue.hidden = !isLogin && !isSignup;
  elements.accountModeToggle.textContent = isLogin
    ? "New here? Create an account"
    : "Already have an account? Log in";

  if (isProfile) {
    elements.accountNameInput.value = currentUser.name || "";
    elements.accountEmailInput.value = currentUser.email || "";
    elements.accountAvatarColorInput.value = currentUser.avatarColor || "#617459";
  }
  if (isSettings) {
    elements.accountCurrentPasswordInput.value = "";
    elements.accountNewPasswordInput.value = "";
  }
  if (!elements.accountDialog.open) {
    elements.accountDialog.showModal();
  }
  elements.accountDialog.querySelector("input:not(:disabled)")?.focus();
}

function showAccountFormError(message) {
  elements.accountFormError.textContent = message;
  elements.accountFormError.hidden = false;
}

function closeAccountMenu() {
  elements.accountMenuPanel.hidden = true;
  elements.accountMenuTrigger.setAttribute("aria-expanded", "false");
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
    window.localStorage.removeItem(`${localDraftPrefix()}${documentId}`);
  } catch (error) {
    reportLocalDraftError(error);
  }
}

function saveLocalDraft(document) {
  try {
    window.localStorage.setItem(
      `${localDraftPrefix()}${document.id}`,
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
    serializedDraft = window.localStorage.getItem(`${localDraftPrefix()}${documentId}`);
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
    const prefix = localDraftPrefix();
    const documentIds = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) {
        documentIds.push(key.slice(prefix.length));
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

function localDraftPrefix() {
  const workspaceId = currentUser.workspaceId;
  return workspaceId ? `${LOCAL_DRAFT_PREFIX}${workspaceId}:` : `${LOCAL_DRAFT_PREFIX}unavailable:`;
}

function rekeyLocalDrafts(previousWorkspaceId, nextWorkspaceId) {
  if (!previousWorkspaceId || !nextWorkspaceId || previousWorkspaceId === nextWorkspaceId) {
    return;
  }
  const oldPrefix = `${LOCAL_DRAFT_PREFIX}${previousWorkspaceId}:`;
  const newPrefix = `${LOCAL_DRAFT_PREFIX}${nextWorkspaceId}:`;
  try {
    const oldKeys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(oldPrefix)) {
        oldKeys.push(key);
      }
    }
    for (const oldKey of oldKeys) {
      const newKey = `${newPrefix}${oldKey.slice(oldPrefix.length)}`;
      const value = window.localStorage.getItem(oldKey);
      if (value !== null) {
        window.localStorage.setItem(newKey, value);
        window.localStorage.removeItem(oldKey);
      }
    }
  } catch (error) {
    reportLocalDraftError(error);
  }
}

async function request(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    ...(options.body && !(options.body instanceof URLSearchParams) ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfToken) {
      const csrfResponse = await fetch("/api/auth/csrf");
      if (!csrfResponse.ok) {
        throw new Error("Couldn't prepare a secure request. Please refresh and try again.");
      }
      const csrf = await csrfResponse.json();
      csrfToken = csrf.token;
      csrfHeaderName = csrf.headerName || csrfHeaderName;
    }
    headers[csrfHeaderName] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `Request failed (${response.status})`;
    if (body) {
      try {
        message = JSON.parse(body).message || message;
      } catch {
        message = body;
      }
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (url === "/api/auth/login" || url === "/api/auth/logout") {
    csrfToken = null;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function editorContentFromStored(content) {
  if (!content) {
    return "";
  }
  if (/<(?:p|h[1-3]|blockquote|pre|ul|ol|li|div|strong|b|em|i|u|s|del|code|mark|span|a|br)\b/iu.test(content)) {
    return content;
  }
  return content.split(/\n{2,}/u)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/gu, "<br>")}</p>`)
    .join("");
}

function contentToPlainText(content) {
  if (!content || !/<[a-z][^>]*>/iu.test(content)) {
    return content || "";
  }

  const parsed = new DOMParser().parseFromString(content, "text/html");
  const blockTags = new Set(["BLOCKQUOTE", "DIV", "H1", "H2", "H3", "LI", "OL", "P", "PRE", "UL"]);
  let text = "";
  const appendLineBreak = () => {
    if (text && !text.endsWith("\n")) {
      text += "\n";
    }
  };
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }
    const isBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName);
    if (isBlock) {
      appendLineBreak();
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
      appendLineBreak();
    } else {
      node.childNodes.forEach(visit);
    }
    if (isBlock) {
      appendLineBreak();
    }
  };
  visit(parsed.body);
  return text.replace(/^\n+|\n+$/gu, "").replace(/\n{3,}/gu, "\n\n");
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
  textEditor?.state.doc.descendants((node, position) => {
    if (node.isTextblock && node.textContent.trim()) {
      paragraphs.push({
        text: node.textContent.trim(),
        from: position + 1,
        to: position + node.nodeSize - 1,
      });
    }
  });
  if (paragraphs.length === 0) {
    contentToPlainText(content).split(/\n+/u).forEach((text) => {
      if (text.trim()) {
        paragraphs.push({ text: text.trim(), from: null, to: null });
      }
    });
  }
  let paragraphNumber = 0;
  for (const paragraph of paragraphs) {
    const text = paragraph.text;
    paragraphNumber += 1;

    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-outline-item";
    button.setAttribute("aria-label", `Go to paragraph ${paragraphNumber}: ${text}`);
    button.addEventListener("click", () => {
      if (paragraph.from !== null) {
        textEditor.commands.setTextSelection({ from: paragraph.from, to: paragraph.to });
        textEditor.commands.focus();
      }
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
    const content = contentToPlainText(document.content || "").toLocaleLowerCase();
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
    preview.textContent = contentToPlainText(entry.content || "").trim() || "No additional text";

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
    elements.title.value = "";
    textEditor.commands.setContent("", false);
    updateWordCount();
    hideFormattingToolbar();
    elements.breadcrumb.textContent = "Welcome";
    return;
  }

  elements.title.value = activeDocument.title || "";
  textEditor.commands.setContent(editorContentFromStored(activeDocument.content || ""), false);
  hideFormattingToolbar();
  elements.breadcrumb.textContent = activeDocument.title?.trim() || "Untitled";
  elements.date.textContent = `Last edited ${formatDate(activeDocument.updatedAt)}`;
  updateWordCount();
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
  const text = textEditor?.getText({ blockSeparator: "\n" }).trim() || "";
  const count = text ? text.split(/\s+/u).length : 0;
  elements.wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function buildColorPalette(palette, colors, kind) {
  for (const color of colors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-swatch";
    button.dataset.color = color;
    button.setAttribute("aria-label", `${kind} ${color}`);
    button.title = color;
    button.style.setProperty("--swatch-color", color);
    palette.append(button);
  }
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "palette-clear";
  clearButton.dataset.clear = "true";
  clearButton.textContent = "Default";
  palette.append(clearButton);
}

function closeFormattingPalettes() {
  elements.textColorPalette.hidden = true;
  elements.highlightPalette.hidden = true;
  elements.linkEditor.hidden = true;
  elements.toolbar.querySelectorAll("[data-palette]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
  elements.toolbar.querySelector('[data-format="link"]')?.setAttribute("aria-expanded", "false");
}

function hideFormattingToolbar() {
  window.cancelAnimationFrame(toolbarPositionFrame);
  toolbarPositionFrame = null;
  elements.toolbar.classList.remove("visible");
  elements.toolbar.setAttribute("aria-hidden", "true");
  closeFormattingPalettes();
  window.clearTimeout(toolbarHideTimer);
  toolbarHideTimer = window.setTimeout(() => {
    elements.toolbar.hidden = true;
  }, 140);
}

function renderSlashOptions(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  slashMatches = slashCommands.filter((command) =>
    `${command.title} ${command.keywords}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  slashActiveIndex = Math.min(slashActiveIndex, slashMatches.length - 1);
  elements.slashOptions.replaceChildren();
  elements.slashEmpty.hidden = slashMatches.length > 0;

  slashMatches.forEach((command, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.id = `slash-command-option-${index}`;
    option.className = "slash-command-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === slashActiveIndex));
    option.dataset.commandIndex = String(index);

    const icon = document.createElement("span");
    icon.className = "slash-command-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = command.icon;

    const copy = document.createElement("span");
    copy.className = "slash-command-copy";
    const title = document.createElement("span");
    title.className = "slash-command-title";
    title.textContent = command.title;
    const description = document.createElement("span");
    description.className = "slash-command-description";
    description.textContent = command.description;
    copy.append(title, description);
    option.append(icon, copy);
    elements.slashOptions.append(option);
  });

  if (slashMatches.length > 0) {
    elements.content.setAttribute("aria-activedescendant", `slash-command-option-${slashActiveIndex}`);
  } else {
    elements.content.removeAttribute("aria-activedescendant");
  }
}

function positionSlashMenu() {
  if (!slashRange || !textEditor) {
    return;
  }
  const caret = textEditor.view.coordsAtPos(textEditor.state.selection.from);
  const bounds = elements.slashMenu.getBoundingClientRect();
  const padding = 12;
  const left = Math.max(padding, Math.min(caret.left, window.innerWidth - bounds.width - padding));
  const below = caret.bottom + 8;
  const top = below + bounds.height <= window.innerHeight - padding
    ? below
    : Math.max(padding, caret.top - bounds.height - 8);
  elements.slashMenu.style.left = `${left}px`;
  elements.slashMenu.style.top = `${top}px`;
}

function closeSlashMenu() {
  slashRange = null;
  slashMatches = [];
  slashQuery = null;
  elements.slashMenu.hidden = true;
  elements.content.setAttribute("aria-expanded", "false");
  elements.content.removeAttribute("aria-activedescendant");
}

function syncSlashMenu() {
  if (!textEditor || !textEditor.isFocused || !textEditor.state.selection.empty) {
    closeSlashMenu();
    return;
  }
  const selection = textEditor.state.selection;
  const textBeforeCursor = selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\ufffc");
  const trigger = /(^|\s)\/([^\n]*)$/u.exec(textBeforeCursor);
  if (!trigger) {
    closeSlashMenu();
    return;
  }

  slashRange = {
    from: selection.$from.start() + trigger.index + trigger[1].length,
    to: selection.from,
  };
  if (trigger[2] !== slashQuery) {
    slashActiveIndex = 0;
    slashQuery = trigger[2];
  }
  elements.slashMenu.hidden = false;
  elements.content.setAttribute("aria-expanded", "true");
  renderSlashOptions(trigger[2]);
  positionSlashMenu();
}

function moveSlashSelection(offset) {
  if (slashMatches.length === 0) {
    return;
  }
  slashActiveIndex = (slashActiveIndex + offset + slashMatches.length) % slashMatches.length;
  elements.slashOptions.querySelectorAll(".slash-command-option").forEach((option, index) => {
    option.setAttribute("aria-selected", String(index === slashActiveIndex));
  });
  elements.content.setAttribute("aria-activedescendant", `slash-command-option-${slashActiveIndex}`);
  elements.slashOptions.children[slashActiveIndex].scrollIntoView({ block: "nearest" });
}

function runSlashCommand(index) {
  const command = slashMatches[index];
  if (!command || !slashRange) {
    return;
  }
  const range = slashRange;
  closeSlashMenu();
  const chain = textEditor.chain().focus().deleteRange(range);
  if (!command.command(chain).run()) {
    showToast(`Couldn't insert ${command.title.toLocaleLowerCase()} here.`);
  }
}

function positionFormattingToolbar() {
  if (!textEditor || textEditor.state.selection.empty) {
    hideFormattingToolbar();
    return;
  }
  const { from, to } = textEditor.state.selection;
  const start = textEditor.view.coordsAtPos(from);
  const end = textEditor.view.coordsAtPos(to);
  const toolbarBounds = elements.toolbar.getBoundingClientRect();
  const padding = 12;
  const left = Math.min(
    Math.max((start.left + end.right) / 2 - toolbarBounds.width / 2, padding),
    window.innerWidth - toolbarBounds.width - padding,
  );
  const top = Math.min(start.top, end.top) - toolbarBounds.height - 10;
  elements.toolbar.style.left = `${left}px`;
  elements.toolbar.style.top = `${top >= padding ? top : Math.max(start.bottom, end.bottom) + 10}px`;
}

function updateFormattingToolbar() {
  if (!textEditor || textEditor.state.selection.empty || !textEditor.isFocused) {
    hideFormattingToolbar();
    return;
  }

  window.clearTimeout(toolbarHideTimer);
  elements.toolbar.hidden = false;
  elements.toolbar.setAttribute("aria-hidden", "false");
  positionFormattingToolbar();
  window.requestAnimationFrame(() => elements.toolbar.classList.add("visible"));
  elements.toolbar.querySelectorAll("[data-format]").forEach((button) => {
    const format = button.dataset.format;
    const active = format === "link"
      ? textEditor.isActive("link")
      : format === "color"
        ? Boolean(textEditor.getAttributes("textStyle").color)
        : format === "highlight"
          ? textEditor.isActive("highlight")
          : textEditor.isActive(format);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.toolbar.querySelectorAll("[data-heading]").forEach((button) => {
    button.setAttribute("aria-pressed", String(
      textEditor.isActive("heading", { level: Number(button.dataset.heading) }),
    ));
  });
  elements.toolbar.querySelector('[data-palette="text"]').setAttribute(
    "aria-pressed",
    String(Boolean(textEditor.getAttributes("textStyle").color)),
  );
  elements.toolbar.querySelector('[data-palette="highlight"]').setAttribute(
    "aria-pressed",
    String(textEditor.isActive("highlight")),
  );
}

function editLink() {
  if (elements.toolbar.hidden) {
    updateFormattingToolbar();
  }
  closeFormattingPalettes();
  elements.linkInput.value = textEditor.getAttributes("link").href || "";
  elements.linkEditor.hidden = false;
  elements.toolbar.querySelector('[data-format="link"]').setAttribute("aria-expanded", "true");
  elements.linkInput.focus();
}

function applyLink(href) {
  const chain = textEditor.chain().focus().extendMarkRange("link");
  if (href.trim()) {
    chain.setLink({ href: href.trim() }).run();
  } else {
    chain.unsetLink().run();
  }
  elements.linkEditor.hidden = true;
  elements.toolbar.querySelector('[data-format="link"]').setAttribute("aria-expanded", "false");
  updateFormattingToolbar();
}

function applyToolbarAction(button) {
  if (button.dataset.heading) {
    textEditor.chain().focus()
      .toggleHeading({ level: Number(button.dataset.heading) })
      .run();
    return;
  }

  const command = {
    bold: "toggleBold",
    italic: "toggleItalic",
    underline: "toggleUnderline",
    strike: "toggleStrike",
    code: "toggleCode",
  }[button.dataset.format];
  if (command) {
    textEditor.chain().focus()[command]().run();
  } else if (button.dataset.format === "link") {
    editLink();
  }
}

function bindFormattingToolbar() {
  buildColorPalette(
    elements.textColorPalette,
    ["#37352f", "#9b9a97", "#d44c47", "#d9730d", "#cb912f", "#448361", "#337ea9", "#9065b0"],
    "Text color",
  );
  buildColorPalette(
    elements.highlightPalette,
    ["#fef3c7", "#fde2e2", "#e4f2e7", "#e2efff", "#eee5f8", "#f0efed"],
    "Highlight",
  );

  elements.toolbar.addEventListener("mousedown", (event) => {
    if (!event.target.closest("input")) {
      event.preventDefault();
    }
  });
  elements.toolbar.addEventListener("click", (event) => {
    const paletteButton = event.target.closest("[data-palette]");
    if (paletteButton) {
      const palette = paletteButton.dataset.palette === "text"
        ? elements.textColorPalette
        : elements.highlightPalette;
      const wasOpen = !palette.hidden;
      closeFormattingPalettes();
      palette.hidden = wasOpen;
      paletteButton.setAttribute("aria-expanded", String(!wasOpen));
      return;
    }

    const swatch = event.target.closest(".palette-swatch, .palette-clear");
    if (swatch) {
      const palette = swatch.closest(".toolbar-palette");
      if (palette === elements.textColorPalette) {
        const chain = textEditor.chain().focus();
        (swatch.dataset.clear ? chain.unsetColor() : chain.setColor(swatch.dataset.color)).run();
      } else {
        const chain = textEditor.chain().focus();
        (swatch.dataset.clear ? chain.unsetHighlight() : chain.setHighlight({ color: swatch.dataset.color })).run();
      }
      closeFormattingPalettes();
      updateFormattingToolbar();
      return;
    }

    const button = event.target.closest("[data-format], [data-heading]");
    if (button) {
      applyToolbarAction(button);
    }
  });
  elements.linkEditor.addEventListener("submit", (event) => {
    event.preventDefault();
    applyLink(elements.linkInput.value);
  });
  elements.linkEditor.querySelector("[data-action='remove-link']").addEventListener("click", () => {
    applyLink("");
  });
}

function scheduleSave() {
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  if (!activeDocument) {
    return;
  }

  activeDocument.title = elements.title.value;
  activeDocument.content = textEditor.getHTML();
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

async function loadWorkspaceDocuments(preferredDocumentId = activeDocumentId) {
  try {
    documents = await request(API_URL);
  } catch (error) {
    documents = loadLocalDraftDocuments();
    sortDocuments();
    activeDocumentId = documents.find((entry) => entry.id === preferredDocumentId)?.id ?? documents[0]?.id ?? null;
    renderEditor();
    renderList();
    if (elements.sidebar.classList.contains("sidebar-showing-document")) {
      const activeDocument = documents.find((entry) => entry.id === activeDocumentId);
      if (activeDocument) {
        showSidebarDocument(activeDocument);
      } else {
        showDocumentList();
      }
    }
    if (documents.length > 0) {
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
  activeDocumentId = documents.find((entry) => entry.id === preferredDocumentId)?.id ?? documents[0]?.id ?? null;
  renderEditor();
  renderList();
  if (elements.sidebar.classList.contains("sidebar-showing-document")) {
    const activeDocument = documents.find((entry) => entry.id === activeDocumentId);
    if (activeDocument) {
      showSidebarDocument(activeDocument);
    } else {
      showDocumentList();
    }
  }
  for (const documentId of restoredDocumentIds) {
    void saveDocument(documentId);
  }
  setSaveStatus("saved", "All changes saved");
}

async function refreshAccountWorkspace(previousWorkspaceId, preferredDocumentId) {
  const session = await request("/api/auth/session");
  rekeyLocalDrafts(previousWorkspaceId, session.workspaceId);
  currentUser = session;
  elements.search.value = "";
  updateAccountMenu();
  await loadWorkspaceDocuments(preferredDocumentId);
}

async function authenticateAccount(email, password) {
  const previousWorkspaceId = currentUser.workspaceId;
  const preferredDocumentId = activeDocumentId;
  if (!(await flushSave())) {
    return;
  }
  await request("/api/auth/login", {
    method: "POST",
    body: new URLSearchParams({ email, password }),
  });
  await refreshAccountWorkspace(previousWorkspaceId, preferredDocumentId);
  elements.accountDialog.close();
  closeAccountMenu();
  showToast("You’re logged in. Your notes are ready.");
}

async function logoutAccount() {
  if (!(await flushSave())) {
    return;
  }
  await request("/api/auth/logout", { method: "POST" });
  const guestSession = await request("/api/auth/session");
  currentUser = guestSession;
  elements.search.value = "";
  updateAccountMenu();
  await loadWorkspaceDocuments(null);
  closeAccountMenu();
  showToast("You’re now using Squareone as a guest.");
}

async function submitAccountForm(event) {
  event.preventDefault();
  elements.accountFormError.hidden = true;
  try {
    if (accountDialogMode === "login") {
      await authenticateAccount(elements.accountEmailInput.value.trim(), elements.accountPasswordInput.value);
    } else if (accountDialogMode === "signup") {
      if (!(await flushSave())) {
        return;
      }
      const email = elements.accountEmailInput.value.trim();
      const password = elements.accountPasswordInput.value;
      await request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: elements.accountNameInput.value.trim(),
          email,
          password,
        }),
      });
      await authenticateAccount(email, password);
    } else if (accountDialogMode === "profile") {
      const profile = await request("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: elements.accountNameInput.value.trim(),
          email: elements.accountEmailInput.value.trim(),
          avatarColor: elements.accountAvatarColorInput.value,
        }),
      });
      currentUser = profile;
      updateAccountMenu();
      elements.accountDialog.close();
      showToast("Your profile was updated.");
    } else if (accountDialogMode === "settings") {
      await request("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: elements.accountCurrentPasswordInput.value,
          newPassword: elements.accountNewPasswordInput.value,
        }),
      });
      elements.accountDialog.close();
      showToast("Your password was updated.");
    }
  } catch (error) {
    showAccountFormError(error.message || "That didn’t work. Please try again.");
  }
}

async function initialize() {
  try {
    currentUser = await request("/api/auth/session");
    updateAccountMenu();
  } catch (error) {
    setSaveStatus("error", "Couldn't connect");
    showToast("Squareone couldn’t connect. Refresh to try again.");
    console.error("Unable to load the guest or account session:", error);
    return;
  }
  await loadWorkspaceDocuments(null);
}

elements.newButton.addEventListener("click", () => void createDocument());
elements.welcomeCreate.addEventListener("click", () => void createDocument());
elements.deleteButton.addEventListener("click", () => void deleteDocument());
elements.documentActions.querySelectorAll("[data-export-format]").forEach((button) => {
  button.addEventListener("click", () => void exportDocument(button.dataset.exportFormat));
});
elements.whatsappButton.addEventListener("click", () => void shareWithWhatsApp());
elements.accountMenuTrigger.addEventListener("click", () => {
  const isExpanded = elements.accountMenuTrigger.getAttribute("aria-expanded") === "true";
  elements.accountMenuPanel.hidden = isExpanded;
  elements.accountMenuTrigger.setAttribute("aria-expanded", String(!isExpanded));
});
elements.accountProfile.addEventListener("click", () => {
  closeAccountMenu();
  showAccountDialog("profile");
});
elements.accountSettings.addEventListener("click", () => {
  closeAccountMenu();
  showAccountDialog("settings");
});
elements.accountLogin.addEventListener("click", () => {
  closeAccountMenu();
  showAccountDialog("login");
});
elements.accountLogout.addEventListener("click", () => {
  void logoutAccount().catch((error) => {
    showToast(error.message || "Couldn’t log out. Please try again.");
    console.error("Unable to log out:", error);
  });
});
elements.accountDialogClose.addEventListener("click", () => elements.accountDialog.close());
elements.accountGuestContinue.addEventListener("click", () => elements.accountDialog.close());
elements.accountModeToggle.addEventListener("click", () => {
  const name = elements.accountNameInput.value;
  const email = elements.accountEmailInput.value;
  showAccountDialog(accountDialogMode === "login" ? "signup" : "login");
  elements.accountNameInput.value = name;
  elements.accountEmailInput.value = email;
});
elements.accountForm.addEventListener("submit", (event) => void submitAccountForm(event));
document.addEventListener("click", (event) => {
  if (!elements.accountMenu.contains(event.target)) {
    closeAccountMenu();
  }
});
elements.search.addEventListener("input", renderList);
elements.title.addEventListener("input", scheduleSave);
bindFormattingToolbar();
elements.slashMenu.addEventListener("mousedown", (event) => {
  if (event.target.closest(".slash-command-option")) {
    event.preventDefault();
  }
});
elements.slashMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".slash-command-option");
  if (option) {
    runSlashCommand(Number(option.dataset.commandIndex));
  }
});
textEditor = new Editor({
  element: elements.content,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: "Begin with a thought..." }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Callout,
  ],
  editorProps: {
    attributes: {
      class: "tiptap-content",
      role: "textbox",
      "aria-multiline": "true",
      "data-placeholder": "Begin with a thought...",
      spellcheck: "true",
    },
    handleKeyDown(_view, event) {
      if (slashRange) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveSlashSelection(1);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveSlashSelection(-1);
          return true;
        }
        if (event.key === "Enter" && slashMatches.length > 0) {
          event.preventDefault();
          runSlashCommand(slashActiveIndex);
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeSlashMenu();
          return true;
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        if (textEditor.state.selection.empty && !textEditor.isActive("link")) {
          return false;
        }
        event.preventDefault();
        editLink();
        return true;
      }
      return false;
    },
  },
  onUpdate() {
    updateWordCount();
    scheduleSave();
    syncSlashMenu();
  },
  onSelectionUpdate() {
    updateFormattingToolbar();
    syncSlashMenu();
  },
  onFocus() {
    updateFormattingToolbar();
    syncSlashMenu();
  },
  onBlur() {
    window.setTimeout(() => {
      if (!elements.toolbar.contains(document.activeElement)) {
        hideFormattingToolbar();
      }
      if (!elements.slashMenu.contains(document.activeElement)) {
        closeSlashMenu();
      }
    }, 0);
  },
});
window.addEventListener("resize", () => {
  setSidebarWidth(sidebarWidth);
  if (!elements.toolbar.hidden) {
    positionFormattingToolbar();
  }
  if (!elements.slashMenu.hidden) {
    positionSlashMenu();
  }
});
window.addEventListener("scroll", () => {
  if (!elements.toolbar.hidden) {
    positionFormattingToolbar();
  }
  if (!elements.slashMenu.hidden) {
    positionSlashMenu();
  }
}, true);

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLocaleLowerCase() === "n") {
    event.preventDefault();
    void createDocument();
  } else if (
    event.key === "/"
    && document.activeElement !== elements.search
    && !elements.content.contains(document.activeElement)
  ) {
    event.preventDefault();
    elements.search.focus();
  } else if (event.key === "Escape" && document.activeElement === elements.search) {
    elements.search.value = "";
    renderList();
    elements.search.blur();
  }
});

void initialize();
