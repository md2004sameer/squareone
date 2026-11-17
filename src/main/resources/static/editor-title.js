export function createEditorTitle(title, { getEditor, shell }) {
  let frame = null;
  function resize() {
    title.classList.toggle("is-untitled", !title.value.trim() || title.value.trim() === "Untitled");
    if (!title.getClientRects().length) return;
    title.style.height = "auto";
    title.style.height = `${title.scrollHeight}px`;
  }
  function scheduleResize() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(resize);
  }
  function normalize() {
    if (title.value.includes("\n") || title.value.includes("\r")) {
      const cursor = title.selectionStart;
      const before = title.value.slice(0, cursor).replace(/\s*[\r\n]+\s*/gu, " ");
      title.value = title.value.replace(/\s*[\r\n]+\s*/gu, " ").slice(0, 160);
      title.setSelectionRange(before.length, before.length);
    }
    resize();
  }
  title.addEventListener("input", normalize, { capture: true });
  title.addEventListener("compositionend", normalize);
  title.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      getEditor()?.commands.focus("start");
    }
  });
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width !== lastWidth) {
      lastWidth = entry.contentRect.width;
      scheduleResize();
    }
  }).observe(title.parentElement);
  new MutationObserver(scheduleResize).observe(shell, { attributes: true, attributeFilter: ["style", "class"] });
  document.fonts?.ready.then(scheduleResize);
  window.addEventListener("resize", scheduleResize);
  return { resize, scheduleResize };
}
