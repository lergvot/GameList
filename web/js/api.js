// web/js/api.js
// Взаимодействие с бекендом (Eel) и утилиты форматирования

// ============================================
// API ВЫЗОВЫ К PYTHON (EEL)
// ============================================
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

// ============================================
// УТИЛИТЫ ФОРМАТИРОВАНИЯ
// ============================================
/**
 * Форматирует дату и время из SQLite (UTC) в локальное время
 * @param {string} dateString - Строка с датой в формате "YYYY-MM-DD HH:MM:SS" (UTC)
 * @param {boolean} returnOnlyDate - Возвращать только дату
 * @returns {string} Отформатированная строка в локальном времени
 */
export function formatDateTime(dateString, returnOnlyDate = false) {
  if (!dateString) return "—";

  try {
    // Простое преобразование: SQLite формат -> ISO с UTC
    const date = new Date(
      dateString.includes(" ")
        ? dateString.replace(" ", "T") + "Z" // SQLite формат: добавляем Z для UTC
        : dateString // Уже в ISO формате
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

// ============================================
// ПОИСК ПОХОЖИХ ИГР (ДЛЯ ДУБЛИКАТОВ)
// ============================================
export function findSimilarGames(gameName, allGames, currentGameId = null) {
  const searchTerm = gameName.toLowerCase().trim();

  // Если строка поиска пустая или слишком короткая - возвращаем пустой массив
  if (searchTerm.length < 2) {
    return [];
  }

  return allGames
    .filter((game) => {
      // Исключаем текущую редактируемую игру
      if (currentGameId && game.id == currentGameId) {
        return false;
      }

      const gameNameLower = game.title
        ? game.title.toLowerCase()
        : game.name
        ? game.name.toLowerCase()
        : "";

      // 1. Точное совпадение (самый высокий приоритет)
      if (gameNameLower === searchTerm) {
        return true;
      }

      // 2. Ищем игры, которые начинаются с поискового запроса
      if (gameNameLower.startsWith(searchTerm)) {
        return true;
      }

      // 3. Разбиваем на слова и ищем точные совпадения слов
      const searchWords = searchTerm.split(/\s+/).filter((w) => w.length > 1);
      const gameWords = gameNameLower.split(/\s+/);

      // Проверяем, содержатся ли все слова поиска в названии игры
      if (searchWords.length > 0) {
        const allSearchWordsFound = searchWords.every((searchWord) =>
          gameWords.some((gameWord) => gameWord === searchWord)
        );

        if (allSearchWordsFound) {
          return true;
        }
      }

      // 4. Проверяем на частичное совпадение (только если запрос длинный)
      if (searchTerm.length > 3) {
        // Ищем игры, которые содержат поисковый запрос целиком
        if (gameNameLower.includes(searchTerm)) {
          return true;
        }

        // Ищем игры, где каждое слово поиска содержится в названии
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
      // Сортируем результаты по релевантности
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

      // Точное совпадение имеет высший приоритет
      if (aName === searchTerm) return -1;
      if (bName === searchTerm) return 1;

      // Начинающиеся с запроса - следующий приоритет
      if (aName.startsWith(searchTerm)) return -1;
      if (bName.startsWith(searchTerm)) return 1;

      // Затем по алфавиту
      return aName.localeCompare(bName);
    });
}

// ============================================
// ПОЛУЧЕНИЕ РУССКОГО ТЕКСТА СТАТУСА
// ============================================
export function getStatusTextRu(status) {
  const statusMap = {
    playing: "Играю",
    planned: "В планах",
    completed: "Прошёл",
    dropped: "Дропнул",
  };
  return statusMap[status] || "Неизвестно";
}
