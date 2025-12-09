// web/app.js

// ============================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ (STATE)
// ============================================
let allGames = [];
let currentFilter = "all";
let currentSearch = "";
let selectedToDelete = null;
let unsavedScreenshotData = null;
let editingGame = null;
let isSubmitting = false;
let duplicatePopupTimeout = null;
let currentSort = "added-asc"; // Сортировка по умолчанию

// ============================================
// DOM ЭЛЕМЕНТЫ (CACHED ELEMENTS)
// ============================================
const gamesListEl = document.getElementById("games-list");
const modal = document.getElementById("game-modal");
const form = document.getElementById("game-form");
const screenshotInput = document.getElementById("screenshot");
const screenshotPreview = document.getElementById("screenshot-preview");
const removeScreenshotBtn = document.getElementById("remove-screenshot");
const searchInput = document.getElementById("search");
const statusSelect = document.getElementById("status");
const titleInput = document.getElementById("title");
const duplicatePopup = document.getElementById("duplicate-popup");
const sortSelect = document.getElementById("sort-select");

// ============================================
// ИНИЦИАЛИЗАЦИЯ (INITIALIZATION)
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  attachHandlers();
  await loadAndRender();
  updateAppVersion();
});

// Получение и отображение версии приложения
async function updateAppVersion() {
  try {
    // Получаем версию из Python через Eel
    const version = await eel.get_version()();
    const versionElement = document.querySelector(".app-version");

    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }
  } catch (error) {
    console.log("Не удалось получить версию приложения:", error);
  }
}

// ============================================
// ПОИСК ПОХОЖИХ ИГР (DUPLICATE GAME SEARCH) - ОБНОВЛЁННЫЙ
// ============================================
function findSimilarGames(gameName, allGames, currentGameId = null) {
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
// ПОКАЗ/СКРЫТИЕ ВСПЛЫВАЮЩЕГО ОКНА С ДУБЛЯМИ - ОБНОВЛЁННЫЙ
// ============================================
// Вспомогательная функция для получения русского текста статуса
function getStatusTextRu(status) {
  const statusMap = {
    playing: "Играю",
    planned: "В планах",
    completed: "Прошёл",
    dropped: "Дропнул",
  };
  return statusMap[status] || "Неизвестно";
}

function showDuplicatePopup(searchText, currentGameId = null) {
  // Очищаем предыдущий таймаут
  clearTimeout(duplicatePopupTimeout);

  // Если поле пустое или слишком короткое - скрываем попап
  if (!searchText || searchText.trim().length < 2) {
    hideDuplicatePopup();
    return;
  }

  // Ищем похожие игры
  const similarGames = findSimilarGames(searchText, allGames, currentGameId);

  // Если нет похожих игр - скрываем попап
  if (!similarGames || similarGames.length === 0) {
    hideDuplicatePopup();
    return;
  }

  // Обновляем содержимое попапа
  duplicatePopup.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "duplicate-list";

  similarGames.forEach((game) => {
    const listItem = document.createElement("li");
    listItem.className = "duplicate-list-item";

    // Используем уже существующий шаблон для статуса
    const statusClass = statusClassFor(game.status);
    const statusText = getStatusTextRu(game.status).toUpperCase();

    listItem.innerHTML = `
      <span class="duplicate-game-name">${
        game.title || game.name || "Без названия"
      }</span>
      <span class="card-status-duplicate ${statusClass}">${statusText}</span>
    `;

    list.appendChild(listItem);
  });

  duplicatePopup.appendChild(list);

  // Показываем попап
  duplicatePopup.classList.add("active");

  // Убираем все инлайн-стили, чтобы работали CSS стили
  duplicatePopup.style = "";

  // Устанавливаем таймаут для автоматического скрытия (если нужно)
  duplicatePopupTimeout = setTimeout(() => {
    if (
      !duplicatePopup.matches(":hover") &&
      document.activeElement !== titleInput
    ) {
      hideDuplicatePopup();
    }
  }, 5000);
}

function hideDuplicatePopup() {
  if (duplicatePopup) {
    duplicatePopup.classList.remove("active");
    duplicatePopup.innerHTML = "";
    // Убираем инлайн-стили при скрытии
    duplicatePopup.style = "";
  }
  clearTimeout(duplicatePopupTimeout);
}

function lockForm(lock = true) {
  const overlay = document.getElementById("form-overlay");
  const formInputs = document.querySelectorAll(
    "#game-form input, #game-form textarea, #game-form select, #game-form button"
  );

  if (lock) {
    isSubmitting = true;
    if (overlay) overlay.style.display = "flex";
    formInputs.forEach((input) => (input.disabled = true));
  } else {
    isSubmitting = false;
    if (overlay) overlay.style.display = "none";
    formInputs.forEach((input) => (input.disabled = false));
  }
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ (EVENT HANDLERS) - ОБНОВЛЁННЫЙ
// ============================================
function attachHandlers() {
  document
    .getElementById("add-game-btn")
    .addEventListener("click", () => openForm());

  document.getElementById("modal-close").addEventListener("click", closeForm);
  document.getElementById("cancel-btn").addEventListener("click", closeForm);
  form.addEventListener("submit", onSubmit);

  screenshotInput.addEventListener("change", onScreenshotSelected);
  removeScreenshotBtn.addEventListener("click", onRemoveScreenshot);
  document
    .getElementById("upload-area")
    .addEventListener("click", () => screenshotInput.click());

  document.getElementById("view-close").addEventListener("click", closeView);
  document
    .getElementById("confirm-cancel")
    .addEventListener("click", closeConfirmModal);
  document
    .getElementById("confirm-delete")
    .addEventListener("click", onConfirmDelete);

  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    filterAndDisplay();
  });

  statusSelect.addEventListener("change", updateStatusSelectStyle);

  // Фильтры статистики
  document.querySelectorAll(".stat-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      currentFilter =
        currentFilter === filter || filter === "all" ? "all" : filter;
      updateStatsFilterUI();
      filterAndDisplay();
    });
  });

  // Обработчики для поля ввода названия - ОБНОВЛЁННЫЕ
  if (titleInput) {
    let inputTimeout;

    // Поиск при вводе (с задержкой)
    titleInput.addEventListener("input", (e) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        const gameId = document.getElementById("game-id").value;
        showDuplicatePopup(e.target.value, gameId || null);
      }, 300);
    });

    // Показ при фокусе
    titleInput.addEventListener("focus", (e) => {
      const gameId = document.getElementById("game-id").value;
      showDuplicatePopup(e.target.value, gameId || null);
    });

    // Скрытие при потере фокуса
    titleInput.addEventListener("blur", (e) => {
      setTimeout(() => {
        if (!duplicatePopup.matches(":hover")) {
          hideDuplicatePopup();
        }
      }, 200);
    });

    // Скрытие при нажатии Esc
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideDuplicatePopup();
      }
    });
  }

  // Скрытие попапа при клике вне его
  document.addEventListener("click", (e) => {
    if (duplicatePopup && duplicatePopup.classList.contains("active")) {
      if (!duplicatePopup.contains(e.target) && e.target !== titleInput) {
        hideDuplicatePopup();
      }
    }
  });

  // Скрытие попапа при скролле
  window.addEventListener("scroll", () => {
    if (duplicatePopup && duplicatePopup.classList.contains("active")) {
      hideDuplicatePopup();
    }
  });

  // Обработчик сортировки
  if (sortSelect) {
    // Устанавливаем текущее значение по умолчанию
    sortSelect.value = currentSort;

    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      filterAndDisplay();
    });
  }
}

// ============================================
// РАБОТА С ДАННЫМИ (DATA MANAGEMENT)
// ============================================
async function loadAndRender() {
  allGames = (await eel.load_games()()) || [];
  updateStatsNumbers();
  filterAndDisplay();
}

function filterAndDisplay() {
  let filtered = allGames.filter((game) => {
    const matchesFilter =
      currentFilter === "all" || game.status === currentFilter;
    const matchesSearch =
      !currentSearch ||
      (game.title || "").toLowerCase().includes(currentSearch);
    return matchesFilter && matchesSearch;
  });

  // Применяем сортировку
  filtered = sortGames(filtered);

  renderList(filtered);
}

// ============================================
// ФУНКЦИЯ СОРТИРОВКИ
// ============================================
function sortGames(games) {
  if (!games.length) return games;

  // Создаем копию массива для сортировки
  const sorted = [...games];

  switch (currentSort) {
    case "rating-desc":
      // По оценке (убывание)
      sorted.sort((a, b) => {
        const ratingA = parseFloat(a.rating) || 0;
        const ratingB = parseFloat(b.rating) || 0;

        // Сначала игры с рейтингом, затем без
        if (ratingA === 0 && ratingB === 0) return 0;
        if (ratingA === 0) return 1;
        if (ratingB === 0) return -1;

        return ratingB - ratingA;
      });
      break;

    case "title-asc":
      // По названию (А-Я)
      sorted.sort((a, b) => {
        const titleA = (a.title || "").toLowerCase();
        const titleB = (b.title || "").toLowerCase();
        return titleA.localeCompare(titleB);
      });
      break;

    case "added-desc":
      // По дате добавления (новые сверху)
      sorted.sort((a, b) => {
        const dateA = new Date(a.created_at || "1970-01-01").getTime();
        const dateB = new Date(b.created_at || "1970-01-01").getTime();
        return dateB - dateA;
      });
      break;

    case "added-asc":
    default: // По умолчанию - по дате обновления (новые сверху)
      sorted.sort((a, b) => {
        const dateA = new Date(
          a.updated_at || a.created_at || "1970-01-01"
        ).getTime();
        const dateB = new Date(
          b.updated_at || b.created_at || "1970-01-01"
        ).getTime();
        return dateB - dateA;
      });
      break;
  }

  return sorted;
}

// ============================================
// РЕНДЕРИНГ ИНТЕРФЕЙСА (UI RENDERING)
// ============================================
function renderList(games) {
  if (!games.length) {
    gamesListEl.innerHTML = '<div class="empty">Список пуст</div>';
    return;
  }

  gamesListEl.innerHTML = window.Templates.gameCards(games, {
    formatDateTime,
    statusClassFor,
    copyToClipboard,
    showView,
    openForm,
    openConfirmModal,
  });
}

// ============================================
// ФОРМАТИРОВАНИЕ (FORMATTERS)
// ============================================
function formatDateTime(dateString, returnOnlyDate = false) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (isNaN(date)) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  if (returnOnlyDate) {
    return `${day}/${month}/${year}`;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function statusClassFor(status) {
  const classes = {
    completed: "status-completed",
    playing: "status-playing",
    planned: "status-planned",
    dropped: "status-dropped",
  };
  return classes[status] || "";
}

// ============================================
// РАБОТА С ФОРМОЙ (FORM MANAGEMENT)
// ============================================
function openForm(game = null) {
  editingGame = game;

  // Убедимся, что форма разблокирована
  lockForm(false);

  // Скрываем попап при открытии формы
  hideDuplicatePopup();

  // Заполняем форму
  document.getElementById("game-id").value = game?.id || "";
  const titleInput = document.getElementById("title");
  titleInput.value = game?.title || "";

  document.getElementById("version").value = game?.version || "";
  document.getElementById("rating").value = game?.rating || 0;
  document.getElementById("status").value = game?.status || "planned";
  document.getElementById("review").value = game?.review || "";
  document.getElementById("game-link").value = game?.game_link || "";

  updateStatusSelectStyle();

  // Сброс скриншота
  unsavedScreenshotData = null;
  screenshotInput.value = "";
  screenshotPreview.classList.toggle("empty", !game?.screenshot_data);
  screenshotPreview.innerHTML = game?.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="preview" loading="lazy">`
    : "";
  removeScreenshotBtn.classList.toggle("hidden", !game?.screenshot_data);

  // Обновляем заголовок и кнопку
  document.getElementById("modal-title").textContent = game
    ? "Редактировать игру"
    : "Добавить игру";
  document.getElementById("save-btn").textContent = game
    ? "Обновить"
    : "Добавить";

  modal.setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

function closeForm() {
  modal.setAttribute("aria-hidden", "true");
  editingGame = null;
  unsavedScreenshotData = null;

  // Сбрасываем состояние формы
  setTimeout(() => {
    lockForm(false);
    hideDuplicatePopup();
  }, 300);

  updateBodyScroll();
}

function onScreenshotSelected(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    unsavedScreenshotData = ev.target.result;
    screenshotPreview.innerHTML = `<img src="${unsavedScreenshotData}" alt="preview">`;
    screenshotPreview.classList.remove("empty");
    removeScreenshotBtn.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function onRemoveScreenshot() {
  unsavedScreenshotData = "";
  screenshotPreview.innerHTML = "";
  screenshotPreview.classList.add("empty");
  screenshotInput.value = "";
  removeScreenshotBtn.classList.add("hidden");
}

async function onSubmit(e) {
  e.preventDefault();

  // Защита от повторной отправки
  if (isSubmitting) {
    console.log("Форма уже отправляется...");
    return;
  }

  const payload = {
    title: document.getElementById("title").value.trim(),
    version: document.getElementById("version").value.trim(),
    status: document.getElementById("status").value,
    rating: parseFloat(document.getElementById("rating").value) || 0,
    review: document.getElementById("review").value.trim(),
    game_link: document.getElementById("game-link").value.trim(),
  };

  if (!payload.title) {
    alert("Название обязательно");
    return;
  }

  try {
    // Блокируем форму с overlay
    lockForm(true);

    const gameId = document.getElementById("game-id").value;
    const screenshotArg =
      unsavedScreenshotData === null ? null : unsavedScreenshotData;

    const success = gameId
      ? await eel.update_game(parseInt(gameId), payload, screenshotArg)()
      : await eel.add_game(payload, unsavedScreenshotData || null)();

    if (success) {
      await loadAndRender();
      closeForm();
      showToast(
        gameId
          ? `Игра ${payload.title} обновлена`
          : `Игра ${payload.title} добавлена`
      );
    }
  } catch (err) {
    console.error(err);
    alert("Ошибка сохранения");
    // При ошибке разблокируем форму, но не закрываем
    lockForm(false);
  }
}

// ============================================
// ПРОСМОТР ИГРЫ (VIEW MODAL)
// ============================================
function showView(game) {
  const viewModal = document.getElementById("view-modal");

  document.getElementById("view-header-row").innerHTML = `
        <h3 class="view-title" title="${game.title || ""}">${
    game.title || "—"
  }</h3>
        <button class="view-copy-title" title="Копировать название" onclick="copyToClipboard('${(
          game.title || ""
        ).replace(/'/g, "\\'")}')">⧉</button>
    `;

  document.getElementById("view-rating").textContent =
    game.rating && Number(game.rating) > 0
      ? `★ ${Number(game.rating).toFixed(1)}`
      : "—";
  document.getElementById("view-version").textContent = `Версия: ${
    game.version || "—"
  }`;

  const statusEl = document.getElementById("view-status");
  statusEl.textContent = (game.status || "").toUpperCase();
  statusEl.className = "card-status " + statusClassFor(game.status);

  document.getElementById("view-review").textContent = game.review || "—";

  document.getElementById("view-image").innerHTML = game.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="${
        game.title || "screenshot"
      }" loading="lazy">`
    : '<div style="color:var(--muted)">Нет изображения</div>';

  const linkRow = document.getElementById("view-link-row");
  linkRow.innerHTML = game.game_link
    ? `<button class="btn small" onclick="copyToClipboard('${game.game_link.replace(
        /'/g,
        "\\'"
      )}')">Копировать ссылку</button>`
    : "";

  const createdEl = document.getElementById("view-created-at");
  const updatedEl = document.getElementById("view-updated-at");

  createdEl.textContent = `Создал: ${formatDateTime(game.created_at, false)}`;
  updatedEl.textContent = `Обновил: ${formatDateTime(game.updated_at, false)}`;

  document.getElementById("view-edit").onclick = () => {
    closeView();
    openForm(game);
  };
  document.getElementById("view-delete").onclick = () =>
    openConfirmModal(game.id);

  viewModal.setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

function closeView() {
  document.getElementById("view-modal").setAttribute("aria-hidden", "true");
  updateBodyScroll();
}

// ============================================
// ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ (DELETE CONFIRMATION)
// ============================================
function openConfirmModal(gameId) {
  selectedToDelete = gameId;
  document.getElementById("confirm-modal").setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

function closeConfirmModal() {
  document.getElementById("confirm-modal").setAttribute("aria-hidden", "true");
  selectedToDelete = null;
  updateBodyScroll();
}

async function onConfirmDelete() {
  if (!selectedToDelete) return;

  try {
    const success = await eel.delete_game(selectedToDelete)();
    if (success) {
      await loadAndRender();
      closeConfirmModal();
      closeView();
      showToast("Игра удалена");
    }
  } catch (e) {
    console.error(e);
    alert("Ошибка удаления");
  }
}

// ============================================
// УТИЛИТЫ (UTILITIES)
// ============================================
function copyToClipboard(text) {
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    showToast("Скопировано в буфер");
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed; top: 18px; right: 18px;
        background: rgba(0,0,0,0.8); padding: 12px 16px;
        border-radius: 8px; color: #fff; z-index: 200;
        font-size: 14px; font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        max-width: 300px; word-wrap: break-word;
        opacity: 0; transform: translateY(-20px);
        transition: all 0.3s ease;
    `;
  document.body.appendChild(toast);

  setTimeout(() => (toast.style.opacity = "1"), 10);
  setTimeout(() => (toast.style.opacity = "0"), 2000);
  setTimeout(() => toast.remove(), 2300);
}

function updateBodyScroll() {
  const isModalOpen =
    document.querySelectorAll('[aria-hidden="false"]').length > 0;
  document.body.classList.toggle("modal-open", isModalOpen);
}

function updateStatusSelectStyle() {
  const value = statusSelect.value;
  statusSelect.className = `status-select status-${value}`;
}

// ============================================
// СТАТИСТИКА (STATISTICS)
// ============================================
async function updateStatsNumbers() {
  const stats = await eel.get_statistics()();
  document.getElementById("total-games").textContent = stats.total_games || 0;
  document.getElementById("completed-games").textContent = stats.completed || 0;
  document.getElementById("playing-games").textContent = stats.playing || 0;
  document.getElementById("planned-games").textContent = stats.planned || 0;
  document.getElementById("dropped-games").textContent = stats.dropped || 0;
}

function updateStatsFilterUI() {
  document.querySelectorAll(".stat-item").forEach((btn) => {
    const filter = btn.dataset.filter;
    btn.classList.toggle(
      "active-filter",
      currentFilter === filter || (currentFilter === "all" && filter === "all")
    );
  });
}
