export function createAccountController({
  elements,
  preferencesController,
  accountUi,
  documentStorage,
  documentController,
  getCurrentUser,
  setCurrentUser,
  getActiveDocumentId,
  setSaveStatus,
  showToast,
}) {
  const { rekeyLocalDrafts, request } = documentStorage;
  let submitting = false;

  function beginWorkspaceLoad() {
    documentController.clearWorkspaceState();
    elements.workspaceLoading.hidden = false;
    document.querySelectorAll("[data-workspace-control]").forEach((control) => { control.disabled = true; });
    elements.workspaceError.hidden = true;
    elements.editor.hidden = true;
    elements.welcome.hidden = true;
    elements.newButton.disabled = true;
    elements.search.disabled = true;
    elements.list.replaceChildren();
    elements.favoriteList.replaceChildren();
    elements.count.textContent = "0";
    elements.documentOutlinePane.hidden = true;
    elements.appShell.classList.remove("has-document-outline");
    elements.appShell.style.setProperty("--outline-width", "0px");
    elements.breadcrumbTrail.textContent = "Workspace";
  }

  function showWorkspaceError(error) {
    elements.workspaceLoading.hidden = true;
    elements.workspaceError.hidden = false;
    elements.editor.hidden = true;
    elements.welcome.hidden = true;
    document.querySelector("#workspace-error-message").textContent =
      error?.message || "Your workspace couldn't be loaded. Check your connection and try again.";
  }

  async function refreshAccountWorkspace(previousWorkspaceId, preferredDocumentId) {
    beginWorkspaceLoad();
    try {
      const session = await request("/api/auth/session");
      rekeyLocalDrafts(previousWorkspaceId, session.workspaceId);
      setCurrentUser(session);
      elements.search.value = "";
      accountUi.updateMenu();
      await preferencesController.load();
      await documentController.loadWorkspaceDocuments(preferredDocumentId);
    } catch (error) {
      showWorkspaceError(error);
      throw error;
    }
  }

  async function authenticateAccount(email, password) {
    const previousWorkspaceId = getCurrentUser().workspaceId;
    const preferredDocumentId = getActiveDocumentId();
    if (!(await documentController.syncPendingChanges()) || !(await preferencesController.flush())) {
      throw new Error("Sync your pending changes before switching accounts. Use Retry sync when connected.");
    }
    await request("/api/auth/login", {
      method: "POST",
      body: new URLSearchParams({ email, password }),
    });
    await refreshAccountWorkspace(previousWorkspaceId, preferredDocumentId);
    elements.accountDialog.close();
    accountUi.closeMenu();
    showToast("You’re logged in. Your notes are ready.");
  }

  async function logoutAccount() {
    if (!(await documentController.syncPendingChanges()) || !(await preferencesController.flush())) {
      throw new Error("Sync your pending changes before switching accounts. Use Retry sync when connected.");
    }
    await request("/api/auth/logout", { method: "POST" });
    beginWorkspaceLoad();
    try {
      const guestSession = await request("/api/auth/session");
      setCurrentUser(guestSession);
      elements.search.value = "";
      accountUi.updateMenu();
      await preferencesController.load();
      await documentController.loadWorkspaceDocuments(null);
    } catch (error) {
      showWorkspaceError(error);
      throw error;
    }
    accountUi.closeMenu();
    showToast("You’re now using Squareone as a guest.");
  }

  async function submitAccountForm(event) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    const submittedMode = accountUi.mode;
    const submitLabel = elements.accountSubmit.textContent;
    elements.accountSubmit.disabled = true;
    elements.accountModeToggle.disabled = true;
    elements.accountForm.setAttribute("aria-busy", "true");
    elements.accountSubmit.textContent = {
      login: "Logging in…",
      signup: "Creating account…",
      profile: "Saving profile…",
      settings: "Updating password…",
    }[submittedMode];
    elements.accountFormError.hidden = true;
    try {
      if (submittedMode === "login") {
        await authenticateAccount(
          elements.accountEmailInput.value.trim(),
          elements.accountPasswordInput.value,
        );
      } else if (submittedMode === "signup") {
        if (!(await documentController.syncPendingChanges()) || !(await preferencesController.flush())) {
          throw new Error("Sync your pending changes before switching accounts. Use Retry sync when connected.");
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
      } else if (submittedMode === "profile") {
        const profile = await request("/api/auth/profile", {
          method: "PUT",
          body: JSON.stringify({
            name: elements.accountNameInput.value.trim(),
            email: elements.accountEmailInput.value.trim(),
            avatarColor: elements.accountAvatarColorInput.value,
          }),
        });
        setCurrentUser(profile);
        accountUi.updateMenu();
        await preferencesController.load();
        elements.accountDialog.close();
        showToast("Your profile was updated.");
      } else if (submittedMode === "settings") {
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
      accountUi.showFormError(error.message || "That didn’t work. Please try again.");
    } finally {
      submitting = false;
      elements.accountSubmit.disabled = false;
      elements.accountModeToggle.disabled = false;
      elements.accountForm.removeAttribute("aria-busy");
      if (accountUi.mode === submittedMode) elements.accountSubmit.textContent = submitLabel;
    }
  }

  async function initialize() {
    beginWorkspaceLoad();
    try {
      setCurrentUser(await request("/api/auth/session"));
      accountUi.updateMenu();
      await preferencesController.load();
      await documentController.loadWorkspaceDocuments(null);
    } catch (error) {
      showWorkspaceError(error);
      setSaveStatus("error", "Couldn't connect");
      showToast("Squareone couldn’t connect. Refresh to try again.");
      console.error("Unable to load the guest or account session:", error);
      return;
    }
  }

  return {
    initialize,
    logoutAccount,
    submitAccountForm,
  };
}
