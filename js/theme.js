(() => {
  "use strict";

  const selectors = ["#theme-toggle", "#theme-toggle-desktop", "#theme-toggle-welcome"];
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  function apply(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    root.dataset.theme = selected;
    selectors.forEach((selector) => {
      const button = document.querySelector(selector);
      if (!button) return;
      const label = selected === "dark" ? "Switch to light theme" : "Switch to dark theme";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
    if (metaTheme) metaTheme.setAttribute("content", selected === "dark" ? "#101827" : "#ECEFF4");
    return selected;
  }

  function toggle() {
    const current = window.YaduvanshiStorage.get("theme");
    const next = current === "dark" ? "light" : "dark";
    window.YaduvanshiStorage.set("theme", next);
    apply(next);
  }

  selectors.forEach((selector) => {
    const button = document.querySelector(selector);
    if (button) button.addEventListener("click", toggle);
  });

  window.YaduvanshiTheme = Object.freeze({ apply, toggle });
})();