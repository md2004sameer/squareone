export function createWorkspaceHome({ getDocuments, onOpenDocument, contentToPlainText }) {
  function documentCard(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-document-card";
    button.dataset.documentId = entry.id;
    const title = document.createElement("strong");
    const preview = document.createElement("span");
    const date = document.createElement("small");
    button.append(title, preview, date);
    button.addEventListener("click", () => onOpenDocument(entry.id));
    return button;
  }

  function updateCard(button, entry) {
    button.setAttribute("aria-label", `Open document: ${entry.title?.trim() || "Untitled"}`);
    const values = [
      `${entry.favorite ? "★ " : ""}${entry.title?.trim() || "Untitled"}`,
      contentToPlainText(entry.content || "").trim().slice(0, 140) || "A little room for your next thought.",
      `Edited ${new Date(entry.updatedAt).toLocaleDateString()}`,
    ];
    values.forEach((value, index) => {
      if (button.children[index].textContent !== value) button.children[index].textContent = value;
    });
  }

  function renderCollection(id, entries, emptyMessage) {
    const list = document.querySelector(id);
    if (!entries.length) {
      if (!list.querySelector(".home-empty-copy")) {
        const empty = document.createElement("p");
        empty.className = "home-empty-copy";
        empty.textContent = emptyMessage;
        list.replaceChildren(empty);
      }
      return;
    }
    const existing = new Map([...list.children].map((child) => [child.dataset.documentId, child]));
    const visibleIds = new Set(entries.map((entry) => entry.id));
    for (const child of [...list.children]) {
      if (!visibleIds.has(child.dataset.documentId)) child.remove();
    }
    entries.forEach((entry, index) => {
      const card = existing.get(entry.id) || documentCard(entry);
      updateCard(card, entry);
      // Keep the button in place during autosave, including between pointer down
      // and pointer up, so a render cannot swallow the user's click.
      if (list.children[index] !== card) list.insertBefore(card, list.children[index] || null);
    });
  }

  return {
    render() {
      const documents = getDocuments();
      document.querySelector("#home-summary").textContent = `${documents.length} ${documents.length === 1 ? "document" : "documents"} in your space`;
      document.querySelector("#home-empty").hidden = documents.length > 0;
      document.querySelector("#home-collections").hidden = documents.length === 0;
      document.querySelector("#welcome-create-label").textContent = documents.length ? "New document" : "Write your first note";
      const recent = [...documents].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
      renderCollection("#home-recent", recent.slice(0, 6), "Your recent documents will appear here.");
      renderCollection("#home-favorites", recent.filter((entry) => entry.favorite).slice(0, 6), "Add a document to Favorites from its menu to keep it close.");
    },
  };
}
