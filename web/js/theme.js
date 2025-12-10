// theme.js
export class ThemeManager {
  constructor() {
    this.themeToggle = document.getElementById("theme-toggle");
    this.currentTheme = this.getSavedTheme() || this.getSystemTheme();
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
  }

  getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  getSavedTheme() {
    return localStorage.getItem("app-theme");
  }

  saveTheme(theme) {
    localStorage.setItem("app-theme", theme);
  }

  applyTheme(theme) {
    // Удаляем оба класса
    document.body.classList.remove("theme-dark", "theme-light");

    // Если тема 'system', используем системную
    if (theme === "system") {
      const systemTheme = this.getSystemTheme();
      document.body.classList.add(`theme-${systemTheme}`);
      this.updateToggleIcon(systemTheme);
    } else {
      document.body.classList.add(`theme-${theme}`);
      this.updateToggleIcon(theme);
    }

    this.currentTheme = theme;
    this.saveTheme(theme);
  }

  updateToggleIcon(theme) {
    const icon = this.themeToggle.querySelector("span") || this.themeToggle;
    icon.textContent = theme === "light" ? "☀️" : "🌙";

    // Обновляем tooltip
    this.themeToggle.setAttribute(
      "data-tooltip",
      theme === "light"
        ? "Переключить на тёмную тему"
        : "Переключить на светлую тему"
    );
  }

  toggleTheme() {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.applyTheme(newTheme);
  }

  setupEventListeners() {
    this.themeToggle.addEventListener("click", () => this.toggleTheme());

    // Слушаем изменения системной темы
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", (e) => {
        if (this.currentTheme === "system") {
          this.applyTheme("system");
        }
      });
  }

  getCurrentTheme() {
    return this.currentTheme;
  }
}
