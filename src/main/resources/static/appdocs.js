import { createPreferencesController } from "./preferences-controller.js?v=25";
import { createAccountController } from "./account-controller.js?v=25";
import { createAccountUi } from "./account-ui.js?v=25";
import { contentToPlainText, editorContentFromStored } from "./document-content.js?v=25";
import { createDocumentController } from "./document-controller.js?v=25";
import { createDocumentStorage } from "./document-storage.js?v=25";
import { createDocumentUi } from "./document-ui.js?v=25";
import { initializeEditorUi } from "./editor-ui.js?v=25";
import { createSidebarController } from "./sidebar-controller.js?v=25";
import { createThemeController } from "./theme-controller.js?v=25";
import { createTrashController } from "./trash-controller.js?v=25";
import { createWorkspaceHome } from "./workspace-home.js?v=25";
import { createArchiveController } from "./archive-controller.js?v=25";
import { createDocumentDetails } from "./document-details.js?v=25";

const elements = {
  list: document.querySelector("#document-list"),
  favoriteList: document.querySelector("#favorite-list"),
  favoritesSection: document.querySelector("#favorites-section"),
  documentOutlineTitle: document.querySelector("#document-outline-title"),
  documentOutlineList: document.querySelector("#document-outline-list"),
  documentOutlinePane: document.querySelector("#document-outline-pane"),
  count: document.querySelector("#document-count"),
  search: document.querySelector("#search"),
  searchShortcut: document.querySelector("#search-shortcut"),
  searchToggle: document.querySelector("#search-toggle"),
  newButton: document.querySelector("#new-document"),
  welcomeCreate: document.querySelector("#welcome-create"),
  welcome: document.querySelector("#welcome-state"),
  workspaceLoading: document.querySelector("#workspace-loading"),
  workspaceError: document.querySelector("#workspace-error"),
  workspaceRetry: document.querySelector("#workspace-retry"),
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
  editorWrap: document.querySelector(".editor-wrap"),
  blockControls: document.querySelector("#block-controls"),
  blockInsertButton: document.querySelector("#block-insert-button"),
  blockDragButton: document.querySelector("#block-drag-button"),
  blockDropIndicator: document.querySelector("#block-drop-indicator"),
  blockMoveStatus: document.querySelector("#block-move-status"),
  tableControls: document.querySelector("#table-controls"),
  tableActionsTrigger: document.querySelector("#table-actions-trigger"),
  tableActionsMenu: document.querySelector("#table-actions-menu"),
  tableAddRow: document.querySelector("#table-add-row"),
  tableAddColumn: document.querySelector("#table-add-column"),
  breadcrumbTrail: document.querySelector(".breadcrumb"),
  date: document.querySelector("#document-date"),
  wordCount: document.querySelector("#word-count"),
  characterCount: document.querySelector("#character-count"),
  focusToggle: document.querySelector("#focus-toggle"),
  widePageToggle: document.querySelector("#wide-page-toggle"),
  deleteButton: document.querySelector("#delete-document"),
  documentActions: document.querySelector("#document-actions"),
  whatsappButton: document.querySelector("#share-whatsapp"),
  saveStatus: document.querySelector("#save-status"),
  saveStatusText: document.querySelector("#save-status-text"),
  toast: document.querySelector("#toast"),
  appShell: document.querySelector(".app-shell"),
  workspace: document.querySelector(".workspace"),
  sidebar: document.querySelector(".sidebar"),
  sidebarClose: document.querySelector("#sidebar-close"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  sidebarResizeHandle: document.querySelector("#sidebar-resize-handle"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  accountMenu: document.querySelector("#account-menu"),
  accountMenuTrigger: document.querySelector("#account-menu-trigger"),
  accountMenuPanel: document.querySelector("#account-menu-panel"),
  accountTheme: document.querySelector("#account-theme"),
  accountAvatar: document.querySelector("#account-avatar"),
  accountMenuName: document.querySelector("#account-menu-name"),
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
};

let documents = [];
let activeDocumentId = null;
let toastTimer = null;
let editorUi = null;
let workspaceHome = null;
let preferencesController = null;
let currentUser = {
  authenticated: false,
  name: "Guest",
  email: null,
  avatar: "G",
  avatarColor: "#617459",
};

function setSaveStatus(status, text) {
  elements.saveStatus.classList.remove("saving", "error", "local", "waiting");
  if (status !== "saved") {
    elements.saveStatus.classList.add(status);
  }
  elements.saveStatusText.textContent = text;
  elements.saveStatus.dataset.state = status;
  document.querySelector("#retry-sync").hidden = status === "saved" || status === "saving";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4000);
}

const accountUi = createAccountUi(elements, () => currentUser);
const documentStorage = createDocumentStorage({
  getCurrentUser: () => currentUser,
  showToast,
});
const sidebarController = createSidebarController(elements, (patch) => preferencesController?.update(patch));
const themeController = createThemeController(elements.accountTheme, (patch) => preferencesController?.update(patch));
let documentController;
const documentUi = createDocumentUi({
  elements,
  getDocuments: () => documents,
  getActiveDocumentId: () => activeDocumentId,
  getEditorUi: () => editorUi,
  getWorkspaceId: () => currentUser.workspaceId,
  onDocumentsChanged: () => workspaceHome?.render(),
  onGoHome: () => void documentController.showHome(),
  onPreferenceChange: (patch) => preferencesController?.update(patch),
  onEditorStateChange: () => applyFocusMode(preferencesController?.settings.focusMode || false),
  onArchiveDocument: (id) => void documentController.archiveDocument(id),
  onReorderDocument: async (id, direction) => {
    if (await documentController.reorderDocument(id, direction)) preferencesController.update({ documentSort: "manual" });
  },
  contentToPlainText,
  editorContentFromStored,
  onOpenDocument: (documentId) => {
    void documentController.openDocument(documentId);
    sidebarController.closeMobileSidebar();
  },
  onRenameDocument: (documentId) => void documentController.renameDocument(documentId),
  onDuplicateDocument: (documentId) => void documentController.duplicateDocument(documentId),
  onToggleFavorite: (documentId) => void documentController.toggleFavorite(documentId),
  onMoveDocument: (documentId, parentId) => void documentController.moveDocument(documentId, parentId),
  onDeleteDocument: (documentId) => void documentController.deleteDocument(documentId),
});

documentController = createDocumentController({
  elements,
  getDocuments: () => documents,
  setDocuments: (nextDocuments) => {
    documents = nextDocuments;
  },
  getActiveDocumentId: () => activeDocumentId,
  setActiveDocumentId: (documentId) => {
    activeDocumentId = documentId;
  },
  getEditorUi: () => editorUi,
  documentStorage,
  documentUi,
  setSaveStatus,
  showToast,
});

function applyFocusMode(focused) {
  const enabled = Boolean(focused && activeDocumentId);
  elements.appShell.classList.toggle("focus-mode", enabled);
  elements.focusToggle.setAttribute("aria-pressed", String(enabled));
  elements.focusToggle.textContent = enabled ? "Exit focus" : "Focus";
}
preferencesController = createPreferencesController({
  request: documentStorage.request, getCurrentUser: () => currentUser, showToast,
  apply: (settings) => {
    themeController.setMode(settings.theme);
    sidebarController.applyPreferences(settings);
    elements.appShell.classList.toggle("wide-page", settings.widePage);
    elements.widePageToggle.setAttribute("aria-pressed", String(settings.widePage));
    applyFocusMode(settings.focusMode);
    const fonts = { sans: "var(--sans)", serif: "var(--serif)", mono: "ui-monospace, monospace" };
    elements.appShell.style.setProperty("--editor-font-family", fonts[settings.fontFamily] || fonts.sans);
    elements.appShell.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
    elements.appShell.style.setProperty("--editor-line-height", String(settings.lineHeight));
    document.querySelector("#preference-font").value = settings.fontFamily;
    document.querySelector("#preference-font-size").value = settings.fontSize;
    document.querySelector("#preference-line-height").value = settings.lineHeight;
    documentUi.applyPreferences(settings);
  },
});
document.querySelector("#writing-preferences-form").addEventListener("submit", (event) => {
  event.preventDefault();
  preferencesController.update({
    fontFamily: document.querySelector("#preference-font").value,
    fontSize: Number(document.querySelector("#preference-font-size").value),
    lineHeight: Number(document.querySelector("#preference-line-height").value),
  });
});

const accountController = createAccountController({
  preferencesController,
  elements,
  accountUi,
  documentStorage,
  documentController,
  getCurrentUser: () => currentUser,
  setCurrentUser: (user) => {
    currentUser = user;
  },
  getActiveDocumentId: () => activeDocumentId,
  setSaveStatus,
  showToast,
});

workspaceHome = createWorkspaceHome({
  getDocuments: () => documents,
  contentToPlainText,
  onOpenDocument: (id) => void documentController.openDocument(id),
});
document.querySelector("#workspace-home").addEventListener("click", () => {
  void documentController.showHome();
  sidebarController.closeMobileSidebar();
});

const trashController = createTrashController({
  request: documentStorage.request,
  showToast,
  onRestore: (entry) => {
    if (!documents.some((document) => document.id === entry.id)) documents.push(entry);
    documentUi.renderList();
  },
});
const archiveController = createArchiveController({
  request: documentStorage.request,
  onRestore: documentController.applyServerDocument,
  showToast,
});
document.querySelector("#open-archive").addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  archiveController.open();
});
const documentDetails = createDocumentDetails({
  request: documentStorage.request,
  getActiveDocument: () => documents.find((entry) => entry.id === activeDocumentId),
  syncPendingChanges: documentController.syncPendingChanges,
  onUpdate: documentController.applyServerDocument,
  showToast,
});
document.querySelector("#open-history").addEventListener("click", () => {
  elements.documentActions.open = false;
  void documentDetails.openHistory();
});
document.querySelector("#open-document-details").addEventListener("click", () => {
  elements.documentActions.open = false;
  void documentDetails.openDetails();
});
document.querySelector("#open-trash").addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  trashController.open();
});

elements.newButton.addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  void documentController.createDocument();
});
elements.welcomeCreate.addEventListener("click", () => void documentController.createDocument());
elements.deleteButton.addEventListener("click", () => void documentController.deleteDocument());
document.querySelector("#retry-sync").addEventListener("click", () => {
  if (documentController.hasConflicts()) void documentController.resolveConflicts();
  else void documentController.syncPendingChanges();
});
elements.documentActions.querySelectorAll("[data-export-format]").forEach((button) => {
  button.addEventListener("click", () => void documentController.exportDocument(button.dataset.exportFormat));
});
elements.whatsappButton.addEventListener("click", () => void documentController.shareWithWhatsApp());
elements.searchToggle.addEventListener("click", () => {
  sidebarController.focusSearch();
});
elements.widePageToggle.addEventListener("click", () => {
  const isWide = elements.appShell.classList.toggle("wide-page");
  elements.widePageToggle.setAttribute("aria-pressed", String(isWide));
  preferencesController.update({ widePage: isWide });
});
elements.focusToggle.addEventListener("click", () => {
  const isFocused = elements.appShell.classList.toggle("focus-mode");
  elements.focusToggle.setAttribute("aria-pressed", String(isFocused));
  elements.focusToggle.textContent = isFocused ? "Exit focus" : "Focus";
  preferencesController.update({ focusMode: isFocused });
});
elements.accountTheme.addEventListener("click", () => themeController.cycleTheme());

elements.accountMenuTrigger.addEventListener("click", () => {
  const isExpanded = elements.accountMenuTrigger.getAttribute("aria-expanded") === "true";
  elements.accountMenuPanel.hidden = isExpanded;
  elements.accountMenuTrigger.setAttribute("aria-expanded", String(!isExpanded));
  if (!isExpanded) {
    elements.accountMenuPanel.querySelector('[role="menuitem"]:not([hidden])')?.focus();
  }
});
elements.accountMenuPanel.addEventListener("keydown", (event) => {
  const items = Array.from(elements.accountMenuPanel.querySelectorAll('[role="menuitem"]:not([hidden]):not(:disabled)'));
  if (items.length === 0) {
    return;
  }
  const currentIndex = items.indexOf(document.activeElement);
  let nextIndex;
  if (event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1 + items.length) % items.length;
  } else if (event.key === "ArrowUp") {
    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = items.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  items[nextIndex].focus();
});
elements.accountProfile.addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  accountUi.closeMenu();
  accountUi.showDialog("profile");
});
elements.accountSettings.addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  accountUi.closeMenu();
  accountUi.showDialog("settings");
});
elements.accountLogin.addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  accountUi.closeMenu();
  accountUi.showDialog("login");
});
document.querySelector("#guest-signup").addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  accountUi.showDialog("signup");
});
document.querySelector("#guest-login").addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  accountUi.showDialog("login");
});
elements.accountLogout.addEventListener("click", () => {
  sidebarController.closeMobileSidebar(false);
  void accountController.logoutAccount().catch((error) => {
    showToast(error.message || "Couldn’t log out. Please try again.");
    console.error("Unable to log out:", error);
  });
});
elements.accountDialogClose.addEventListener("click", () => elements.accountDialog.close());
elements.accountGuestContinue.addEventListener("click", () => elements.accountDialog.close());
elements.accountModeToggle.addEventListener("click", () => {
  const name = elements.accountNameInput.value;
  const email = elements.accountEmailInput.value;
  accountUi.showDialog(accountUi.mode === "login" ? "signup" : "login");
  elements.accountNameInput.value = name;
  elements.accountEmailInput.value = email;
});
elements.accountForm.addEventListener("submit", (event) => {
  void accountController.submitAccountForm(event);
});
document.addEventListener("click", (event) => {
  if (!elements.accountMenu.contains(event.target)) {
    accountUi.closeMenu();
  }
});

elements.search.addEventListener("input", documentUi.renderList);
elements.search.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    documentUi.focusSearchResult(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    documentUi.focusSearchResult(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    documentUi.openSearchResult();
  } else if (event.key === "Escape") {
    if (elements.search.value) {
      elements.search.value = "";
      documentUi.renderList();
    } else {
      elements.search.blur();
    }
  }
});
elements.title.addEventListener("input", documentController.scheduleSave);
const isMacPlatform = /Mac|iPhone|iPad/u.test(navigator.platform);
const shortcutModifier = isMacPlatform ? "⌘" : "Ctrl+";
elements.searchShortcut.textContent = `${isMacPlatform ? "⌘" : "Ctrl"} K`;
elements.newButton.querySelector(".shortcut").textContent = `${shortcutModifier} N`;
elements.welcome.querySelector(".keyboard-hint kbd").textContent = shortcutModifier;
for (const [format, label] of [["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"], ["link", "Link"]]) {
  const button = elements.toolbar.querySelector(`[data-format="${format}"]`);
  button.title = `${label} (${shortcutModifier}${format === "link" ? "K" : format[0].toUpperCase()})`;
}
try {
  const widePage = window.localStorage.getItem("squareone.wide-page.v1") === "true";
  elements.appShell.classList.toggle("wide-page", widePage);
  elements.widePageToggle.setAttribute("aria-pressed", String(widePage));
} catch (error) {
  console.warn("Unable to load page width preference:", error);
}
editorUi = initializeEditorUi({
  elements,
  onContentChange: documentController.scheduleSave,
  onResize: sidebarController.refreshSidebarWidth,
  showToast,
});

document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]")) return;
  const modifier = event.metaKey || event.ctrlKey;
  const key = event.key.toLocaleLowerCase();
  if (event.key === "Escape" && elements.appShell.classList.contains("focus-mode")) {
    elements.appShell.classList.remove("focus-mode");
    elements.focusToggle.setAttribute("aria-pressed", "false");
    elements.focusToggle.textContent = "Focus";
    preferencesController.update({ focusMode: false });
    editorUi.editor.commands.focus();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && elements.appShell.classList.contains("mobile-sidebar-open")) {
    sidebarController.closeMobileSidebar();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && !elements.accountMenuPanel.hidden) {
    accountUi.closeMenu();
    elements.accountMenuTrigger.focus();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    const openDetails = document.querySelector("details[open]");
    if (openDetails) {
      openDetails.open = false;
      openDetails.querySelector(":scope > summary")?.focus();
      event.preventDefault();
      return;
    }
  }
  if (modifier && (event.key === "\\" || (event.code === "Backslash" && !event.shiftKey))) {
    event.preventDefault();
    if (elements.appShell.classList.contains("focus-mode")) {
      elements.focusToggle.click();
      return;
    }
    sidebarController.cycleSidebarMode();
  } else if (
    modifier
    && key === "k"
    && !elements.content.contains(event.target)
    && !elements.accountDialog.contains(event.target)
  ) {
    event.preventDefault();
    if (elements.appShell.classList.contains("focus-mode")) {
      elements.focusToggle.click();
    }
    sidebarController.focusSearch();
    elements.search.select();
  } else if (event.altKey && event.shiftKey && key === "f") {
    event.preventDefault();
    elements.focusToggle.click();
  } else if (modifier && key === "n") {
    event.preventDefault();
    void documentController.createDocument();
  }
});

await accountController.initialize();
