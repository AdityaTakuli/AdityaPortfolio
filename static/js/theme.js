/* Theme: light for everyone by default, whatever the device or browser is set
   to. Dark is only ever the visitor's own choice, made with the toggle and
   remembered under "theme-pref" (a fresh key, so choices saved by older
   versions of the site don't carry over). The inline script in each page's
   <head> applies a saved choice before first paint. */
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var KEY = "theme-pref";

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  var themeColor = document.querySelector('meta[name="theme-color"]');
  var colorScheme = document.querySelector('meta[name="color-scheme"]');

  function applyTheme(theme) {
    var isDark = theme === "dark";
    root.setAttribute("data-theme", theme);
    // Keep the browser chrome on the same paper as the page.
    if (themeColor) themeColor.setAttribute("content", isDark ? "#0d0c0a" : "#dcdad4");
    // "only light" stops browsers auto-darkening the page; when the visitor
    // picks dark, declare dark so the browser's own controls match.
    if (colorScheme) colorScheme.setAttribute("content", isDark ? "dark" : "only light");
    if (toggle) {
      toggle.setAttribute("aria-checked", isDark ? "true" : "false");
      toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        /* private mode or blocked storage: the choice lasts for this page */
      }
    });
  }

  applyTheme(currentTheme());
})();
