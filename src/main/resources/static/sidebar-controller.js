const SIDEBAR_WIDTH_KEY = "squareone.sidebar-width.v1";
const SIDEBAR_MODE_KEY = "squareone.sidebar-mode.v1";
const SIDEBAR_MODES = ["expanded", "compact", "hidden"];
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 400;

export function createSidebarController(elements, onChange = () => {}) {
  let sidebarResizePointerId = null;
  let sidebarWidth = 260;
  let sidebarMode = "expanded";
  let mobileSidebarOpen = false;

  function isMobileViewport() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function updateToggleState() {
    if (isMobileViewport()) {
      elements.sidebarToggle.setAttribute("aria-expanded", String(mobileSidebarOpen));
      elements.sidebarToggle.setAttribute(
        "aria-label",
        mobileSidebarOpen ? "Close navigation" : "Open navigation",
      );
      elements.sidebarToggle.title = mobileSidebarOpen ? "Close navigation" : "Open navigation";
      return;
    }

    const modeIndex = SIDEBAR_MODES.indexOf(sidebarMode);
    const nextMode = SIDEBAR_MODES[(modeIndex + 1) % SIDEBAR_MODES.length];
    elements.sidebarToggle.setAttribute("aria-expanded", String(sidebarMode !== "hidden"));
    elements.sidebarToggle.setAttribute(
      "aria-label",
      `Sidebar ${sidebarMode}. Click for ${nextMode} mode.`,
    );
    elements.sidebarToggle.title =
      `Sidebar ${sidebarMode} · click for ${nextMode} · Cmd/Ctrl+\\ to cycle modes`;
  }

  function setMobileSidebarOpen(open, restoreFocus = true) {
    mobileSidebarOpen = open;
    elements.appShell.classList.toggle("mobile-sidebar-open", open && isMobileViewport());
    elements.sidebarBackdrop.hidden = !open || !isMobileViewport();
    document.body.classList.toggle("sidebar-drawer-open", open && isMobileViewport());
    elements.workspace.inert = open && isMobileViewport();
    elements.documentOutlinePane.inert = open && isMobileViewport();
    updateToggleState();
    if (open && isMobileViewport()) {
      elements.sidebarClose.focus();
    } else if (restoreFocus) {
      elements.sidebarToggle.focus();
    }
  }

  function clampSidebarWidth(width) {
    const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 328);
    return Math.round(Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, width)));
  }

  function setSidebarWidth(width) {
    const clampedWidth = clampSidebarWidth(width);
    sidebarWidth = clampedWidth;
    if (sidebarMode === "expanded") {
      elements.appShell.style.setProperty("--sidebar-width", `${clampedWidth}px`);
    }
    elements.sidebarResizeHandle.setAttribute("aria-valuenow", String(clampedWidth));
    return clampedWidth;
  }

  function setSidebarMode(mode, persist = true) {
    if (!SIDEBAR_MODES.includes(mode)) {
      return;
    }
    sidebarMode = mode;
    const modeWidth = mode === "compact" ? 56 : mode === "hidden" ? 0 : sidebarWidth;

    elements.appShell.classList.toggle("sidebar-compact", mode === "compact");
    elements.appShell.classList.toggle("sidebar-hidden", mode === "hidden");
    elements.appShell.style.setProperty("--sidebar-width", `${modeWidth}px`);
    elements.sidebarResizeHandle.setAttribute("aria-hidden", String(mode !== "expanded"));
    elements.sidebarResizeHandle.tabIndex = mode === "expanded" ? 0 : -1;
    elements.sidebarToggle.dataset.mode = mode;
    updateToggleState();

    if (persist) onChange({ sidebarMode: mode });
  }

  function cycleSidebarMode() {
    if (isMobileViewport()) {
      setMobileSidebarOpen(!mobileSidebarOpen, mobileSidebarOpen);
      return;
    }
    const currentIndex = SIDEBAR_MODES.indexOf(sidebarMode);
    setSidebarMode(SIDEBAR_MODES[(currentIndex + 1) % SIDEBAR_MODES.length]);
  }

  function openMobileSidebar() {
    if (isMobileViewport()) {
      setMobileSidebarOpen(true, false);
    }
  }

  function closeMobileSidebar(restoreFocus = true) {
    if (mobileSidebarOpen) {
      setMobileSidebarOpen(false, restoreFocus);
    }
  }

  function focusSearch() {
    if (isMobileViewport()) {
      setMobileSidebarOpen(true, false);
    } else if (sidebarMode !== "expanded") {
      setSidebarMode("expanded", false);
    }
    elements.search.focus();
  }

  function saveSidebarWidth(width) { onChange({ sidebarWidth: width }); }

  function endSidebarResize(event) {
    if (event.pointerId !== sidebarResizePointerId) {
      return;
    }
    sidebarResizePointerId = null;
    elements.appShell.classList.remove("resizing-sidebar");
    if (elements.sidebarResizeHandle.hasPointerCapture(event.pointerId)) {
      elements.sidebarResizeHandle.releasePointerCapture(event.pointerId);
    }
    saveSidebarWidth(elements.sidebar.getBoundingClientRect().width);
  }

  try {
    const savedSidebarWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(savedSidebarWidth) && savedSidebarWidth > 0) {
      setSidebarWidth(savedSidebarWidth);
    }
    const savedSidebarMode = window.localStorage.getItem(SIDEBAR_MODE_KEY);
    if (SIDEBAR_MODES.includes(savedSidebarMode)) {
      sidebarMode = savedSidebarMode;
    }
  } catch (error) {
    console.warn("Unable to load sidebar preferences:", error);
  }
  setSidebarMode(sidebarMode, false);

  elements.sidebarToggle.addEventListener("click", cycleSidebarMode);
  elements.sidebarClose.addEventListener("click", closeMobileSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  elements.sidebar.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !mobileSidebarOpen || !isMobileViewport()) {
      return;
    }
    const focusableItems = Array.from(elements.sidebar.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), summary, a[href]',
    )).filter((item) => item.getClientRects().length > 0);
    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    if (!firstItem || !lastItem) {
      return;
    }
    if (event.shiftKey && (document.activeElement === firstItem || !elements.sidebar.contains(document.activeElement))) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  });
  elements.sidebarResizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    sidebarResizePointerId = event.pointerId;
    elements.sidebarResizeHandle.setPointerCapture(event.pointerId);
    elements.appShell.classList.add("resizing-sidebar");
    event.preventDefault();
  });
  elements.sidebarResizeHandle.addEventListener("pointermove", (event) => {
    if (event.pointerId === sidebarResizePointerId) {
      setSidebarWidth(event.clientX);
    }
  });
  elements.sidebarResizeHandle.addEventListener("pointerup", endSidebarResize);
  elements.sidebarResizeHandle.addEventListener("pointercancel", endSidebarResize);
  elements.sidebarResizeHandle.addEventListener("keydown", (event) => {
    const currentWidth = elements.sidebar.getBoundingClientRect().width;
    const step = event.shiftKey ? 40 : 16;
    let nextWidth;
    if (event.key === "ArrowLeft") {
      nextWidth = currentWidth - step;
    } else if (event.key === "ArrowRight") {
      nextWidth = currentWidth + step;
    } else if (event.key === "Home") {
      nextWidth = MIN_SIDEBAR_WIDTH;
    } else if (event.key === "End") {
      nextWidth = MAX_SIDEBAR_WIDTH;
    } else {
      return;
    }
    event.preventDefault();
    saveSidebarWidth(setSidebarWidth(nextWidth));
  });
  window.addEventListener("resize", () => {
    if (!isMobileViewport() && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    } else {
      updateToggleState();
    }
  });

  return {
    applyPreferences(settings) {
      setSidebarWidth(settings.sidebarWidth);
      setSidebarMode(settings.sidebarMode, false);
    },
    cycleSidebarMode,
    closeMobileSidebar,
    focusSearch,
    openMobileSidebar,
    refreshSidebarWidth: () => setSidebarWidth(sidebarWidth),
  };
}
