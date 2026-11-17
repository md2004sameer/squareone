const LOCAL_DRAFT_PREFIX = "squareone.document-draft.v2:";
const LOCAL_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Consume the body under the same deadline as the connection.
    const body = await response.text();
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Connection timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function createDocumentStorage({ getCurrentUser, showToast }) {
  let localDraftWarningShown = false;
  let csrfToken = null;
  let csrfHeaderName = "X-XSRF-TOKEN";

  function localDraftPrefix() {
    const workspaceId = getCurrentUser().workspaceId;
    return workspaceId
      ? `${LOCAL_DRAFT_PREFIX}${workspaceId}:`
      : `${LOCAL_DRAFT_PREFIX}unavailable:`;
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
          contentJson: document.contentJson || null,
          revision: document.revision,
          updatedAt: document.updatedAt,
          createdAt: document.createdAt,
          parentId: document.parentId ?? null,
          favorite: Boolean(document.favorite),
          pendingSync: Boolean(document.pendingSync),
          expiresAt: Date.now() + LOCAL_DRAFT_TTL_MS,
        }),
      );
      localDraftWarningShown = false;
      return true;
    } catch (error) {
      reportLocalDraftError(error);
      return false;
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
      || (Object.hasOwn(draft, "pendingSync") && typeof draft.pendingSync !== "boolean")
      || !Number.isFinite(draft.expiresAt)
      || (Object.hasOwn(draft, "parentId") && draft.parentId !== null && typeof draft.parentId !== "string")
      || (Object.hasOwn(draft, "favorite") && typeof draft.favorite !== "boolean")
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
          ? [{
            id,
            title: draft.title,
            content: draft.content,
            contentJson: draft.contentJson || null,
            revision: draft.revision,
            parentId: draft.parentId ?? null,
            favorite: draft.favorite ?? false,
            pendingSync: Boolean(draft.pendingSync),
            createdAt: Number.isFinite(draft.createdAt) ? draft.createdAt : draft.updatedAt,
            updatedAt: draft.updatedAt,
          }]
          : [];
      });
    } catch (error) {
      reportLocalDraftError(error);
      return [];
    }
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
        const { response: csrfResponse, body: csrfBody } = await fetchWithTimeout("/api/auth/csrf");
        if (!csrfResponse.ok) {
          throw new Error("Couldn't prepare a secure request. Please refresh and try again.");
        }
        const csrf = JSON.parse(csrfBody);
        csrfToken = csrf.token;
        csrfHeaderName = csrf.headerName || csrfHeaderName;
      }
      headers[csrfHeaderName] = csrfToken;
    }

    const { response, body } = await fetchWithTimeout(url, {
      ...options,
      method,
      headers,
    });

    if (!response.ok) {
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
    return JSON.parse(body);
  }

  return {
    loadLocalDraft,
    loadLocalDraftDocuments,
    rekeyLocalDrafts,
    removeLocalDraft,
    request,
    saveLocalDraft,
  };
}
