export function createTrashController({ request, onRestore, showToast }) {
  const dialog = document.querySelector("#trash-dialog");
  const list = document.querySelector("#trash-list");
  const retry = document.querySelector("#trash-retry");
  let entries = [];

  function render() {
    list.replaceChildren();
    if (entries.length === 0) {
      list.textContent = "Trash is empty. Documents you move here can be restored.";
      return;
    }
    for (const entry of entries) {
      const row = document.createElement("li");
      row.className = "trash-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = entry.title?.trim() || "Untitled";
      const date = document.createElement("small");
      date.textContent = `Moved to Trash ${new Date(entry.deletedAt).toLocaleDateString()}`;
      copy.append(title, date);
      const actions = document.createElement("div");
      actions.className = "trash-actions";
      for (const [action, label] of [["restore", "Restore"], ["delete", "Delete permanently"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.trashAction = action;
        button.dataset.documentId = entry.id;
        button.setAttribute("aria-label", `${label}: ${entry.title?.trim() || "Untitled"}`);
        actions.append(button);
      }
      row.append(copy, actions);
      list.append(row);
    }
  }

  async function load() {
    list.textContent = "Loading Trash…";
    retry.hidden = true;
    try {
      entries = await request("/api/documents/trash");
      render();
    } catch {
      list.textContent = "Trash couldn't be loaded. Check your connection and try again.";
      retry.hidden = false;
    }
  }

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-trash-action]");
    if (!button) return;
    const entry = entries.find((item) => item.id === button.dataset.documentId);
    if (!entry) return;
    const restore = button.dataset.trashAction === "restore";
    if (!restore && !window.confirm(`Permanently delete “${entry.title?.trim() || "Untitled"}”? This cannot be undone.`)) return;
    const buttons = [...list.querySelectorAll("button")];
    buttons.forEach((item) => { item.disabled = true; });
    try {
      const url = `/api/documents/trash/${encodeURIComponent(entry.id)}`;
      if (restore) onRestore(await request(`${url}/restore`, { method: "POST" }));
      else await request(url, { method: "DELETE" });
      entries = entries.filter((item) => item.id !== entry.id);
      render();
      showToast(restore ? "Document restored to your workspace." : "Document permanently deleted.");
      (list.querySelector("button") || document.querySelector("#trash-close")).focus();
    } catch {
      showToast("That didn't work. Check your connection and try again.");
      buttons.forEach((item) => { item.disabled = false; });
    }
  });
  retry.addEventListener("click", () => void load());
  document.querySelector("#trash-close").addEventListener("click", () => dialog.close());
  return {
    open() {
      dialog.showModal();
      void load();
    },
  };
}
