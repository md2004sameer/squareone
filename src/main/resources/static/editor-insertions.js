import { editorCommands, commandAvailable, commandChain, commandIcon } from "./editor-commands.js?v=31";
import { positionPopup, visualBounds, workspaceBounds } from "./editor-positioning.js?v=31";

export function createEditorInsertions({ elements, editor, getDocumentId, showToast, closeEditorMenus }) {
  const dock = document.querySelector("#editor-dock");
  const menu = document.querySelector("#editor-command-menu");
  const dialog = document.querySelector("#editor-insert-dialog");
  const form = document.querySelector("#editor-insert-form");
  const imageFields = document.querySelector("#editor-image-fields");
  const dateFields = document.querySelector("#editor-date-fields");
  const urlInput = document.querySelector("#editor-image-url");
  const altInput = document.querySelector("#editor-image-alt");
  const dateInput = document.querySelector("#editor-date-value");
  const error = document.querySelector("#editor-insert-error");
  let menuContext = null;
  let pending = null;
  let menuTrigger = null;

  function capture(slashRange = null) {
    return { documentId: getDocumentId(), selection: editor.state.selection, slashRange };
  }
  function closeMenu(returnFocus = false) {
    menu.hidden = true;
    menuTrigger?.setAttribute("aria-expanded", "false");
    if (returnFocus) menuTrigger?.focus();
    menuContext = null;
  }
  function contextValid(context) {
    return Boolean(context?.documentId && context.documentId === getDocumentId());
  }
  function perform(command, context, value) {
    if (!contextValid(context)) {
      showToast("Insertion cancelled because you switched documents.");
      return false;
    }
    if (!commandAvailable(editor, command, context)) {
      showToast(`Choose an editable text block to use ${command.title.toLocaleLowerCase()}.`);
      return false;
    }
    return command.execute(commandChain(editor, context), value).run();
  }
  function openDialog(command, context) {
    closeMenu();
    closeEditorMenus();
    pending = { command, context };
    error.hidden = true;
    document.querySelector("#editor-insert-title").textContent = `Insert ${command.dialog}`;
    imageFields.hidden = command.dialog !== "image";
    dateFields.hidden = command.dialog !== "date";
    imageFields.disabled = imageFields.hidden;
    dateFields.disabled = dateFields.hidden;
    form.reset();
    if (command.dialog === "date") {
      const today = new Date();
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }
    dialog.showModal();
    (command.dialog === "image" ? urlInput : dateInput).focus();
  }
  function run(id, { slashRange = null, context = capture(slashRange) } = {}) {
    const command = editorCommands.find((entry) => entry.id === id);
    if (!command || !contextValid(context)) return false;
    if (!commandAvailable(editor, command, context)) {
      showToast(`Choose an editable text block to use ${command.title.toLocaleLowerCase()}.`);
      return false;
    }
    if (command.dialog) {
      openDialog(command, context);
      return true;
    }
    closeMenu();
    return perform(command, context);
  }
  function openMenu(trigger, styleOnly = false) {
    const wasOpen = !menu.hidden && menuTrigger === trigger;
    closeMenu();
    if (wasOpen) return;
    closeEditorMenus();
    menuTrigger = trigger;
    menuContext = capture();
    menu.replaceChildren();
    const commands = styleOnly ? editorCommands.filter((command) => command.id === "paragraph" || command.id.startsWith("heading-")) : editorCommands;
    for (const command of commands) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.dataset.commandId = command.id;
      button.innerHTML = commandIcon(command.icon);
      const title = document.createElement("span");
      title.textContent = command.title;
      button.append(title);
      button.disabled = !commandAvailable(editor, command, menuContext);
      menu.append(button);
    }
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    layout();
    menu.querySelector("button:not(:disabled)")?.focus();
  }
  dock.querySelectorAll("[data-icon]").forEach((button) => { button.innerHTML = commandIcon(button.dataset.icon); });
  dock.addEventListener("mousedown", (event) => event.preventDefault());
  dock.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.commandMenu) openMenu(button, button.dataset.commandMenu === "style");
    else if (button.dataset.commandId) run(button.dataset.commandId);
  });
  menu.addEventListener("mousedown", (event) => event.preventDefault());
  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command-id]");
    if (button && !button.disabled) run(button.dataset.commandId, { context: menuContext });
  });
  menu.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
    const current = buttons.indexOf(document.activeElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index]?.focus();
    buttons[index]?.scrollIntoView({ block: "nearest" });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target) && !dock.contains(event.target)) closeMenu();
  });
  dialog.querySelector("[data-close-insertion]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    const context = pending?.context;
    pending = null;
    if (contextValid(context)) editor.commands.focus(undefined, { scrollIntoView: false });
    layout();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pending) return;
    let value;
    if (pending.command.dialog === "image") {
      try {
        const url = new URL(urlInput.value.trim());
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
        value = { src: url.href, alt: altInput.value.trim() };
      } catch {
        error.textContent = "Enter a complete HTTPS image URL, such as https://example.com/photo.jpg.";
        error.hidden = false;
        urlInput.focus();
        return;
      }
    } else {
      const [year, month, day] = dateInput.value.split("-").map(Number);
      const date = new Date();
      date.setFullYear(year, month - 1, day);
      date.setHours(12, 0, 0, 0);
      if (!year || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
      value = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
    }
    const completed = perform(pending.command, pending.context, value);
    if (completed) dialog.close();
  });

  // Keep real ProseMirror selections (including node/cell selections) mapped while a popup is open.
  editor.on("transaction", ({ transaction }) => {
    if (!transaction.docChanged) return;
    for (const context of new Set([menuContext, pending?.context])) {
      if (!contextValid(context)) continue;
      context.selection = context.selection.map(transaction.doc, transaction.mapping);
      if (context.slashRange) context.slashRange = {
        from: transaction.mapping.map(context.slashRange.from, 1),
        to: transaction.mapping.map(context.slashRange.to, -1),
      };
    }
  });
  function syncDocument() {
    if (menuContext && !contextValid(menuContext)) closeMenu();
    if (pending && !contextValid(pending.context)) {
      pending = null;
      dialog.close();
      showToast("Insertion cancelled because you switched documents.");
    }
    layout();
  }
  function layout() {
    dock.hidden = elements.editor.hidden || !elements.workspaceLoading.hidden || !elements.workspaceError.hidden
      || elements.appShell.classList.contains("mobile-sidebar-open") || Boolean(document.querySelector("dialog[open]"));
    if (dock.hidden) { closeMenu(); return; }
    const bounds = workspaceBounds(elements.workspace);
    const viewport = visualBounds();
    const keyboardGap = Math.max(0, window.innerHeight - viewport.bottom);
    elements.workspace.style.setProperty("--editor-keyboard-gap", `${keyboardGap}px`);
    dock.style.maxWidth = `${Math.max(0, bounds.width - 24)}px`;
    dock.style.left = `${bounds.left + bounds.width / 2}px`;
    dock.style.bottom = `calc(${keyboardGap + 18}px + env(safe-area-inset-bottom))`;
    if (!menu.hidden && menuTrigger) positionPopup(menu, menuTrigger.getBoundingClientRect(), { bounds, above: true });
    dock.querySelector('[data-command-id="taskList"]').setAttribute("aria-pressed", String(editor.isActive("taskList")));
    const heading = [1, 2, 3].find((level) => editor.isActive("heading", { level }));
    dock.querySelector("#editor-style-label").textContent = heading ? `H${heading}` : "Text";
  }
  return { run, layout, syncDocument, closeMenu };
}
