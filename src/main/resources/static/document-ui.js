export function createDocumentUi({
  elements,
  getDocuments,
  getActiveDocumentId,
  getEditorUi,
  getWorkspaceId,
  onDocumentsChanged,
  onGoHome,
  onPreferenceChange = () => {},
  onEditorStateChange = () => {},
  onArchiveDocument,
  onReorderDocument,
  contentToPlainText,
  editorContentFromStored,
  onOpenDocument,
  onRenameDocument,
  onDuplicateDocument,
  onToggleFavorite,
  onMoveDocument,
  onDeleteDocument,
}) {
  const collapsedDocumentIds = new Set();
  let searchResultIndex = -1;
  const sortControl = document.querySelector("#document-sort");
  let preferenceWorkspaceId;
  let sortMode = "updated";

  function loadPreferences() {
    const workspaceId = getWorkspaceId();
    if (preferenceWorkspaceId === workspaceId) return;
    preferenceWorkspaceId = workspaceId;
    collapsedDocumentIds.clear();
    sortMode = "updated";
    try {
      const saved = JSON.parse(localStorage.getItem(`squareone.organization.v1:${workspaceId}`) || "null");
      if (["updated", "created", "title", "manual"].includes(saved?.sort)) sortMode = saved.sort;
      if (Array.isArray(saved?.collapsed)) {
        saved.collapsed.filter((id) => typeof id === "string").forEach((id) => collapsedDocumentIds.add(id));
      }
    } catch (error) {
      console.warn("Unable to load document organization preferences:", error);
    }
    sortControl.value = sortMode;
  }

  function savePreferences() {
    onPreferenceChange({ documentSort: sortMode, collapsedDocumentIds: [...collapsedDocumentIds] });
    try {
      localStorage.setItem(`squareone.organization.v1:${getWorkspaceId()}`, JSON.stringify({
        sort: sortMode, collapsed: [...collapsedDocumentIds],
      }));
    } catch (error) {
      console.warn("Unable to save document organization preferences:", error);
    }
  }

  function sortDocuments() {
    loadPreferences();
    getDocuments().sort((first, second) => {
      if (sortMode === "title") {
        return (first.title?.trim() || "Untitled").localeCompare(second.title?.trim() || "Untitled", undefined, {
          numeric: true, sensitivity: "base",
        }) || first.id.localeCompare(second.id);
      }
      if (sortMode === "manual") return (first.sortOrder || 0) - (second.sortOrder || 0) || first.id.localeCompare(second.id);
      const field = sortMode === "created" ? "createdAt" : "updatedAt";
      return second[field] - first[field] || first.id.localeCompare(second.id);
    });
  }

  function showDocumentOutline(documentEntry) {
    elements.documentOutlineTitle.textContent = documentEntry.title?.trim() || "Untitled";
    updateBreadcrumb(documentEntry);
    renderDocumentOutline();
  }

  function updateBreadcrumb(documentEntry) {
    elements.breadcrumbTrail.replaceChildren();
    const workspace = document.createElement("button");
    workspace.type = "button";
    workspace.setAttribute("aria-label", "Workspace home");
    workspace.addEventListener("click", onGoHome);
    workspace.className = "breadcrumb-root";
    workspace.textContent = "Workspace";
    elements.breadcrumbTrail.append(workspace);
    if (!documentEntry) {
      return;
    }

    const documentsById = new Map(getDocuments().map((entry) => [entry.id, entry]));
    const ancestors = [];
    const visited = new Set([documentEntry.id]);
    let parent = documentEntry.parentId ? documentsById.get(documentEntry.parentId) : null;
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      ancestors.unshift(parent);
      parent = parent.parentId ? documentsById.get(parent.parentId) : null;
    }
    for (const ancestor of [...ancestors, documentEntry]) {
      const divider = document.createElement("span");
      divider.className = "breadcrumb-divider";
      divider.setAttribute("aria-hidden", "true");
      divider.textContent = "/";
      elements.breadcrumbTrail.append(divider);
      if (ancestor.id === documentEntry.id) {
        const current = document.createElement("span");
        current.className = "breadcrumb-current";
        current.id = "breadcrumb-title";
        current.setAttribute("aria-current", "page");
        current.textContent = ancestor.title?.trim() || "Untitled";
        elements.breadcrumbTrail.append(current);
      } else {
        const parentLink = document.createElement("button");
        parentLink.type = "button";
        parentLink.className = "breadcrumb-segment";
        parentLink.textContent = ancestor.title?.trim() || "Untitled";
        parentLink.title = ancestor.title?.trim() || "Untitled";
        parentLink.addEventListener("click", () => onOpenDocument(ancestor.id));
        elements.breadcrumbTrail.append(parentLink);
      }
    }
  }

  function renderDocumentOutline() {
    const headings = [];
    getEditorUi()?.editor.state.doc.descendants((node, position) => {
      if (node.type.name === "heading" && node.attrs.level >= 1 && node.attrs.level <= 3) {
        headings.push({
          text: node.textContent.trim(),
          level: node.attrs.level,
          from: position + 1,
          to: position + node.nodeSize - 1,
        });
      }
    });

    elements.documentOutlineList.replaceChildren();
    for (const [index, heading] of headings.entries()) {
      const item = document.createElement("li");
      item.className = `outline-item outline-level-${heading.level}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-outline-item";
      button.setAttribute("aria-label", `Go to heading: ${heading.text}`);
      button.dataset.headingIndex = String(index);
      button.addEventListener("click", () => {
        const editor = getEditorUi().editor;
        editor.chain()
          .setTextSelection({ from: heading.from, to: heading.to })
          .scrollIntoView()
          .focus()
          .run();
      });

      const preview = document.createElement("span");
      preview.className = "sidebar-outline-text";
      preview.textContent = heading.text || "Untitled heading";
      button.append(preview);
      item.append(button);
      elements.documentOutlineList.append(item);
    }

    const hasHeadings = headings.length > 0;
    elements.documentOutlinePane.hidden = !hasHeadings;
    elements.appShell.classList.toggle("has-document-outline", hasHeadings);
    elements.appShell.style.setProperty("--outline-width", hasHeadings ? "250px" : "0px");
  }

  function clearDocumentOutline() {
    elements.documentOutlineTitle.textContent = "Document outline";
    elements.documentOutlineList.replaceChildren();
    elements.documentOutlinePane.hidden = true;
    elements.appShell.classList.remove("has-document-outline");
    elements.appShell.style.setProperty("--outline-width", "0px");
  }

  function appendHighlightedText(container, value, query) {
    const text = value || "";
    if (!query) {
      container.textContent = text;
      return;
    }
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const matcher = new RegExp(escapedQuery, "giu");
    let lastIndex = 0;
    for (const match of text.matchAll(matcher)) {
      if (match.index > lastIndex) {
        container.append(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const highlight = document.createElement("mark");
      highlight.textContent = match[0];
      container.append(highlight);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      container.append(document.createTextNode(text.slice(lastIndex)));
    }
    if (lastIndex === 0) {
      container.textContent = text;
    }
  }

  function createActionButton(action, label, documentEntry, extra = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.dataset.documentAction = action;
    button.dataset.documentId = documentEntry.id;
    Object.entries(extra).forEach(([key, value]) => {
      button.dataset[key] = value;
    });
    button.textContent = label;
    return button;
  }

  function getDescendantIds(documentId, childrenByParent) {
    const descendants = new Set();
    const pending = [...(childrenByParent.get(documentId) || [])];
    while (pending.length > 0) {
      const child = pending.pop();
      if (descendants.has(child.id)) {
        continue;
      }
      descendants.add(child.id);
      pending.push(...(childrenByParent.get(child.id) || []));
    }
    return descendants;
  }

  function createContextMenu(documentEntry, childrenByParent, documents) {
    const details = document.createElement("details");
    details.className = "document-context-menu";
    const trigger = document.createElement("summary");
    trigger.setAttribute("aria-label", `Actions for ${documentEntry.title || "Untitled"}`);
    trigger.title = "Document actions";
    trigger.textContent = "⋯";
    details.append(trigger);

    const menu = document.createElement("div");
    menu.className = "document-context-menu-items";
    menu.setAttribute("role", "menu");
    menu.append(
      createActionButton("rename", "Rename", documentEntry),
      createActionButton("duplicate", "Duplicate", documentEntry),
      createActionButton(
        "favorite",
        documentEntry.favorite ? "Remove from favorites" : "Add to favorites",
        documentEntry,
      ),
    );

    const moveDetails = document.createElement("details");
    moveDetails.className = "document-move-menu";
    const moveTrigger = document.createElement("summary");
    moveTrigger.textContent = "Move to…";
    moveDetails.append(moveTrigger);
    const moveItems = document.createElement("div");
    moveItems.className = "document-move-menu-items";
    moveItems.setAttribute("role", "menu");
    moveItems.append(createActionButton("move", "Workspace root", documentEntry, { parentId: "" }));
    const excludedIds = getDescendantIds(documentEntry.id, childrenByParent);
    for (const candidate of documents) {
      if (candidate.id === documentEntry.id || excludedIds.has(candidate.id)) {
        continue;
      }
      moveItems.append(createActionButton(
        "move",
        candidate.title?.trim() || "Untitled",
        documentEntry,
        { parentId: candidate.id },
      ));
    }
    moveDetails.append(moveItems);
    menu.append(moveDetails);
    menu.append(createActionButton("up", "Move up", documentEntry));
    menu.append(createActionButton("down", "Move down", documentEntry));
    menu.append(createActionButton("archive", "Archive", documentEntry));
    menu.append(createActionButton("delete", "Move to Trash", documentEntry));
    details.append(menu);
    return details;
  }

  function createDocumentRow(
    documentEntry,
    depth,
    isTreeNode,
    childrenByParent,
    documents,
    query,
    visibleIds,
    renderedIds,
    path = new Set(),
  ) {
    if (path.has(documentEntry.id) || renderedIds.has(documentEntry.id)) {
      return null;
    }
    renderedIds.add(documentEntry.id);
    const nextPath = new Set(path).add(documentEntry.id);
    const children = (childrenByParent.get(documentEntry.id) || []).filter(
      (child) => !query || visibleIds.has(child.id),
    );
    const isCollapsed = !query && collapsedDocumentIds.has(documentEntry.id);
    const item = document.createElement("li");
    item.className = "document-tree-node";
    item.setAttribute("role", isTreeNode ? "treeitem" : "listitem");
    item.style.setProperty("--tree-depth", String(depth));
    if (isTreeNode) {
      item.setAttribute("aria-level", String(depth + 1));
      if (children.length > 0) {
        item.setAttribute("aria-expanded", String(!isCollapsed));
      }
    }

    const row = document.createElement("div");
    row.className = "document-tree-row";
    if (isTreeNode) {
      const disclosure = document.createElement("button");
      disclosure.type = "button";
      disclosure.className = "document-tree-disclosure";
      disclosure.dataset.treeToggle = documentEntry.id;
      disclosure.setAttribute(
        "aria-label",
        `${isCollapsed ? "Expand" : "Collapse"} ${
          documentEntry.title?.trim() || "Untitled"
        }`,
      );
      disclosure.disabled = children.length === 0;
      disclosure.textContent = children.length > 0 ? (isCollapsed ? "›" : "⌄") : "";
      row.append(disclosure);
    }

    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "document-item";
    titleButton.dataset.documentAction = "open";
    titleButton.dataset.documentId = documentEntry.id;
    titleButton.id = `${isTreeNode ? "document-tree" : "favorite"}-${documentEntry.id}`;
    titleButton.classList.toggle("active", documentEntry.id === getActiveDocumentId());
    titleButton.setAttribute("aria-current", documentEntry.id === getActiveDocumentId() ? "page" : "false");
    const title = documentEntry.title?.trim() || "Untitled";
    titleButton.setAttribute("aria-label", `Open document: ${title}`);
    titleButton.title = title;

    const icon = document.createElement("span");
    icon.className = "document-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = documentEntry.icon || (documentEntry.favorite ? "★" : "✳");

    const copy = document.createElement("span");
    copy.className = "document-item-copy";
    const titleText = document.createElement("span");
    titleText.className = "document-item-title";
    appendHighlightedText(titleText, title, query);
    const preview = document.createElement("span");
    preview.className = "document-item-preview";
    const previewText = contentToPlainText(documentEntry.content || "").trim() || "No additional text";
    appendHighlightedText(preview, previewText, query);
    copy.append(titleText, preview);
    titleButton.append(icon, copy);

    row.append(titleButton, createContextMenu(documentEntry, childrenByParent, documents));
    item.append(row);

    if (isTreeNode && children.length > 0 && !isCollapsed) {
      const group = document.createElement("ul");
      group.className = "document-tree-children";
      group.setAttribute("role", "group");
      for (const child of children) {
        const childRow = createDocumentRow(
          child,
          depth + 1,
          true,
          childrenByParent,
          documents,
          query,
          visibleIds,
          renderedIds,
          nextPath,
        );
        if (childRow) {
          group.append(childRow);
        }
      }
      item.append(group);
    }
    return item;
  }

  function renderList() {
    const documents = getDocuments();
    const activeDocumentId = getActiveDocumentId();
    sortDocuments();
    elements.count.textContent = String(documents.length);
    elements.list.replaceChildren();
    elements.favoriteList.replaceChildren();

    const query = elements.search.value.trim();
    const normalizedQuery = query.toLocaleLowerCase();
    const matches = (entry) => {
      const title = (entry.title || "").toLocaleLowerCase();
      const content = contentToPlainText(entry.content || "").toLocaleLowerCase();
      return title.includes(normalizedQuery) || content.includes(normalizedQuery);
    };
    const childrenByParent = new Map();
    const byId = new Map(documents.map((entry) => [entry.id, entry]));
    for (const entry of documents) {
      const parentId = entry.parentId && byId.has(entry.parentId) ? entry.parentId : null;
      const children = childrenByParent.get(parentId) || [];
      children.push(entry);
      childrenByParent.set(parentId, children);
    }

    const visibleIds = new Set();
    if (normalizedQuery) {
      for (const entry of documents) {
        if (!matches(entry)) {
          continue;
        }
        let current = entry;
        const ancestors = new Set();
        while (current && !ancestors.has(current.id)) {
          visibleIds.add(current.id);
          ancestors.add(current.id);
          current = current.parentId ? byId.get(current.parentId) : null;
        }
      }
    } else {
      documents.forEach((entry) => visibleIds.add(entry.id));
    }

    const tree = document.createElement("ul");
    tree.className = "document-tree";
    tree.setAttribute("role", "tree");
    const roots = childrenByParent.get(null) || [];
    const renderedTreeIds = new Set();
    for (const entry of roots) {
      const node = normalizedQuery && !visibleIds.has(entry.id)
        ? null
        : createDocumentRow(entry, 0, true, childrenByParent, documents, query, visibleIds, renderedTreeIds);
      if (node) {
        tree.append(node);
      }
    }
    for (const entry of documents) {
      let hiddenByAncestor = false;
      let ancestor = byId.get(entry.parentId);
      const seen = new Set([entry.id]);
      while (!normalizedQuery && ancestor && !seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        if (collapsedDocumentIds.has(ancestor.id)) hiddenByAncestor = true;
        ancestor = byId.get(ancestor.parentId);
      }
      if (!hiddenByAncestor && !renderedTreeIds.has(entry.id) && (!normalizedQuery || visibleIds.has(entry.id))) {
        const node = createDocumentRow(
          entry,
          0,
          true,
          childrenByParent,
          documents,
          query,
          visibleIds,
          renderedTreeIds,
        );
        if (node) {
          tree.append(node);
        }
      }
    }

    const favorites = documents.filter((entry) => entry.favorite && (!normalizedQuery || matches(entry)));
    elements.favoritesSection.hidden = favorites.length === 0;
    if (favorites.length > 0) {
      const favoriteItems = document.createElement("ul");
      favoriteItems.className = "favorite-items";
      favoriteItems.setAttribute("role", "list");
      const renderedFavoriteIds = new Set();
      for (const entry of favorites) {
        const favorite = createDocumentRow(
          entry,
          0,
          false,
          childrenByParent,
          documents,
          query,
          visibleIds,
          renderedFavoriteIds,
        );
        if (favorite) {
          favoriteItems.append(favorite);
        }
      }
      elements.favoriteList.append(favoriteItems);
    }

    if (tree.children.length > 0) {
      elements.list.append(tree);
    } else {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "sidebar-empty";
      emptyMessage.textContent = documents.length === 0
        ? "Create a document to get started."
        : "No documents match your search.";
      elements.list.append(emptyMessage);
    }
    searchResultIndex = -1;
    elements.search.removeAttribute("aria-activedescendant");
    onDocumentsChanged();
  }

  function handleDocumentAction(event) {
    const actionButton = event.target.closest("[data-document-action]");
    if (actionButton) {
      const { documentAction: action, documentId } = actionButton.dataset;
      event.preventDefault();
      event.stopPropagation();
      actionButton.closest("details")?.removeAttribute("open");
      if (action === "open") {
        onOpenDocument(documentId);
      } else if (action === "rename") {
        onRenameDocument(documentId);
      } else if (action === "duplicate") {
        onDuplicateDocument(documentId);
      } else if (action === "favorite") {
        onToggleFavorite(documentId);
      } else if (action === "move") {
        onMoveDocument(documentId, actionButton.dataset.parentId || null);
      } else if (action === "archive") {
        onArchiveDocument(documentId);
      } else if (action === "up" || action === "down") {
        onReorderDocument(documentId, action);
      } else if (action === "delete") {
        onDeleteDocument(documentId);
      }
      return;
    }

    const disclosure = event.target.closest("[data-tree-toggle]");
    if (disclosure) {
      const documentId = disclosure.dataset.treeToggle;
      if (collapsedDocumentIds.has(documentId)) {
        collapsedDocumentIds.delete(documentId);
      } else {
        collapsedDocumentIds.add(documentId);
      }
      renderList();
      savePreferences();
      elements.list.querySelector(`[data-tree-toggle="${CSS.escape(documentId)}"]`)?.focus();
    }
  }

  function handleTreeKeydown(event) {
    const menu = event.target.closest('[role="menu"]');
    if (menu) {
      const menuItems = Array.from(menu.querySelectorAll(':scope > [role="menuitem"]:not(:disabled)'));
      if (menuItems.length === 0) {
        return;
      }
      const currentIndex = menuItems.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = (currentIndex + direction + menuItems.length) % menuItems.length;
        event.preventDefault();
        menuItems[nextIndex].focus();
      } else if (event.key === "Home" && menuItems.length > 0) {
        event.preventDefault();
        menuItems[0].focus();
      } else if (event.key === "End" && menuItems.length > 0) {
        event.preventDefault();
        menuItems[menuItems.length - 1].focus();
      }
      return;
    }

    const target = event.target.closest(".document-item, .document-tree-disclosure");
    if (!target) {
      return;
    }
    const list = target.closest("#favorite-list") ? elements.favoriteList : elements.list;
    if (event.key === "Escape") {
      const openMenu = target.closest("details[open]");
      if (openMenu) {
        openMenu.open = false;
        openMenu.querySelector("summary")?.focus();
        event.preventDefault();
      } else if (elements.search.value) {
        elements.search.focus();
        event.preventDefault();
      }
      return;
    }
    const buttons = Array.from(list.querySelectorAll(
      ".document-tree-row .document-item",
    ));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const row = target.closest(".document-tree-row");
      const titleButton = row.querySelector(".document-item");
      const currentIndex = buttons.indexOf(titleButton);
      if (event.key === "ArrowUp" && currentIndex === 0 && elements.search.value) {
        elements.search.focus();
        event.preventDefault();
        return;
      }
      const nextIndex = event.key === "ArrowDown"
        ? Math.min(buttons.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
      buttons[nextIndex]?.focus();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      const item = target.closest(".document-tree-node");
      const id = item.querySelector(".document-item")?.dataset.documentId;
      if (id && collapsedDocumentIds.has(id)) {
        collapsedDocumentIds.delete(id);
        savePreferences();
        renderList();
        elements.list.querySelector(`[data-document-id="${CSS.escape(id)}"]`)?.focus();
      }
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      const item = target.closest(".document-tree-node");
      const id = item.querySelector(".document-item")?.dataset.documentId;
      if (id && item.querySelector(":scope > .document-tree-children")) {
        collapsedDocumentIds.add(id);
        savePreferences();
        renderList();
        elements.list.querySelector(`[data-document-id="${CSS.escape(id)}"]`)?.focus();
      } else {
        const parent = item.parentElement.closest(".document-tree-node");
        parent?.querySelector(":scope > .document-tree-row .document-item")?.focus();
      }
      event.preventDefault();
    }
  }

  function getSearchResults() {
    return Array.from(elements.list.querySelectorAll(".document-item"));
  }

  function focusSearchResult(offset) {
    const results = getSearchResults();
    if (results.length === 0) {
      return;
    }
    searchResultIndex = Math.max(0, Math.min(results.length - 1, searchResultIndex + offset));
    results[searchResultIndex].focus();
    results[searchResultIndex].scrollIntoView({ block: "nearest" });
  }

  function openSearchResult() {
    const results = getSearchResults();
    const focusedIndex = results.indexOf(document.activeElement);
    const result = focusedIndex >= 0 ? results[focusedIndex] : results[searchResultIndex];
    result?.click();
  }

  function renderEditor() {
    const activeDocument = getDocuments().find(
      (entry) => entry.id === getActiveDocumentId(),
    );
    const editorUi = getEditorUi();
    const hasDocument = Boolean(activeDocument);
    onEditorStateChange();
    elements.workspaceLoading.hidden = true;
    document.querySelectorAll("[data-workspace-control]").forEach((control) => { control.disabled = false; });
    elements.workspaceError.hidden = true;
    elements.newButton.disabled = false;
    elements.search.disabled = false;
    editorUi.hideBlockControls();
    editorUi.hideTableControls();
    elements.welcome.hidden = hasDocument;
    elements.editor.hidden = !hasDocument;
    elements.deleteButton.disabled = !hasDocument;
    elements.focusToggle.disabled = !hasDocument;
    elements.widePageToggle.disabled = !hasDocument;
    document.querySelector("#workspace-home").setAttribute("aria-current", hasDocument ? "false" : "page");
    elements.documentActions.classList.toggle("disabled", !hasDocument);

    if (!activeDocument) {
      document.querySelector("#document-cover").hidden = true;
      elements.title.value = "";
      editorUi.editor.commands.setContent("", { emitUpdate: false });
      editorUi.updateWordCount();
      editorUi.hideFormattingToolbar();
      updateBreadcrumb(null);
      clearDocumentOutline();
      return;
    }

    elements.title.value = activeDocument.title || "";
    const cover = document.querySelector("#document-cover");
    cover.hidden = !activeDocument.coverRef;
    if (activeDocument.coverRef) cover.src = activeDocument.coverRef;
    else cover.removeAttribute("src");
    editorUi.editor.commands.setContent(
      editorContentFromStored(activeDocument.content || ""),
      { emitUpdate: false },
    );
    editorUi.hideFormattingToolbar();
    elements.date.textContent = `Last edited ${formatDate(activeDocument.updatedAt)}`;
    editorUi.updateWordCount();
    showDocumentOutline(activeDocument);
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

  elements.list.addEventListener("click", handleDocumentAction);
  sortControl.addEventListener("change", () => {
    sortMode = sortControl.value;
    savePreferences();
    renderList();
  });
  document.querySelector("#expand-all").addEventListener("click", () => {
    collapsedDocumentIds.clear();
    savePreferences();
    renderList();
  });
  document.querySelector("#collapse-all").addEventListener("click", () => {
    getDocuments().forEach((entry) => {
      if (entry.parentId) collapsedDocumentIds.add(entry.parentId);
    });
    savePreferences();
    renderList();
  });
  elements.favoriteList.addEventListener("click", handleDocumentAction);
  elements.list.addEventListener("keydown", handleTreeKeydown);
  elements.favoriteList.addEventListener("keydown", handleTreeKeydown);

  return {
    applyPreferences(settings) {
      preferenceWorkspaceId = getWorkspaceId();
      sortMode = settings.documentSort;
      collapsedDocumentIds.clear();
      settings.collapsedDocumentIds.forEach((id) => collapsedDocumentIds.add(id));
      sortControl.value = sortMode;
      renderList();
    },
    clearDocumentOutline,
    focusSearchResult,
    formatDate,
    openSearchResult,
    renderEditor,
    renderList,
    showDocumentOutline,
    updateBreadcrumb,
    sortDocuments,
  };
}
