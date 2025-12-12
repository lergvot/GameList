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
};

export function formatDateTime(dateString, returnOnlyDate = false) {
  if (!dateString) return "—";

  try {
    const date = new Date(
      dateString.includes(" ") ? dateString.replace(" ", "T") + "Z" : dateString
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
          gameWords.some((gameWord) => gameWord === searchWord)
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
            gameNameLower.includes(searchWord)
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
