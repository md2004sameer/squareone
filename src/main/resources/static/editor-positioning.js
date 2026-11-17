export function visualBounds() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

export function workspaceBounds(workspace) {
  const viewport = visualBounds();
  const bounds = workspace.getBoundingClientRect();
  const left = Math.max(viewport.left, bounds.left);
  const right = Math.min(viewport.right, bounds.right);
  const top = Math.max(viewport.top, workspace.querySelector(".topbar")?.getBoundingClientRect().bottom || viewport.top);
  return { ...viewport, top, height: viewport.bottom - top, left, right, width: Math.max(0, right - left) };
}

export function positionPopup(popup, anchor, { bounds = visualBounds(), above = false, gap = 8 } = {}) {
  const padding = 12;
  popup.style.maxWidth = `${Math.max(0, bounds.width - padding * 2)}px`;
  const anchorTop = Math.max(bounds.top, Math.min(anchor.top, bounds.bottom));
  const anchorBottom = Math.max(bounds.top, Math.min(anchor.bottom, bounds.bottom));
  const availableBelow = Math.max(0, bounds.bottom - anchorBottom - gap - padding);
  const availableAbove = Math.max(0, anchorTop - bounds.top - gap - padding);
  popup.style.maxHeight = `${Math.max(0, Math.max(availableBelow, availableAbove))}px`;
  const size = popup.getBoundingClientRect();
  const useAbove = above ? availableAbove >= size.height || availableAbove >= availableBelow
    : availableBelow < size.height && availableAbove > availableBelow;
  const left = Math.max(bounds.left + padding, Math.min(anchor.left, bounds.right - size.width - padding));
  const top = Math.max(bounds.top + padding, Math.min(
    useAbove ? anchorTop - size.height - gap : anchorBottom + gap,
    bounds.bottom - size.height - padding,
  ));
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

export function observeEditorLayout(elements, callback) {
  let frame = null;
  const schedule = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(callback);
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  const resize = new ResizeObserver(schedule);
  resize.observe(elements.workspace);
  resize.observe(elements.editor);
  const mutations = new MutationObserver(schedule);
  mutations.observe(elements.appShell, { attributes: true, attributeFilter: ["class", "style"] });
  for (const element of [elements.editor, elements.workspaceLoading, elements.workspaceError]) {
    mutations.observe(element, { attributes: true, attributeFilter: ["hidden"] });
  }
  document.querySelectorAll("dialog").forEach((dialog) => mutations.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  schedule();
  return schedule;
}
