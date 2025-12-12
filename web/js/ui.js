// web/ui.js
import {
  api,
  escapeHtml,
  formatDateTime,
  statusClassFor,
  findSimilarGames,
  getStatusText,
} from "./api.js";
import { t } from "./localisation.js";

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

function renderGameCards(games, helpers) {
  if (!games.length) {
    return `<div class="empty">${t("empty_list")}</div>`;
  }

  return games
    .map((game) => {
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
        statusText: t(`status_${game.status}_display`),
      };

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
                    data-tooltip="${t("copy_title_tooltip")}">
              ⧉
            </button>
          </div>
          
          <div class="game-card__content">
            <div class="game-card__version">${t("version_label")}: ${
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
              <div class="game-card__date" data-tooltip="${
                t("created_label") + ": " + escapedGame.createdFull
              }">
                <span>${t("created_label")}:</span>
                <span>${escapedGame.createdDate}</span>
              </div>

              <div class="game-card__date" data-tooltip="${
                t("updated_label") + ": " + escapedGame.updatedFull
              }">
                <span>${t("updated_label")}:</span>
                <span>${escapedGame.updatedDate}</span>
              </div>
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
                      aria-label="${t("copy_link_tooltip")}"
                      data-tooltip="${t("copy_link_tooltip")}">
                      🡵
                    </button>
                  `
                  : ""
              }
              <button class="btn btn--icon" 
                onclick="event.stopPropagation(); app.openForm(${gameJson})"
                aria-label="${t("edit_tooltip")}"
                data-tooltip="${t("edit_tooltip")}">
                ✎
              </button>
              <button class="btn btn--icon btn--danger" 
                onclick="event.stopPropagation(); app.openConfirmModal(${
                  game.id
                })"
                aria-label="${t("delete_tooltip")}"
                data-tooltip="${t("delete_tooltip")}">
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

export function renderGameList(games, state) {
  if (!gamesListEl) return;

  if (!games.length) {
    gamesListEl.innerHTML = `<div class="empty">${t("empty_list")}</div>`;
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

  const sorted = [...games];

  switch (sortType) {
    case "rating-desc":
      sorted.sort((a, b) => {
        const ratingA = parseFloat(a.rating) || 0;
        const ratingB = parseFloat(b.rating) || 0;

        if (ratingA === 0 && ratingB === 0) return 0;
        if (ratingA === 0) return 1;
        if (ratingB === 0) return -1;

        return ratingB - ratingA;
      });
      break;

    case "title-asc":
      sorted.sort((a, b) => {
        const titleA = (a.title || "").toLowerCase();
        const titleB = (b.title || "").toLowerCase();
        return titleA.localeCompare(titleB);
      });
      break;

    case "added-desc":
      sorted.sort((a, b) => {
        const dateA = new Date(a.created_at || "1970-01-01").getTime();
        const dateB = new Date(b.created_at || "1970-01-01").getTime();
        return dateB - dateA;
      });
      break;

    case "added-asc":
    default:
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

export function openForm(state, game = null) {
  if (!modal) return;

  state.editingGame = game;
  lockForm(false, state);
  hideDuplicatePopup();

  document.getElementById("game-id").value = game?.id || "";
  const titleInput = document.getElementById("title");
  titleInput.value = game?.title || "";

  document.getElementById("version").value = game?.version || "";
  document.getElementById("rating").value = game?.rating || 0;
  document.getElementById("status").value = game?.status || "planned";
  document.getElementById("review").value = game?.review || "";
  document.getElementById("game-link").value = game?.game_link || "";

  updateStatusSelectStyle();

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

  document.getElementById("modal-title").textContent = game
    ? t("edit_game_modal_title")
    : t("add_game_modal_title");
  document.getElementById("save-btn").textContent = game
    ? t("update_button")
    : t("save_button");

  modal.setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

export function closeForm(state) {
  if (!modal) return;

  modal.setAttribute("aria-hidden", "true");
  state.editingGame = null;
  state.unsavedScreenshotData = null;

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
  viewTitleEl.title = "";
  viewTitleEl.setAttribute("data-tooltip", game.title || "");

  document.getElementById("view-rating").textContent =
    game.rating && Number(game.rating) > 0
      ? `★ ${Number(game.rating).toFixed(1)}`
      : "—";

  document.getElementById("view-version").textContent = `${t(
    "version_label"
  )}: ${game.version || "—"}`;

  const statusEl = document.getElementById("view-status");
  statusEl.textContent = getStatusText(game.status).toUpperCase();
  statusEl.className = `status-badge status-badge--${game.status}`;

  document.getElementById("view-review").textContent = game.review || "—";

  document.getElementById("view-image").innerHTML = game.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="${
        game.title || "screenshot"
      }" loading="lazy">`
    : `<div class="view__image-placeholder">${t("no_image")}</div>`;

  const createdEl = document.getElementById("view-created-at");
  const updatedEl = document.getElementById("view-updated-at");

  const createdSpans = createdEl.querySelectorAll("span");
  const updatedSpans = updatedEl.querySelectorAll("span");

  if (createdSpans.length >= 2) {
    createdSpans[0].textContent = `${t("created_label")}:`;
    createdSpans[1].textContent = formatDateTime(game.created_at, false);
    createdEl.title = formatDateTime(game.created_at, false);
  }
  if (updatedSpans.length >= 2) {
    updatedSpans[0].textContent = `${t("updated_label")}:`;
    updatedSpans[1].textContent = formatDateTime(game.updated_at, false);
    updatedEl.title = formatDateTime(game.updated_at, false);
  }

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
      showToast(t("game_deleted"));
    }
  } catch (e) {
    console.error(e);
    alert(t("delete_error"));
  }
}

export function copyToClipboard(text) {
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    showToast(t("copied_to_clipboard"));
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

let duplicatePopupTimeout = null;

export function showDuplicatePopup(state, searchText, currentGameId = null) {
  if (!duplicatePopup || !titleInput) return;

  clearTimeout(duplicatePopupTimeout);

  if (!searchText || searchText.trim().length < 2) {
    hideDuplicatePopup();
    return;
  }

  const similarGames = findSimilarGames(
    searchText,
    state.allGames,
    currentGameId
  );

  if (!similarGames || similarGames.length === 0) {
    hideDuplicatePopup();
    return;
  }

  duplicatePopup.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "duplicate-popup__list";

  similarGames.forEach((game) => {
    const listItem = document.createElement("li");
    listItem.className = "duplicate-popup__item";

    const statusClass = `status-badge--${game.status}`;
    const statusText = getStatusText(game.status).toUpperCase();

    listItem.innerHTML = `
      <span class="duplicate-popup__name">${
        game.title || game.name || t("no_title")
      }</span>
      <span class="status-badge ${statusClass}">${statusText}</span>
    `;

    list.appendChild(listItem);
  });

  duplicatePopup.appendChild(list);

  const titleRect = titleInput.getBoundingClientRect();
  const popupWidth = 320;

  duplicatePopup.style.position = "fixed";
  duplicatePopup.style.top = `${titleRect.bottom + window.scrollY + 5}px`;
  duplicatePopup.style.left = `${titleRect.left + window.scrollX}px`;
  duplicatePopup.style.width = `${Math.max(titleRect.width, popupWidth)}px`;

  duplicatePopup.classList.add("duplicate-popup--active");

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

export function setupEventHandlers(state) {
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

  searchInput.addEventListener("input", (e) => {
    state.currentSearch = e.target.value.trim().toLowerCase();
    filterAndDisplay(state);
  });

  statusSelect.addEventListener("change", updateStatusSelectStyle);

  document.querySelectorAll(".stats__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      state.currentFilter = filter;
      updateStatsFilterUI(state);
      filterAndDisplay(state);
    });
  });

  if (titleInput) {
    let inputTimeout;

    titleInput.addEventListener("input", (e) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        const gameId = document.getElementById("game-id").value;
        showDuplicatePopup(state, e.target.value, gameId || null);
      }, 300);
    });

    titleInput.addEventListener("focus", (e) => {
      const gameId = document.getElementById("game-id").value;
      showDuplicatePopup(state, e.target.value, gameId || null);
    });

    titleInput.addEventListener("blur", () => {
      setTimeout(() => {
        if (duplicatePopup && !duplicatePopup.matches(":hover")) {
          hideDuplicatePopup();
        }
      }, 200);
    });

    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideDuplicatePopup();
      }
    });
  }

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

  if (sortSelect) {
    sortSelect.value = state.currentSort;
    sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      filterAndDisplay(state);
    });
  }
}

function lockForm(lock = true, state) {
  const overlay = document.getElementById("form-overlay");
  const formInputs = document.querySelectorAll(
    "#game-form input, #game-form textarea, #game-form select, #game-form button"
  );

  if (lock) {
    state.isSubmitting = true;
    if (overlay) {
      overlay.style.display = "flex";
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
    alert(t("title_required"));
    return;
  }

  try {
    lockForm(true, state);

    const overlayText = document.querySelector("#form-overlay p");
    if (overlayText) {
      overlayText.textContent = t("saving");
    }

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
          ? t("game_updated", { title: payload.title })
          : t("game_added", { title: payload.title })
      );
    }
  } catch (err) {
    console.error(err);
    alert(t("save_error"));
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

  statusSelect.classList.remove(
    "form__select--playing",
    "form__select--planned",
    "form__select--completed",
    "form__select--dropped"
  );

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
