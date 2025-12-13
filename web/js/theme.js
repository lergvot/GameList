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

    // Обновляем тултип
    this.updateTooltip(theme);
  }

  // ПУБЛИЧНЫЙ МЕТОД для обновления тултипа
  updateTooltip(theme = null) {
    // Если тема не передана, используем текущую
    const currentTheme =
      theme ||
      (this.currentTheme === "system"
        ? this.getSystemTheme()
        : this.currentTheme);

    // Определяем противоположную тему для тултипа
    const oppositeTheme = currentTheme === "light" ? "dark" : "light";

    // Получаем актуальные значения локализации
    let tooltipLight = "Переключить на тёмную тему";
    let tooltipDark = "Переключить на светлую тему";

    // Проверяем глобальные переменные
    if (window.$theme_toggle_tooltip_light) {
      tooltipLight = window.$theme_toggle_tooltip_light;
    } else if (typeof $theme_toggle_tooltip_light !== "undefined") {
      tooltipLight = $theme_toggle_tooltip_light;
    }

    if (window.$theme_toggle_tooltip_dark) {
      tooltipDark = window.$theme_toggle_tooltip_dark;
    } else if (typeof $theme_toggle_tooltip_dark !== "undefined") {
      tooltipDark = $theme_toggle_tooltip_dark;
    }

    // Устанавливаем правильный тултип в зависимости от противоположной темы
    this.themeToggle.setAttribute(
      "data-tooltip",
      oppositeTheme === "light" ? tooltipLight : tooltipDark
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

// Создаем глобальный экземпляр для доступа из других модулей
window.themeManager = new ThemeManager();
