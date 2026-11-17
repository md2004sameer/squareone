import { Editor } from "./vendor/editor.js?v=25";
import { createEditorExtensions, slashCommands } from "./editor-extensions.js?v=25";

let elements;
let textEditor;
let showToast;
let onContentChange;
let onResize;
let toolbarHideTimer = null;
let toolbarPositionFrame = null;
let slashRange = null;
let slashMatches = [];
let slashActiveIndex = 0;
let slashQuery = null;
let currentBlock = null;
let activeBlockDrag = null;
let blockDropPosition = null;
let touchBlockDrag = null;
let activeTable = null;

function updateWordCount() {
  const characters = textEditor?.getText({ blockSeparator: "\n" }) || "";
  const text = characters.trim();
  const count = text ? text.split(/\s+/u).length : 0;
  elements.wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
  elements.characterCount.textContent =
    `${characters.length} ${characters.length === 1 ? "character" : "characters"}`;
}

function fuzzyMatches(candidate, query) {
  let candidateIndex = 0;
  for (const character of query) {
    candidateIndex = candidate.indexOf(character, candidateIndex);
    if (candidateIndex === -1) {
      return false;
    }
    candidateIndex += 1;
  }
  return true;
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
    fuzzyMatches(`${command.title} ${command.keywords}`.toLocaleLowerCase(), normalizedQuery),
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

function getTopLevelBlocks() {
  const blocks = [];
  textEditor.state.doc.forEach((node, pos) => {
    blocks.push({ node, pos, dom: textEditor.view.nodeDOM(pos) });
  });
  return blocks;
}

function getBlockAtPosition(position) {
  return getTopLevelBlocks().find((block) => block.pos === position) || null;
}

function getBlockFromTarget(target) {
  if (!(target instanceof Element) || !elements.content.contains(target)) {
    return null;
  }
  let blockElement = target;
  while (blockElement.parentElement && blockElement.parentElement !== elements.content) {
    blockElement = blockElement.parentElement;
  }
  return getTopLevelBlocks().find((block) => block.dom === blockElement) || null;
}

function getBlockAtSelection() {
  const selection = textEditor.state.selection;
  return getTopLevelBlocks()[selection.$from.index(0)] || null;
}

function blockLabel(node) {
  const labels = {
    blockquote: "quote",
    bulletList: "bullet list",
    callout: "callout",
    codeBlock: "code block",
    horizontalRule: "divider",
    orderedList: "numbered list",
    paragraph: "paragraph",
    taskList: "to-do list",
  };
  if (node.type.name === "heading") {
    return `heading ${node.attrs.level}`;
  }
  return labels[node.type.name] || "block";
}

function positionBlockControls() {
  if (!currentBlock?.dom?.isConnected || elements.blockControls.hidden) {
    return;
  }
  const blockBounds = currentBlock.dom.getBoundingClientRect();
  const controlsBounds = elements.blockControls.getBoundingClientRect();
  const left = Math.max(6, blockBounds.left - controlsBounds.width - 7);
  const top = Math.max(
    6,
    Math.min(blockBounds.top, window.innerHeight - controlsBounds.height - 6),
  );
  elements.blockControls.style.left = `${left}px`;
  elements.blockControls.style.top = `${top}px`;
}

function showBlockControls(block) {
  if (!block?.dom?.isConnected || activeBlockDrag) {
    return;
  }
  currentBlock = block;
  elements.blockDragButton.setAttribute("aria-label", `Move ${blockLabel(block.node)} block`);
  elements.blockInsertButton.setAttribute("aria-label", `Add a block after ${blockLabel(block.node)}`);
  elements.blockControls.hidden = false;
  elements.blockControls.classList.add("visible");
  positionBlockControls();
}

function hideBlockControls() {
  if (activeBlockDrag) {
    return;
  }
  currentBlock = null;
  elements.blockControls.classList.remove("visible");
  elements.blockControls.hidden = true;
}

function announceBlockMove(block, direction) {
  const blocks = getTopLevelBlocks();
  const index = blocks.findIndex((entry) => entry.pos === block.pos);
  elements.blockMoveStatus.textContent =
    `${blockLabel(block.node)} moved ${direction}. Position ${index + 1} of ${blocks.length}.`;
}

function reorderBlock(from, targetPosition, direction = null) {
  const state = textEditor.state;
  const node = state.doc.nodeAt(from);
  if (!node) {
    return null;
  }
  const end = from + node.nodeSize;
  if (targetPosition === from || targetPosition === end
      || (targetPosition > from && targetPosition < end)) {
    return null;
  }

  const insertionPosition = targetPosition > from ? targetPosition - node.nodeSize : targetPosition;
  const transaction = state.tr
    .delete(from, end)
    .insert(insertionPosition, node);
  textEditor.view.dispatch(transaction.scrollIntoView());

  const movedBlock = getBlockAtPosition(insertionPosition);
  if (movedBlock) {
    showBlockControls(movedBlock);
    if (direction) {
      announceBlockMove(movedBlock, direction);
    }
  }
  return movedBlock;
}

function moveBlockByDirection(block, direction) {
  const blocks = getTopLevelBlocks();
  const index = blocks.findIndex((entry) => entry.pos === block?.pos);
  if (index < 0 || (direction < 0 && index === 0) || (direction > 0 && index === blocks.length - 1)) {
    return false;
  }
  const targetPosition = direction < 0
    ? blocks[index - 1].pos
    : blocks[index + 1].pos + blocks[index + 1].node.nodeSize;
  return Boolean(reorderBlock(
    block.pos,
    targetPosition,
    direction < 0 ? "up" : "down",
  ));
}

function addBlockAfterCurrent() {
  const block = currentBlock || getBlockAtSelection();
  if (!block) {
    return;
  }
  const position = block.pos + block.node.nodeSize;
  const inserted = textEditor.chain()
    .focus()
    .insertContentAt(position, {
      type: "paragraph",
      content: [{ type: "text", text: "/" }],
    })
    .setTextSelection(position + 2)
    .run();
  if (!inserted) {
    showToast("Couldn't add a block here. Please try again.");
  }
}

function dropTargetAt(clientX, clientY) {
  const editorBounds = elements.editor.getBoundingClientRect();
  if (clientX < editorBounds.left - 48 || clientX > editorBounds.right
      || clientY < editorBounds.top || clientY > editorBounds.bottom) {
    return null;
  }
  const blocks = getTopLevelBlocks().filter((block) => block.dom instanceof Element);
  if (blocks.length === 0) {
    return { position: textEditor.state.doc.content.size, top: elements.content.getBoundingClientRect().top };
  }

  for (const block of blocks) {
    const bounds = block.dom.getBoundingClientRect();
    if (clientY < bounds.top) {
      return { position: block.pos, top: bounds.top };
    }
    if (clientY <= bounds.bottom) {
      return clientY < bounds.top + bounds.height / 2
        ? { position: block.pos, top: bounds.top }
        : { position: block.pos + block.node.nodeSize, top: bounds.bottom };
    }
  }

  const lastBlock = blocks.at(-1);
  const lastBounds = lastBlock.dom.getBoundingClientRect();
  return {
    position: textEditor.state.doc.content.size,
    top: lastBounds.bottom,
  };
}

function updateBlockDropTarget(clientX, clientY) {
  if (!activeBlockDrag) {
    return;
  }
  const target = dropTargetAt(clientX, clientY);
  if (!target || target.position === activeBlockDrag.from
      || target.position === activeBlockDrag.from + activeBlockDrag.nodeSize) {
    blockDropPosition = null;
    elements.blockDropIndicator.hidden = true;
    return;
  }

  blockDropPosition = target.position;
  const contentBounds = elements.content.getBoundingClientRect();
  elements.blockDropIndicator.style.left = `${contentBounds.left}px`;
  elements.blockDropIndicator.style.top = `${target.top}px`;
  elements.blockDropIndicator.style.width = `${contentBounds.width}px`;
  elements.blockDropIndicator.hidden = false;
}

function beginBlockDrag(block, dataTransfer) {
  if (!block) {
    return;
  }
  activeBlockDrag = { from: block.pos, nodeSize: block.node.nodeSize };
  elements.blockControls.classList.add("is-dragging");
  if (dataTransfer) {
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("text/plain", blockLabel(block.node));
  }
}

function finishBlockDrag(shouldMove) {
  let movedBlock = null;
  if (shouldMove && activeBlockDrag && blockDropPosition !== null) {
    movedBlock = reorderBlock(activeBlockDrag.from, blockDropPosition);
  }
  activeBlockDrag = null;
  blockDropPosition = null;
  elements.blockControls.classList.remove("is-dragging");
  elements.blockDropIndicator.hidden = true;
  if (movedBlock) {
    showBlockControls(movedBlock);
  } else if (!elements.blockControls.hidden) {
    positionBlockControls();
  }
}

function startTouchBlockDrag(event) {
  if (!touchBlockDrag || activeBlockDrag) {
    return;
  }
  const distance = Math.hypot(
    event.clientX - touchBlockDrag.startX,
    event.clientY - touchBlockDrag.startY,
  );
  if (distance < 7) {
    return;
  }
  beginBlockDrag(touchBlockDrag.block);
}

function getTableContextAtPosition(position) {
  let context = null;
  textEditor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "table" || pos !== position) {
      return;
    }
    const nodeDom = textEditor.view.nodeDOM(pos);
    const table = nodeDom instanceof Element
      ? (nodeDom.matches("table") ? nodeDom : nodeDom.querySelector("table"))
      : null;
    if (table) {
      context = {
        node,
        pos,
        table,
        wrapper: table.closest(".tableWrapper") || table,
      };
    }
    return false;
  });
  return context;
}

function getTableContextFromTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const table = target.closest("table");
  if (!table) {
    return null;
  }
  let context = null;
  textEditor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "table") {
      return;
    }
    const nodeDom = textEditor.view.nodeDOM(pos);
    if (nodeDom instanceof Element && (nodeDom === table || nodeDom.contains(table))) {
      context = {
        node,
        pos,
        table,
        wrapper: table.closest(".tableWrapper") || table,
      };
      return false;
    }
  });
  return context;
}

function getTableContextFromSelection() {
  const selection = textEditor.state.selection;
  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    if (selection.$from.node(depth).type.name === "table") {
      return getTableContextAtPosition(selection.$from.before(depth));
    }
  }
  return null;
}

function closeTableActionsMenu(returnFocus = false) {
  elements.tableActionsMenu.hidden = true;
  elements.tableActionsTrigger.setAttribute("aria-expanded", "false");
  if (returnFocus) {
    elements.tableActionsTrigger.focus();
  }
}

function hideTableControls() {
  activeTable = null;
  closeTableActionsMenu();
  elements.tableControls.classList.remove("visible");
  elements.tableControls.hidden = true;
  elements.tableAddRow.hidden = true;
  elements.tableAddColumn.hidden = true;
}

function positionTableControls() {
  if (!activeTable?.wrapper?.isConnected || elements.tableControls.hidden) {
    return;
  }
  const bounds = activeTable.wrapper.getBoundingClientRect();
  const triggerBounds = elements.tableControls.getBoundingClientRect();
  const padding = 6;
  const left = Math.max(
    padding,
    Math.min(bounds.right - triggerBounds.width, window.innerWidth - triggerBounds.width - padding),
  );
  const above = bounds.top - triggerBounds.height - 5;
  elements.tableControls.style.left = `${left}px`;
  elements.tableControls.style.top = `${above >= padding ? above : Math.min(bounds.top + 5, window.innerHeight - triggerBounds.height - padding)}px`;

  const rowBounds = elements.tableAddRow.getBoundingClientRect();
  const rowLeft = Math.max(
    padding,
    Math.min(bounds.left + (bounds.width - rowBounds.width) / 2, window.innerWidth - rowBounds.width - padding),
  );
  elements.tableAddRow.style.left = `${rowLeft}px`;
  elements.tableAddRow.style.top = `${Math.max(padding, Math.min(bounds.bottom - rowBounds.height / 2, window.innerHeight - rowBounds.height - padding))}px`;

  const columnBounds = elements.tableAddColumn.getBoundingClientRect();
  elements.tableAddColumn.style.left = `${Math.max(padding, Math.min(bounds.right - columnBounds.width / 2, window.innerWidth - columnBounds.width - padding))}px`;
  elements.tableAddColumn.style.top = `${Math.max(padding, Math.min(bounds.top + (bounds.height - columnBounds.height) / 2, window.innerHeight - columnBounds.height - padding))}px`;
  if (!elements.tableActionsMenu.hidden) {
    positionTableMenu();
  }
}

function positionTableMenu() {
  const controlBounds = elements.tableControls.getBoundingClientRect();
  const menuBounds = elements.tableActionsMenu.getBoundingClientRect();
  const padding = 8;
  const left = Math.max(
    padding,
    Math.min(controlBounds.right - menuBounds.width, window.innerWidth - menuBounds.width - padding),
  );
  const below = controlBounds.bottom + 5;
  const top = below + menuBounds.height <= window.innerHeight - padding
    ? below
    : Math.max(padding, controlBounds.top - menuBounds.height - 5);
  elements.tableActionsMenu.style.left = `${left}px`;
  elements.tableActionsMenu.style.top = `${top}px`;
}

function showTableControls(context) {
  if (!context?.wrapper?.isConnected) {
    hideTableControls();
    return;
  }
  if (activeTable?.pos !== context.pos) {
    closeTableActionsMenu();
  }
  activeTable = context;
  elements.tableControls.hidden = false;
  elements.tableAddRow.hidden = false;
  elements.tableAddColumn.hidden = false;
  elements.tableControls.classList.add("visible");
  positionTableControls();
}

function addParagraphAfterTable() {
  if (!activeTable) {
    return;
  }
  const position = activeTable.pos + activeTable.node.nodeSize;
  const inserted = textEditor.chain()
    .focus()
    .insertContentAt(position, { type: "paragraph" })
    .setTextSelection(position + 1)
    .run();
  if (!inserted) {
    showToast("Couldn't add a paragraph after this table.");
  }
}

function runTableAction(action) {
  if (!activeTable) {
    return;
  }
  closeTableActionsMenu();
  if (action === "addParagraphAfterTable") {
    addParagraphAfterTable();
    return;
  }

  const command = {
    addRowBefore: "addRowBefore",
    addRowAfter: "addRowAfter",
    deleteRow: "deleteRow",
    addColumnBefore: "addColumnBefore",
    addColumnAfter: "addColumnAfter",
    deleteColumn: "deleteColumn",
    toggleHeaderRow: "toggleHeaderRow",
    deleteTable: "deleteTable",
  }[action];
  if (!command) {
    return;
  }
  const changed = textEditor.chain().focus()[command]().run();
  if (!changed) {
    showToast("Couldn't update the table. Select a cell and try again.");
  }
  if (action === "deleteTable") {
    hideTableControls();
  }
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

export function initializeEditorUi(options) {
  elements = options.elements;
  showToast = options.showToast;
  onContentChange = options.onContentChange;
  onResize = options.onResize;

document.addEventListener("pointerdown", (event) => {
  if (!elements.tableControls.contains(event.target) && !elements.tableActionsMenu.hidden) {
    closeTableActionsMenu();
  }
});
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
elements.tableControls.addEventListener("mousedown", (event) => {
  if (event.target.closest("button")) {
    event.preventDefault();
  }
});
elements.tableActionsTrigger.addEventListener("click", () => {
  const opening = elements.tableActionsMenu.hidden;
  elements.tableActionsMenu.hidden = !opening;
  elements.tableActionsTrigger.setAttribute("aria-expanded", String(opening));
  if (opening) {
    positionTableMenu();
    elements.tableActionsMenu.querySelector("[role='menuitem']").focus();
  }
});
elements.tableActionsMenu.addEventListener("click", (event) => {
  const action = event.target.closest("[data-table-action]");
  if (action) {
    runTableAction(action.dataset.tableAction);
  }
});
elements.tableActionsMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeTableActionsMenu(true);
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }
  event.preventDefault();
  const items = Array.from(elements.tableActionsMenu.querySelectorAll("[role='menuitem']"));
  const currentIndex = items.indexOf(document.activeElement);
  const offset = event.key === "ArrowDown" ? 1 : -1;
  items[(currentIndex + offset + items.length) % items.length].focus();
});
for (const control of [elements.tableControls, elements.tableAddRow, elements.tableAddColumn]) {
  control.addEventListener("pointerleave", (event) => {
    if (
      !elements.content.contains(event.relatedTarget)
      && !elements.tableControls.contains(event.relatedTarget)
      && !elements.tableAddRow.contains(event.relatedTarget)
      && !elements.tableAddColumn.contains(event.relatedTarget)
      && !elements.tableActionsMenu.contains(document.activeElement)
    ) {
      hideTableControls();
    }
  });
}
for (const button of [elements.tableAddRow, elements.tableAddColumn]) {
  button.addEventListener("mousedown", (event) => event.preventDefault());
}
elements.tableAddRow.addEventListener("click", () => {
  if (!textEditor.chain().focus().addRowAfter().run()) {
    showToast("Couldn't add a row. Select a table cell and try again.");
  }
});
elements.tableAddColumn.addEventListener("click", () => {
  if (!textEditor.chain().focus().addColumnAfter().run()) {
    showToast("Couldn't add a column. Select a table cell and try again.");
  }
});
elements.blockControls.addEventListener("mousedown", (event) => {
  if (!event.target.closest(".block-drag-button")) {
    event.preventDefault();
  }
});
elements.blockInsertButton.addEventListener("click", addBlockAfterCurrent);
elements.blockDragButton.addEventListener("dragstart", (event) => {
  if (!currentBlock) {
    event.preventDefault();
    return;
  }
  beginBlockDrag(currentBlock, event.dataTransfer);
});
elements.blockDragButton.addEventListener("dragend", () => finishBlockDrag(false));
elements.blockDragButton.addEventListener("keydown", (event) => {
  if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  moveBlockByDirection(currentBlock, event.key === "ArrowUp" ? -1 : 1);
});
elements.blockDragButton.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" || !currentBlock) {
    return;
  }
  event.preventDefault();
  touchBlockDrag = {
    block: currentBlock,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  };
  elements.blockDragButton.setPointerCapture(event.pointerId);
});
elements.blockDragButton.addEventListener("pointermove", (event) => {
  if (!touchBlockDrag || event.pointerId !== touchBlockDrag.pointerId) {
    return;
  }
  event.preventDefault();
  startTouchBlockDrag(event);
  updateBlockDropTarget(event.clientX, event.clientY);
});
elements.blockDragButton.addEventListener("pointerup", (event) => {
  if (!touchBlockDrag || event.pointerId !== touchBlockDrag.pointerId) {
    return;
  }
  updateBlockDropTarget(event.clientX, event.clientY);
  finishBlockDrag(Boolean(activeBlockDrag));
  touchBlockDrag = null;
});
elements.blockDragButton.addEventListener("pointercancel", () => {
  if (touchBlockDrag) {
    finishBlockDrag(false);
    touchBlockDrag = null;
  }
});
elements.blockControls.addEventListener("pointerleave", (event) => {
  if (!elements.content.contains(event.relatedTarget) && !textEditor.isFocused) {
    hideBlockControls();
  }
});
elements.content.addEventListener("pointermove", (event) => {
  const tableContext = getTableContextFromTarget(event.target);
  if (tableContext) {
    showTableControls(tableContext);
  } else if (!elements.tableActionsMenu.contains(document.activeElement)) {
    hideTableControls();
  }
  if (!activeBlockDrag && !touchBlockDrag) {
    const block = getBlockFromTarget(event.target);
    if (block) {
      showBlockControls(block);
    }
  }
});
elements.content.addEventListener("pointerleave", (event) => {
  if (
    !elements.tableControls.contains(event.relatedTarget)
    && !elements.tableAddRow.contains(event.relatedTarget)
    && !elements.tableAddColumn.contains(event.relatedTarget)
    && !elements.tableActionsMenu.contains(document.activeElement)
  ) {
    hideTableControls();
  }
  if (
    !elements.blockControls.contains(event.relatedTarget)
    && !textEditor.isFocused
  ) {
    hideBlockControls();
  }
});
elements.editorWrap.addEventListener("dragover", (event) => {
  if (!activeBlockDrag) {
    return;
  }
  event.preventDefault();
  updateBlockDropTarget(event.clientX, event.clientY);
});
elements.editorWrap.addEventListener("drop", (event) => {
  if (!activeBlockDrag) {
    return;
  }
  event.preventDefault();
  finishBlockDrag(true);
});
textEditor = new Editor({
  element: elements.content,
  extensions: createEditorExtensions(),
  editorProps: {
    attributes: {
      class: "tiptap-content",
      role: "textbox",
      "aria-multiline": "true",
      "aria-describedby": "block-move-help",
      "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown Alt+Enter",
      "data-placeholder": "Start writing, or type / for commands",
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
      if (event.altKey && !event.metaKey && !event.ctrlKey
          && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        moveBlockByDirection(getBlockAtSelection(), event.key === "ArrowUp" ? -1 : 1);
        return true;
      }
      if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        addBlockAfterCurrent();
        return true;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter"
          && getTableContextFromSelection()) {
        event.preventDefault();
        addParagraphAfterTable();
        return true;
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
    updateFormattingToolbar();
    onContentChange();
    syncSlashMenu();
    if (textEditor.isFocused) {
      showBlockControls(getBlockAtSelection());
      showTableControls(getTableContextFromSelection());
    }
  },
  onSelectionUpdate() {
    updateFormattingToolbar();
    syncSlashMenu();
    if (textEditor.isFocused) {
      showBlockControls(getBlockAtSelection());
      showTableControls(getTableContextFromSelection());
    }
  },
  onFocus() {
    updateFormattingToolbar();
    syncSlashMenu();
    showBlockControls(getBlockAtSelection());
    showTableControls(getTableContextFromSelection());
  },
  onBlur() {
    window.setTimeout(() => {
      if (!elements.toolbar.contains(document.activeElement)) {
        hideFormattingToolbar();
      }
      if (!elements.slashMenu.contains(document.activeElement)) {
        closeSlashMenu();
      }
      if (!elements.blockControls.contains(document.activeElement)) {
        hideBlockControls();
      }
      if (
        !elements.tableControls.contains(document.activeElement)
        && !elements.tableAddRow.contains(document.activeElement)
        && !elements.tableAddColumn.contains(document.activeElement)
      ) {
        hideTableControls();
      }
    }, 0);
  },
});
bindFormattingToolbar();
window.addEventListener("resize", () => {
  onResize();
  if (!elements.toolbar.hidden) {
    positionFormattingToolbar();
  }
  if (!elements.slashMenu.hidden) {
    positionSlashMenu();
  }
  positionBlockControls();
  positionTableControls();
});
window.addEventListener("scroll", () => {
  if (!elements.toolbar.hidden) {
    positionFormattingToolbar();
  }
  if (!elements.slashMenu.hidden) {
    positionSlashMenu();
  }
  positionBlockControls();
  positionTableControls();
}, true);

  return {
    editor: textEditor,
    hideBlockControls,
    hideFormattingToolbar,
    hideTableControls,
    updateWordCount,
  };
}
