// web/js/api.js
import { t } from "./localisation.js";

export const api = {
  async loadGames() {
    return (await eel.load_games()()) || [];
  },

  async addGame(payload, screenshot) {
    return await eel.add_game(payload, screenshot)();
  },

  async updateGame(id, payload, screenshot) {
    return await eel.update_game(id, payload, screenshot)();
  },

  async deleteGame(id) {
    return await eel.delete_game(id)();
  },

  async getStatistics() {
    return await eel.get_statistics()();
  },

  async getAppVersion() {
    try {
      return await eel.get_version()();
    } catch {
      return "unknown";
    }
  },
  async checkUpdates() {
    try {
      return await eel.check_updates()();
    } catch {
      return { updateAvailable: false };
    }
  },
  async updateApp(updateInfo) {
    try {
      await eel.update_app(updateInfo)();
    } catch (error) {
      console.error("Error initiating app update:", error);
      logToBackend("error", `App update error: ${error.message || error}`);
    }
  },
};

/**
 * Логирует сообщение на бэкенд (если Eel доступен)
 * @param {string} level - уровень: "error", "warning", "info"
 * @param {string} message - сообщение
 */
export function logToBackend(level, message) {
  try {
    if (window.eel && window.eel.log_frontend) {
      window.eel.log_frontend(level, message);
    }
  } catch (e) {
    // Игнорируем ошибки логирования чтобы не засорять консоль
  }
}

export function formatDateTime(dateString, returnOnlyDate = false) {
  if (!dateString) return "—";

  try {
    const date = new Date(
      dateString.includes(" ")
        ? dateString.replace(" ", "T") + "Z"
        : dateString,
    );

    if (isNaN(date.getTime())) return "—";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    if (returnOnlyDate) {
      return `${day}.${month}.${year}`;
    }

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds} ${day}.${month}.${year}`;
  } catch (error) {
    console.error("Ошибка форматирования даты:", error, dateString);
    logToBackend("error", `Date format error: ${error.message || error} for date: ${dateString}`);
    return "—";
  }
}

export function statusClassFor(status) {
  const classes = {
    completed: "status-badge--completed",
    playing: "status-badge--playing",
    planned: "status-badge--planned",
    dropped: "status-badge--dropped",
  };
  return classes[status] || "";
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeInput(str) {
  if (!str) return "";
  return String(str).replace(/[<>]/g, "");
}

export function findSimilarGames(gameName, allGames, currentGameId = null) {
  const searchTerm = gameName.toLowerCase().trim();

  if (searchTerm.length < 2) {
    return [];
  }

  return allGames
    .filter((game) => {
      if (currentGameId && game.id == currentGameId) {
        return false;
      }

      const gameNameLower = game.title
        ? game.title.toLowerCase()
        : game.name
          ? game.name.toLowerCase()
          : "";

      if (gameNameLower === searchTerm) {
        return true;
      }

      if (gameNameLower.startsWith(searchTerm)) {
        return true;
      }

      const searchWords = searchTerm.split(/\s+/).filter((w) => w.length > 1);
      const gameWords = gameNameLower.split(/\s+/);

      if (searchWords.length > 0) {
        const allSearchWordsFound = searchWords.every((searchWord) =>
          gameWords.some((gameWord) => gameWord === searchWord),
        );

        if (allSearchWordsFound) {
          return true;
        }
      }

      if (searchTerm.length > 3) {
        if (gameNameLower.includes(searchTerm)) {
          return true;
        }

        if (searchWords.length > 0) {
          const allWordsPartiallyFound = searchWords.every((searchWord) =>
            gameNameLower.includes(searchWord),
          );

          return allWordsPartiallyFound;
        }
      }

      return false;
    })
    .sort((a, b) => {
      const aName = a.title
        ? a.title.toLowerCase()
        : a.name
          ? a.name.toLowerCase()
          : "";
      const bName = b.title
        ? b.title.toLowerCase()
        : b.name
          ? b.name.toLowerCase()
          : "";

      if (aName === searchTerm) return -1;
      if (bName === searchTerm) return 1;

      if (aName.startsWith(searchTerm)) return -1;
      if (bName.startsWith(searchTerm)) return 1;

      return aName.localeCompare(bName);
    });
}

export function findSimilarDevelopers(searchTerm, allGames, currentGameId = null) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const term = searchTerm.toLowerCase().trim();

  const developerMap = new Map();

  allGames.forEach((game) => {
    if (currentGameId && game.id == currentGameId) {
      return;
    }

    const developer = game.developer;
    if (!developer) return;

    const developerLower = developer.toLowerCase();

    if (developerLower.includes(term)) {
      if (!developerMap.has(developer)) {
        developerMap.set(developer, { developer, count: 0 });
      }
      developerMap.get(developer).count++;
    }
  });

  return Array.from(developerMap.values()).sort((a, b) => {
    const aLower = a.developer.toLowerCase();
    const bLower = b.developer.toLowerCase();

    if (aLower === term) return -1;
    if (bLower === term) return 1;

    if (aLower.startsWith(term)) return -1;
    if (bLower.startsWith(term)) return 1;

    return b.count - a.count || a.developer.localeCompare(b.developer);
  });
}

export function getStatusText(status) {
  const statusMap = {
    playing: "status_playing_display",
    planned: "status_planned_display",
    completed: "status_completed_display",
    dropped: "status_dropped_display",
  };

  const key = statusMap[status] || "status_unknown_display";
  return t(key);
}
