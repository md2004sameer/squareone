const STATE_KEY = "squareoneView";

export function createWorkspaceNavigation({
  getActiveDocumentId,
  getWorkspaceId,
  canOpenDocument,
  navigate,
}) {
  let initialized = false;
  let currentEntry = null;
  let restoring = null;
  let rollback = null;
  let navigationRequest = 0;

  function entryForCurrentView(position) {
    return { workspaceId: getWorkspaceId(), documentId: getActiveDocumentId(), position };
  }

  function writeEntry(entry, replace) {
    currentEntry = entry;
    const state = { ...window.history.state, [STATE_KEY]: entry };
    window.history[replace ? "replaceState" : "pushState"](state, "", window.location.href);
  }

  function record() {
    if (!initialized) return;
    const documentId = getActiveDocumentId();
    const workspaceId = getWorkspaceId();
    if (restoring?.documentId === documentId && restoring.workspaceId === workspaceId) return;
    if (restoring) {
      // A newer click takes precedence over an unfinished history navigation.
      ++navigationRequest;
      restoring = null;
    }
    if (currentEntry.documentId === documentId && currentEntry.workspaceId === workspaceId) return;
    const workspaceChanged = currentEntry.workspaceId !== workspaceId;
    writeEntry(entryForCurrentView(currentEntry.position + (workspaceChanged ? 0 : 1)), workspaceChanged);
  }

  window.addEventListener("popstate", async (event) => {
    if (!initialized) return;
    const previous = currentEntry;
    const saved = event.state?.[STATE_KEY];
    const target = Number.isInteger(saved?.position)
      ? saved
      : { workspaceId: getWorkspaceId(), documentId: null, position: previous.position - 1 };
    if (rollback?.position === target.position && rollback.workspaceId === target.workspaceId) {
      currentEntry = rollback;
      rollback = null;
      return;
    }
    rollback = null;
    const requestId = ++navigationRequest;
    // Removed documents and views from a previous account resolve to this workspace's home.
    const documentId = target.workspaceId === getWorkspaceId() && canOpenDocument(target.documentId)
      ? target.documentId
      : null;
    currentEntry = { ...target, workspaceId: getWorkspaceId(), documentId };
    restoring = currentEntry;
    let navigated = false;
    try {
      navigated = await navigate(documentId);
    } catch (error) {
      console.error("Unable to restore workspace navigation:", error);
    }
    if (requestId !== navigationRequest) return;
    restoring = null;
    if (!navigated) {
      // Undo the history traversal when neither the server nor local storage can keep edits safe.
      currentEntry = previous;
      const distance = previous.position - target.position;
      if (distance) {
        rollback = previous;
        window.history.go(distance);
      } else {
        writeEntry(previous, true);
      }
      return;
    }
    writeEntry(entryForCurrentView(target.position), true);
  });

  return {
    initialize() {
      if (initialized) return;
      initialized = true;
      const position = window.history.state?.[STATE_KEY]?.position;
      writeEntry(entryForCurrentView(Number.isInteger(position) ? position : 0), true);
    },
    record,
  };
}
