const THEME_STORAGE_KEY = "squareone.theme.v1";
const THEME_MODES = ["system", "light", "dark"];

function findDarkThemeRule() {
  const visited = new Set();
  function findInStyleSheet(styleSheet) {
    if (!styleSheet || visited.has(styleSheet)) {
      return null;
    }
    visited.add(styleSheet);
    if (styleSheet.href && new URL(styleSheet.href).origin !== window.location.origin) {
      return null;
    }
    for (const rule of styleSheet.cssRules) {
      if (rule.type === CSSRule.IMPORT_RULE) {
        const importedRule = findInStyleSheet(rule.styleSheet);
        if (importedRule) {
          return importedRule;
        }
      } else if (
        rule.type === CSSRule.MEDIA_RULE
        && rule.conditionText === "(prefers-color-scheme: dark)"
      ) {
        return rule;
      }
    }
    return null;
  }

  for (const styleSheet of document.styleSheets) {
    const rule = findInStyleSheet(styleSheet);
    if (rule) {
      return rule;
    }
  }
  throw new Error("The dark theme media rule could not be found.");
}

export function createThemeController(button, onChange = () => {}) {
  let mode = "system";
  const darkThemeRule = findDarkThemeRule();
  const [lightThemeColor, darkThemeColor] = document.querySelectorAll('meta[name="theme-color"]');

  function applyTheme() {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode === "system" ? "light dark" : mode;
    darkThemeRule.media.mediaText = mode === "dark"
      ? "all"
      : mode === "light"
        ? "not all"
        : "(prefers-color-scheme: dark)";
    lightThemeColor.media = mode === "dark" ? "not all" : "(prefers-color-scheme: light)";
    darkThemeColor.media = mode === "light" ? "not all" : "(prefers-color-scheme: dark)";
    if (mode === "light") {
      lightThemeColor.media = "all";
    } else if (mode === "dark") {
      darkThemeColor.media = "all";
    }
    button.textContent = `Theme: ${mode[0].toUpperCase()}${mode.slice(1)}`;
    button.setAttribute("aria-label", `Theme: ${mode}. Select to change theme.`);
  }

  try {
    const savedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_MODES.includes(savedMode)) {
      mode = savedMode;
    }
  } catch (error) {
    console.warn("Unable to load theme preference:", error);
  }
  applyTheme();

  function cycleTheme() {
    mode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    applyTheme();
    onChange({ theme: mode });
  }

  return { cycleTheme, setMode(nextMode) {
    mode = THEME_MODES.includes(nextMode) ? nextMode : "system";
    applyTheme();
  } };
}
