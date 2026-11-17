export function createAccountUi(elements, getCurrentUser) {
  let mode = "login";

  function updateMenu() {
    const currentUser = getCurrentUser();
    elements.accountAvatar.textContent = currentUser.avatar || "G";
    elements.accountAvatar.style.backgroundColor = currentUser.avatarColor || "#617459";
    elements.accountMenuTrigger.setAttribute(
      "aria-label",
      currentUser.authenticated
        ? `Account menu for ${currentUser.name || "your account"}`
        : "Guest account menu",
    );
    elements.accountMenuName.textContent = currentUser.name || "Guest";
    elements.accountProfile.hidden = !currentUser.authenticated;
    elements.accountSettings.hidden = !currentUser.authenticated;
    elements.accountLogin.hidden = currentUser.authenticated;
    elements.accountLogout.hidden = !currentUser.authenticated;
    document.querySelector("#guest-notice").hidden = currentUser.authenticated;
  }

  function setField(field, input, visible, required = false) {
    field.hidden = !visible;
    input.disabled = !visible;
    input.required = visible && required;
  }

  function showDialog(nextMode) {
    mode = nextMode;
    const currentUser = getCurrentUser();
    elements.accountFormError.hidden = true;
    elements.accountFormError.textContent = "";
    const isLogin = mode === "login";
    const isSignup = mode === "signup";
    const isProfile = mode === "profile";
    const isSettings = mode === "settings";

    elements.accountDialogEyebrow.textContent = isProfile || isSettings ? "Your account" : "Your Squareone";
    elements.accountDialogTitle.textContent = {
      login: "Log in",
      signup: "Create your account",
      profile: "Profile",
      settings: "Settings",
    }[mode];
    elements.accountDialogCopy.textContent = {
      login: "Log in to access your notes from other browsers. Notes in this guest workspace, including Trash, will move into your account.",
      signup: "Your guest notes, including Trash, will move into your new account. You can then log in from other browsers to access them.",
      profile: "Update the name, email, and avatar for your account.",
      settings: "Change your password to keep your account secure.",
    }[mode];
    elements.accountSubmit.textContent = {
      login: "Log in",
      signup: "Create account",
      profile: "Save profile",
      settings: "Update password",
    }[mode];
    setField(elements.accountNameField, elements.accountNameInput, isSignup || isProfile, isSignup || isProfile);
    setField(elements.accountEmailField, elements.accountEmailInput, isLogin || isSignup || isProfile, isLogin || isSignup || isProfile);
    setField(elements.accountPasswordField, elements.accountPasswordInput, isLogin || isSignup, isLogin || isSignup);
    setField(elements.accountAvatarColorField, elements.accountAvatarColorInput, isProfile);
    setField(elements.accountCurrentPasswordField, elements.accountCurrentPasswordInput, isSettings, isSettings);
    setField(elements.accountNewPasswordField, elements.accountNewPasswordInput, isSettings, isSettings);
    document.querySelector("#writing-preferences").hidden = !isSettings;
    elements.accountModeToggle.hidden = !isLogin && !isSignup;
    elements.accountGuestContinue.hidden = !isLogin && !isSignup;
    elements.accountModeToggle.textContent = isLogin
      ? "New here? Create an account"
      : "Already have an account? Log in";

    if (isProfile) {
      elements.accountNameInput.value = currentUser.name || "";
      elements.accountEmailInput.value = currentUser.email || "";
      elements.accountAvatarColorInput.value = currentUser.avatarColor || "#617459";
    }
    if (isSettings) {
      elements.accountCurrentPasswordInput.value = "";
      elements.accountNewPasswordInput.value = "";
    }
    if (!elements.accountDialog.open) {
      elements.accountDialog.showModal();
    }
    elements.accountDialog.querySelector("input:not(:disabled)")?.focus();
  }

  function showFormError(message) {
    elements.accountFormError.textContent = message;
    elements.accountFormError.hidden = false;
  }

  function closeMenu() {
    elements.accountMenuPanel.hidden = true;
    elements.accountMenuTrigger.setAttribute("aria-expanded", "false");
  }

  return {
    closeMenu,
    get mode() {
      return mode;
    },
    showDialog,
    showFormError,
    updateMenu,
  };
}
