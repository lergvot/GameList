// web/ui.js
// Все UI операции: рендеринг, формы, модалки, обработчики

import {
  api,
  escapeHtml,
  formatDateTime,
  statusClassFor,
  findSimilarGames,
  getStatusTextRu,
} from "./api.js";

// ============================================
// ДОМ ЭЛЕМЕНТЫ (будут кэшированы при инициализации)
// ============================================
let gamesListEl,
  modal,
  form,
  screenshotInput,
  screenshotPreview,
  removeScreenshotBtn,
  searchInput,
  statusSelect,
  titleInput,
  duplicatePopup,
  sortSelect;

// ============================================
// ШАБЛОНЫ КАРТОЧЕК
// ============================================
function renderGameCards(games, helpers) {
  if (!games.length) {
    return '<div class="empty">Список пуст</div>';
  }

  return games
    .map((game) => {
      // Безопасное экранирование всех строк
      const escapedGame = {
        id: escapeHtml(game.id),
        title: escapeHtml(game.title || ""),
        version: escapeHtml(game.version || ""),
        review: escapeHtml(game.review || ""),
        gameLink: escapeHtml(game.game_link || ""),
        rating:
          game.rating && Number(game.rating) > 0
            ? Number(game.rating).toFixed(1)
            : "—",
        status: game.status || "planned",
        screenshot: game.screenshot_data || "",
        createdDate: formatDateTime(game.created_at, true),
        createdFull: formatDateTime(game.created_at, false),
        updatedDate: formatDateTime(game.updated_at, true),
        updatedFull: formatDateTime(game.updated_at, false),
        statusClass: `status-badge--${game.status}`,
        statusText: getStatusTextRu(game.status).toUpperCase(),
      };

      // JSON.stringify для передачи объекта в onclick
      const gameJson = JSON.stringify(game).replace(/"/g, "&quot;");

      return `
      <article class="game-card" data-id="${escapedGame.id}" 
               onclick="app.showView(${gameJson})">
        <div class="game-card__left">
          <div class="game-card__rating">
            ${
              escapedGame.rating !== "0" && escapedGame.rating !== "—"
                ? `${escapedGame.rating} ★`
                : "—"
            }
          </div>
        </div>
        
        <div class="game-card__main">
          <div class="game-card__header">
            <h3 class="game-card__title" data-tooltip="${escapedGame.title}">
              ${escapedGame.title || "—"}
            </h3>
            <button class="game-card__copy" 
                    onclick="event.stopPropagation(); app.copyToClipboard('${escapedGame.title.replace(
                      /'/g,
                      "\\'"
                    )}')"
                    data-tooltip="Копировать название">
              ⧉
            </button>
          </div>
          
          <div class="game-card__content">
            <div class="game-card__version">Версия: ${
              escapedGame.version || "—"
            }</div>
            <div class="game-card__review">${escapedGame.review}</div>
          </div>
        </div>
        
        <div class="game-card__right">
          <div class="game-card__status-wrapper">
            <div class="status-badge ${escapedGame.statusClass}">
              ${escapedGame.statusText}
            </div>
          </div>
          
          <div class="game-card__meta">
            <div class="game-card__dates">
              <span class="game-card__date" data-tooltip="${
                "Создано: " + escapedGame.createdFull
              }">
                Создано: ${escapedGame.createdDate}
              </span>
              <span class="game-card__date" data-tooltip="${
                "Обновлено: " + escapedGame.updatedFull
              }">
                Обновлено: ${escapedGame.updatedDate}
              </span>
            </div>
            
            <div class="game-card__actions">
              ${
                escapedGame.gameLink
                  ? `
                    <button class="btn btn--icon" 
                      onclick="event.stopPropagation(); app.copyToClipboard('${escapedGame.gameLink.replace(
                        /'/g,
                        "\\'"
                      )}')"
                      aria-label="Копировать ссылку"
                      data-tooltip="Копировать ссылку">
                      🡵
                    </button>
                  `
                  : ""
              }
              <button class="btn btn--icon" 
                onclick="event.stopPropagation(); app.openForm(${gameJson})"
                aria-label="Редактировать"
                data-tooltip="Редактировать">
                ✎
              </button>
              <button class="btn btn--icon btn--danger" 
                onclick="event.stopPropagation(); app.openConfirmModal(${
                  game.id
                })"
                aria-label="Удалить"
                data-tooltip="Удалить">
                🗑
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
}

// ============================================
// РЕНДЕРИНГ И ФИЛЬТРАЦИЯ
// ============================================
export function renderGameList(games, state) {
  if (!gamesListEl) return;

  if (!games.length) {
    gamesListEl.innerHTML = '<div class="empty">Список пуст</div>';
    return;
  }

  gamesListEl.innerHTML = renderGameCards(games, {
    formatDateTime,
    statusClassFor,
    copyToClipboard,
    showView,
    openForm: (game) => openForm(state, game),
    openConfirmModal: (id) => openConfirmModal(state, id),
  });
}

export function filterGames(state) {
  if (!state.allGames) return [];

  return state.allGames.filter((game) => {
    const matchesFilter =
      state.currentFilter === "all" || game.status === state.currentFilter;
    const matchesSearch =
      !state.currentSearch ||
      (game.title || "").toLowerCase().includes(state.currentSearch);
    return matchesFilter && matchesSearch;
  });
}

export function sortGames(games, sortType) {
  if (!games.length) return games;

  // Создаем копию массива для сортировки
  const sorted = [...games];

  switch (sortType) {
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
// ФОРМЫ И МОДАЛКИ
// ============================================
export function openForm(state, game = null) {
  if (!modal) return;

  state.editingGame = game;

  // Убедимся, что форма разблокирована
  lockForm(false, state);

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
  state.unsavedScreenshotData = null;
  screenshotInput.value = "";
  const isScreenshotEmpty = !game?.screenshot_data;
  screenshotPreview.classList.toggle(
    "upload-area__preview--empty",
    isScreenshotEmpty
  );
  screenshotPreview.innerHTML = game?.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="preview" loading="lazy">`
    : "";
  removeScreenshotBtn.classList.toggle("hidden", isScreenshotEmpty);

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

export function closeForm(state) {
  if (!modal) return;

  modal.setAttribute("aria-hidden", "true");
  state.editingGame = null;
  state.unsavedScreenshotData = null;

  // Сбрасываем состояние формы
  setTimeout(() => {
    lockForm(false, state);
    hideDuplicatePopup();
  }, 300);

  updateBodyScroll();
}

export function showView(game) {
  const viewModal = document.getElementById("view-modal");
  if (!viewModal) return;

  const viewTitleEl = document.getElementById("view-title");
  viewTitleEl.textContent = game.title || "—";
  // Убираем браузерный тултип, оставляем только кастомный
  viewTitleEl.title = "";
  viewTitleEl.setAttribute("data-tooltip", game.title || "");

  document.getElementById("view-rating").textContent =
    game.rating && Number(game.rating) > 0
      ? `★ ${Number(game.rating).toFixed(1)}`
      : "—";
  document.getElementById("view-version").textContent = `Версия: ${
    game.version || "—"
  }`;

  const statusEl = document.getElementById("view-status");
  statusEl.textContent = getStatusTextRu(game.status).toUpperCase();
  statusEl.className = `status-badge status-badge--${game.status}`;

  document.getElementById("view-review").textContent = game.review || "—";

  document.getElementById("view-image").innerHTML = game.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="${
        game.title || "screenshot"
      }" loading="lazy">`
    : '<div class="view__image-placeholder">Нет изображения</div>';

  const createdEl = document.getElementById("view-created-at");
  const updatedEl = document.getElementById("view-updated-at");

  createdEl.textContent = `Создано: ${formatDateTime(game.created_at, false)}`;
  createdEl.title = formatDateTime(game.created_at, false);
  updatedEl.textContent = `Обновлено: ${formatDateTime(
    game.updated_at,
    false
  )}`;
  updatedEl.title = formatDateTime(game.updated_at, false);

  document.getElementById("view-edit").onclick = () => {
    closeView();
    app.openForm(game);
  };

  document.getElementById("view-copy-title").onclick = () =>
    app.copyToClipboard(game.title || "");

  document.getElementById("view-delete").onclick = () =>
    app.openConfirmModal(game.id);

  viewModal.setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

export function closeView() {
  const viewModal = document.getElementById("view-modal");
  if (viewModal) {
    viewModal.setAttribute("aria-hidden", "true");
    updateBodyScroll();
  }
}

// ============================================
// ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
// ============================================
export function openConfirmModal(state, gameId) {
  state.selectedToDelete = gameId;
  const confirmModal = document.getElementById("confirm-modal");
  if (confirmModal) {
    confirmModal.setAttribute("aria-hidden", "false");
    updateBodyScroll();
  }
}

export function closeConfirmModal(state) {
  const confirmModal = document.getElementById("confirm-modal");
  if (confirmModal) {
    confirmModal.setAttribute("aria-hidden", "true");
    state.selectedToDelete = null;
    updateBodyScroll();
  }
}

export async function onConfirmDelete(state) {
  if (!state.selectedToDelete) return;

  try {
    const success = await api.deleteGame(state.selectedToDelete);
    if (success) {
      await app.loadAndRender(state);
      closeConfirmModal(state);
      closeView();
      showToast("Игра удалена");
    }
  } catch (e) {
    console.error(e);
    alert("Ошибка удаления");
  }
}

// ============================================
// УТИЛИТЫ UI
// ============================================
export function copyToClipboard(text) {
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    showToast("Скопировано в буфер");
  });
}

export function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "toast";
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast--visible"), 10);
  setTimeout(() => toast.classList.remove("toast--visible"), 2000);
  setTimeout(() => toast.remove(), 2300);
}

export function updateStats(stats) {
  const totalEl = document.getElementById("total-games");
  const completedEl = document.getElementById("completed-games");
  const playingEl = document.getElementById("playing-games");
  const plannedEl = document.getElementById("planned-games");
  const droppedEl = document.getElementById("dropped-games");

  if (totalEl) totalEl.textContent = stats.total_games || 0;
  if (completedEl) completedEl.textContent = stats.completed || 0;
  if (playingEl) playingEl.textContent = stats.playing || 0;
  if (plannedEl) plannedEl.textContent = stats.planned || 0;
  if (droppedEl) droppedEl.textContent = stats.dropped || 0;
}

// ============================================
// ДУБЛИКАТЫ И ПОПАПЫ
// ============================================
let duplicatePopupTimeout = null;

export function showDuplicatePopup(state, searchText, currentGameId = null) {
  if (!duplicatePopup || !titleInput) return;

  // Очищаем предыдущий таймаут
  clearTimeout(duplicatePopupTimeout);

  // Если поле пустое или слишком короткое - скрываем попап
  if (!searchText || searchText.trim().length < 2) {
    hideDuplicatePopup();
    return;
  }

  // Ищем похожие игры
  const similarGames = findSimilarGames(
    searchText,
    state.allGames,
    currentGameId
  );

  // Если нет похожих игр - скрываем попап
  if (!similarGames || similarGames.length === 0) {
    hideDuplicatePopup();
    return;
  }

  // Обновляем содержимое попапа
  duplicatePopup.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "duplicate-popup__list";

  similarGames.forEach((game) => {
    const listItem = document.createElement("li");
    listItem.className = "duplicate-popup__item";

    const statusClass = `status-badge--${game.status}`;
    const statusText = getStatusTextRu(game.status).toUpperCase();

    listItem.innerHTML = `
      <span class="duplicate-popup__name">${
        game.title || game.name || "Без названия"
      }</span>
      <span class="status-badge ${statusClass}">${statusText}</span>
    `;

    list.appendChild(listItem);
  });

  duplicatePopup.appendChild(list);

  // Позиционирование попапа относительно поля ввода
  const titleRect = titleInput.getBoundingClientRect();
  const popupWidth = 320; // Фиксированная ширина попапа

  duplicatePopup.style.position = "fixed";
  duplicatePopup.style.top = `${titleRect.bottom + window.scrollY + 5}px`;
  duplicatePopup.style.left = `${titleRect.left + window.scrollX}px`;
  duplicatePopup.style.width = `${Math.max(titleRect.width, popupWidth)}px`;

  // Показываем попап
  duplicatePopup.classList.add("duplicate-popup--active");

  // Устанавливаем таймаут для автоматического скрытия
  duplicatePopupTimeout = setTimeout(() => {
    if (
      !duplicatePopup.matches(":hover") &&
      document.activeElement !== titleInput
    ) {
      hideDuplicatePopup();
    }
  }, 5000);
}

export function hideDuplicatePopup() {
  if (duplicatePopup) {
    duplicatePopup.classList.remove("duplicate-popup--active");
    duplicatePopup.innerHTML = "";
    duplicatePopup.style = "";
  }
  clearTimeout(duplicatePopupTimeout);
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
export function setupEventHandlers(state) {
  // Кэшируем DOM элементы
  gamesListEl = document.getElementById("games-list");
  modal = document.getElementById("game-modal");
  form = document.getElementById("game-form");
  screenshotInput = document.getElementById("screenshot");
  screenshotPreview = document.getElementById("screenshot-preview");
  removeScreenshotBtn = document.getElementById("remove-screenshot");
  searchInput = document.getElementById("search");
  statusSelect = document.getElementById("status");
  titleInput = document.getElementById("title");
  duplicatePopup = document.getElementById("duplicate-popup");
  sortSelect = document.getElementById("sort-select");

  // Основные обработчики
  document
    .getElementById("add-game-btn")
    .addEventListener("click", () => openForm(state));

  document
    .getElementById("modal-close")
    .addEventListener("click", () => closeForm(state));
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => closeForm(state));
  form.addEventListener("submit", (e) => onSubmit(e, state));

  screenshotInput.addEventListener("change", (e) =>
    onScreenshotSelected(e, state)
  );
  removeScreenshotBtn.addEventListener("click", () =>
    onRemoveScreenshot(state)
  );
  document
    .getElementById("upload-area")
    .addEventListener("click", () => screenshotInput.click());

  document.getElementById("view-close").addEventListener("click", closeView);
  document
    .getElementById("confirm-cancel")
    .addEventListener("click", () => closeConfirmModal(state));
  document
    .getElementById("confirm-delete")
    .addEventListener("click", () => onConfirmDelete(state));

  // Поиск
  searchInput.addEventListener("input", (e) => {
    state.currentSearch = e.target.value.trim().toLowerCase();
    filterAndDisplay(state);
  });

  statusSelect.addEventListener("change", updateStatusSelectStyle);

  // Фильтры статистики
  document.querySelectorAll(".stats__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      state.currentFilter = filter;
      updateStatsFilterUI(state);
      filterAndDisplay(state);
    });
  });

  // Обработчики для поля ввода названия
  if (titleInput) {
    let inputTimeout;

    // Поиск при вводе (с задержкой)
    titleInput.addEventListener("input", (e) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        const gameId = document.getElementById("game-id").value;
        showDuplicatePopup(state, e.target.value, gameId || null);
      }, 300);
    });

    // Показ при фокусе
    titleInput.addEventListener("focus", (e) => {
      const gameId = document.getElementById("game-id").value;
      showDuplicatePopup(state, e.target.value, gameId || null);
    });

    // Скрытие при потере фокуса
    titleInput.addEventListener("blur", () => {
      setTimeout(() => {
        if (duplicatePopup && !duplicatePopup.matches(":hover")) {
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
    if (
      duplicatePopup &&
      duplicatePopup.classList.contains("duplicate-popup--active")
    ) {
      if (!duplicatePopup.contains(e.target) && e.target !== titleInput) {
        hideDuplicatePopup();
      }
    }
  });

  // Обработчик сортировки
  if (sortSelect) {
    sortSelect.value = state.currentSort;
    sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      filterAndDisplay(state);
    });
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function lockForm(lock = true, state) {
  const overlay = document.getElementById("form-overlay");
  const formInputs = document.querySelectorAll(
    "#game-form input, #game-form textarea, #game-form select, #game-form button"
  );

  if (lock) {
    state.isSubmitting = true;
    if (overlay) {
      overlay.style.display = "flex";
      // Убедимся, что форма видна под overlay
      const formPanel = document.querySelector(".modal__panel--form");
      if (formPanel) {
        formPanel.style.position = "relative";
      }
    }
    formInputs.forEach((input) => (input.disabled = true));
  } else {
    state.isSubmitting = false;
    if (overlay) overlay.style.display = "none";
    formInputs.forEach((input) => (input.disabled = false));
  }
}

async function onSubmit(e, state) {
  e.preventDefault();

  // Защита от повторной отправки
  if (state.isSubmitting) {
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
    lockForm(true, state);

    const gameId = document.getElementById("game-id").value;
    const screenshotArg =
      state.unsavedScreenshotData === null ? null : state.unsavedScreenshotData;

    const success = gameId
      ? await api.updateGame(parseInt(gameId), payload, screenshotArg)
      : await api.addGame(payload, state.unsavedScreenshotData || null);

    if (success) {
      await app.loadAndRender(state);
      closeForm(state);
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
    lockForm(false, state);
  }
}

function onScreenshotSelected(e, state) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    state.unsavedScreenshotData = ev.target.result;
    screenshotPreview.innerHTML = `<img src="${state.unsavedScreenshotData}" alt="preview">`;
    screenshotPreview.classList.remove("upload-area__preview--empty");
    removeScreenshotBtn.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function onRemoveScreenshot(state) {
  state.unsavedScreenshotData = "";
  screenshotPreview.innerHTML = "";
  screenshotPreview.classList.add("upload-area__preview--empty");
  screenshotInput.value = "";
  removeScreenshotBtn.classList.add("hidden");
}

function updateStatusSelectStyle() {
  if (!statusSelect) return;
  const value = statusSelect.value;

  // Удаляем все возможные классы статусов
  statusSelect.classList.remove(
    "form__select--playing",
    "form__select--planned",
    "form__select--completed",
    "form__select--dropped"
  );

  // Добавляем нужный класс
  statusSelect.classList.add(`form__select--${value}`);
}

function updateStatsFilterUI(state) {
  document.querySelectorAll(".stats__item").forEach((btn) => {
    const filter = btn.dataset.filter;
    btn.classList.toggle("stats__item--active", state.currentFilter === filter);
  });
}

function updateBodyScroll() {
  const isModalOpen =
    document.querySelectorAll('[aria-hidden="false"]').length > 0;
  document.body.classList.toggle("modal-open", isModalOpen);
}

// Экспортируем функцию для фильтрации и отображения (используется в app.js)
export function filterAndDisplay(state) {
  const filtered = filterGames(state);
  const sorted = sortGames(filtered, state.currentSort);
  renderGameList(sorted, state);
}

export default {
  setupEventHandlers,
  showView,
  copyToClipboard,
  openForm,
  openConfirmModal,
  updateStats,
  showDuplicatePopup,
  hideDuplicatePopup,
  filterAndDisplay,
  showToast,
};
