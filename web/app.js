// web/app.js
// Точка входа: состояние приложения и инициализация

import { api } from "./api.js";
import ui from "./ui.js";

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

  // Экспортируем состояние для отладки
  _state: state,
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  // Настройка обработчиков событий
  ui.setupEventHandlers(state);

  // Загрузка начальных данных
  await loadAndRender(state);

  // Загрузка версии приложения
  await updateAppVersion();
});

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ
// ============================================
async function loadAndRender(state) {
  try {
    state.allGames = await api.loadGames();
    ui.updateStats(await api.getStatistics());
    filterAndDisplay(state);
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    alert("Не удалось загрузить список игр");
  }
}

function filterAndDisplay(state) {
  ui.filterAndDisplay(state);
}

async function updateAppVersion() {
  try {
    const version = await api.getAppVersion();
    const versionElement = document.querySelector(".app-version");
    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }
  } catch (error) {
    console.log("Не удалось получить версию приложения:", error);
  }
}

// Экспортируем для возможного расширения
export { state, loadAndRender, filterAndDisplay };
