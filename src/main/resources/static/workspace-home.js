export function createWorkspaceHome({ getDocuments, onOpenDocument, contentToPlainText }) {
  function documentCard(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-document-card";
    button.setAttribute("aria-label", `Open document: ${entry.title?.trim() || "Untitled"}`);
    const title = document.createElement("strong");
    title.textContent = `${entry.favorite ? "★ " : ""}${entry.title?.trim() || "Untitled"}`;
    const preview = document.createElement("span");
    preview.textContent = contentToPlainText(entry.content || "").trim().slice(0, 140) || "A little room for your next thought.";
    const date = document.createElement("small");
    date.textContent = `Edited ${new Date(entry.updatedAt).toLocaleDateString()}`;
    button.append(title, preview, date);
    button.addEventListener("click", () => onOpenDocument(entry.id));
    return button;
  }

  function renderCollection(id, entries, emptyMessage) {
    const list = document.querySelector(id);
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "home-empty-copy";
      empty.textContent = emptyMessage;
      list.append(empty);
    }
    for (const entry of entries) list.append(documentCard(entry));
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
