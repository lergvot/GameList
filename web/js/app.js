// web/app.js
import { api } from "./api.js";
import ui from "./ui.js";
import { ThemeManager } from "./theme.js";
import locale, { t } from "./localisation.js";

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
    ui.showToast(t("load_error"));
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
    const versionElement = document.getElementById("app-version");
    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }
  } catch (error) {
    console.log("Failed to get app version:", error);
  }
}

function initializeThemeManager() {
  try {
    const themeManager = new ThemeManager();
    window.themeManager = themeManager;
    window.app.themeManager = themeManager;
  } catch (error) {
    console.error("Error initializing ThemeManager:", error);
    document.body.classList.remove("theme-light");
    localStorage.setItem("app-theme", "dark");
  }
}

export { state, loadAndRender, filterAndDisplay };
