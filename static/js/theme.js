(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  var meta = document.querySelector('meta[name="theme-color"]');

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* ignore */
    }
    // Keep the browser chrome on the same paper as the page.
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0d0c0a" : "#dcdad4");
    if (toggle) {
      var isDark = theme === "dark";
      toggle.setAttribute("aria-checked", isDark ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
      );
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  setTheme(currentTheme());
})();
