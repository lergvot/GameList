// web/app.js
// Точка входа: состояние приложения и инициализация

import { api } from "./api.js";
import ui from "./ui.js";
import { ThemeManager } from "./theme.js";

// ============================================
// ОВЕРЛЕЙ ЗАГРУЗКИ ПРИЛОЖЕНИЯ
// ============================================
export function showAppOverlay() {
  const appOverlay = document.getElementById("app-overlay");
  if (appOverlay) {
    appOverlay.style.display = "flex";
  }
}

export function hideAppOverlay() {
  const appOverlay = document.getElementById("app-overlay");
  if (appOverlay) {
    appOverlay.style.display = "none";
  }
}

// ============================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================
const state = {
  allGames: [],
  currentFilter: "all",
  currentSearch: "",
  selectedToDelete: null,
  unsavedScreenshotData: null,
  editingGame: null,
  isSubmitting: false,
  duplicatePopupTimeout: null,
  currentSort: "added-asc",
};

// ============================================
// ГЛОБАЛЬНЫЙ ОБЪЕКТ ДЛЯ INLINE ОБРАБОТЧИКОВ
// ============================================
window.app = {
  // UI функции
  showView: ui.showView,
  copyToClipboard: ui.copyToClipboard,

  // Функции с состоянием (биндим state)
  openForm: (game = null) => ui.openForm(state, game),
  openConfirmModal: (gameId) => ui.openConfirmModal(state, gameId),

  // Функции для перезагрузки данных
  loadAndRender: () => loadAndRender(state),
  filterAndDisplay: () => filterAndDisplay(state),

  // Функции для попапа дубликатов
  showDuplicatePopup: (searchText, currentGameId = null) =>
    ui.showDuplicatePopup(state, searchText, currentGameId),
  hideDuplicatePopup: ui.hideDuplicatePopup,

  // Функция для переключения темы (добавлено)
  toggleTheme: () => window.themeManager?.toggleTheme(),

  // Получение текущей темы (добавлено)
  getCurrentTheme: () => window.themeManager?.getCurrentTheme(),

  // Экспортируем состояние для отладки
  _state: state,
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Инициализация менеджера тем ДО настройки обработчиков
    initializeThemeManager();

    // Настройка обработчиков событий
    ui.setupEventHandlers(state);

    // Загрузка начальных данных
    await loadAndRender(state);

    // Загрузка версии приложения
    await updateAppVersion();
  } catch (error) {
    console.error("Ошибка инициализации приложения:", error);
    alert("Не удалось инициализировать приложение");
  }
});

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ
// ============================================
async function loadAndRender(state) {
  showAppOverlay();

  try {
    state.allGames = await api.loadGames();
    ui.updateStats(await api.getStatistics());
    filterAndDisplay(state);
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    ui.showToast("Не удалось загрузить список игр");
  } finally {
    setTimeout(() => hideAppOverlay(), 300);
  }
}

function filterAndDisplay(state) {
  ui.filterAndDisplay(state);
}

async function updateAppVersion() {
  try {
    const version = await api.getAppVersion();
    const versionElement = document.querySelector(".app-header__version");
    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }
  } catch (error) {
    console.log("Не удалось получить версию приложения:", error);
  }
}

// ============================================
// УПРАВЛЕНИЕ ТЕМОЙ
// ============================================
function initializeThemeManager() {
  try {
    // Создаем экземпляр ThemeManager
    const themeManager = new ThemeManager();

    // Сохраняем в глобальной области для доступа
    window.themeManager = themeManager;

    // Также добавляем в глобальный объект app
    window.app.themeManager = themeManager;

    console.log(
      "ThemeManager инициализирован, текущая тема:",
      themeManager.getCurrentTheme()
    );
  } catch (error) {
    console.error("Ошибка инициализации ThemeManager:", error);
    // Фолбэк: применяем темную тему по умолчанию
    document.body.classList.remove("theme-light");
    localStorage.setItem("app-theme", "dark");
  }
}

// Экспортируем для возможного расширения
export { state, loadAndRender, filterAndDisplay };
