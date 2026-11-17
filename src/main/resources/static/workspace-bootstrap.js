// Keep recovery independent of the editor's module graph, including CDN imports.
const loading = document.querySelector("#workspace-loading");
const error = document.querySelector("#workspace-error");
const message = document.querySelector("#workspace-error-message");

function showStartupError() {
  loading.hidden = true;
  error.hidden = false;
  document.querySelector("#editor").hidden = true;
  document.querySelector("#welcome-state").hidden = true;
  document.querySelectorAll("[data-workspace-control]").forEach((control) => { control.disabled = true; });
  message.textContent = "Squareone couldn't start. Check your connection and try again. Your saved notes are still available when you reconnect.";
}

document.querySelector("#workspace-retry").addEventListener("click", () => window.location.reload());
const startupTimer = window.setTimeout(() => {
  if (!loading.hidden) showStartupError();
}, 30000);
import("./appdocs.js?v=32")
  .catch((cause) => {
    console.error("Unable to start the workspace:", cause);
    showStartupError();
  })
  .finally(() => window.clearTimeout(startupTimer));
