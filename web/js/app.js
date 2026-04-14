// web/app.js
import { api, formatDateTime, logToBackend } from "./api.js";
import locale, { t } from "./localisation.js";
import { ThemeManager } from "./theme.js";
import ui from "./ui.js";

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
  currentLang: "ru",
  updateInfo: null,
  versionElement: null,
};

window.app = {
  showView: ui.showView,
  copyToClipboard: ui.copyToClipboard,
  openForm: (game = null) => ui.openForm(state, game),
  openConfirmModal: (gameId) => ui.openConfirmModal(state, gameId),
  loadAndRender: () => loadAndRender(state),
  filterAndDisplay: () => filterAndDisplay(state),
  showDuplicatePopup: (searchText, currentGameId = null) =>
    ui.showDuplicatePopup(state, searchText, currentGameId),
  hideDuplicatePopup: ui.hideDuplicatePopup,
  toggleTheme: () => window.themeManager?.toggleTheme(),
  getCurrentTheme: () => window.themeManager?.getCurrentTheme(),
  changeLanguage: async (lang) => {
    await locale.changeLanguage(lang);
    state.currentLang = locale.getCurrentLang();
    await loadAndRender(state);
  },
  getCurrentLanguage: () => locale.getCurrentLang(),
  checkForUpdates,
  initiateAppUpdate,
  updateVersionTooltip,
  _state: state,
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    state.currentLang = await locale.init();

    initializeThemeManager();
    ui.setupEventHandlers(state);
    await loadAndRender(state);
    await updateAppVersion();
  } catch (error) {
    console.error("Error initializing application:", error);
    logToBackend("error", `App init error: ${error.message || error}`);
    alert(t("load_error"));
  }
});

export function showAppOverlay() {
  const appOverlay = document.getElementById("app-overlay");
  if (appOverlay) {
    appOverlay.style.display = "flex";
    const overlayText = appOverlay.querySelector("p");
    if (overlayText) {
      overlayText.textContent = t("loading");
    }
  }
}

export function hideAppOverlay() {
  const appOverlay = document.getElementById("app-overlay");
  if (appOverlay) {
    appOverlay.style.display = "none";
  }
}

async function loadAndRender(state) {
  showAppOverlay();

  try {
    state.allGames = await api.loadGames();
    ui.updateStats(await api.getStatistics());
    filterAndDisplay(state);
  } catch (error) {
    console.error("Error loading data:", error);
    logToBackend("error", `Data load error: ${error.message || error}`);
    ui.showToast(t("load_error"));
  } finally {
    setTimeout(() => hideAppOverlay(), 300);
  }
}

function filterAndDisplay(state) {
  ui.filterAndDisplay(state);
}

function initializeThemeManager() {
  try {
    const themeManager = new ThemeManager();
    window.themeManager = themeManager;
    window.app.themeManager = themeManager;
  } catch (error) {
    console.error("Error initializing ThemeManager:", error);
    logToBackend("error", `ThemeManager init error: ${error.message || error}`);
    document.body.classList.remove("theme-light");
    localStorage.setItem("app-theme", "dark");
  }
}

async function updateAppVersion() {
  try {
    const version = await api.getAppVersion();
    const versionElement = document.getElementById("app-version");
    if (versionElement) {
      versionElement.textContent = version;
      state.versionElement = versionElement;
      // Проверяем обновления после установки версии
      await checkForUpdates(versionElement);
    }
  } catch (error) {
    console.log("Failed to get app version:", error);
  }
}

async function checkForUpdates(versionElement = null) {
  try {
    const updateInfo = await api.checkUpdates();
    state.updateInfo = updateInfo;

    if (versionElement) {
      // Сбрасываем классы
      versionElement.classList.remove(
        "app-header__version--current",
        "app-header__version--update",
      );

      // Убираем обработчик клика если был
      versionElement.onclick = null;

      const releaseDate = updateInfo.created_at
        ? formatDateTime(updateInfo.created_at, true)
        : "—";

      if (updateInfo.has_update) {
        // Есть обновление - жёлтый цвет, клик открывает модалку
        versionElement.classList.add("app-header__version--update");
        versionElement.onclick = () => ui.showUpdateModal(updateInfo);

        // Добавляем тултип с информацией (используем локализацию)
        const tooltipText = locale.t("version_tooltip_update", {
          version: updateInfo.latest_version,
          date: releaseDate,
        });
        versionElement.setAttribute("data-tooltip", tooltipText);
        ui.showToast(tooltipText);
      } else {
        // Актуальная версия - зелёный цвет
        versionElement.classList.add("app-header__version--current");

        // Добавляем тултип с информацией (используем локализацию)
        const tooltipText = locale.t("version_tooltip_current", {
          version: updateInfo.current_version,
          date: releaseDate,
        });
        versionElement.setAttribute("data-tooltip", tooltipText);
        ui.showToast(tooltipText);
      }
    } else if (updateInfo.has_update) {
      // Если versionElement не передан, просто показываем уведомление
      ui.showUpdateNotification(updateInfo);
    }
  } catch (error) {
    console.log("Failed to get check updates:", error);
  }
}

async function initiateAppUpdate() {
  try {
    if (state.updateInfo) {
      await api.updateApp(state.updateInfo);
      ui.closeUpdateModal();
    }
  } catch (error) {
    console.error("Error initiating app update:", error);
    logToBackend("error", `App update initiation error: ${error.message || error}`);
  }
}

export function updateVersionTooltip() {
  if (!state.versionElement || !state.updateInfo) return;

  const versionElement = state.versionElement;
  const updateInfo = state.updateInfo;
  const releaseDate = updateInfo.created_at
    ? formatDateTime(updateInfo.created_at, true)
    : "—";

  if (updateInfo.has_update) {
    const tooltipText = locale.t("version_tooltip_update", {
      version: updateInfo.latest_version,
      date: releaseDate,
    });
    versionElement.setAttribute("data-tooltip", tooltipText);
  } else {
    const tooltipText = locale.t("version_tooltip_current", {
      version: updateInfo.current_version,
      date: releaseDate,
    });
    versionElement.setAttribute("data-tooltip", tooltipText);
  }
}

export { filterAndDisplay, loadAndRender, state };
