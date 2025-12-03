// web/app.js
let allGames = [];
let currentFilter = "all";
let currentSearch = "";
let selectedToDelete = null;
let unsavedScreenshotData = null;
let editingGame = null;

// DOM элементы
const gamesListEl = document.getElementById("games-list");
const modal = document.getElementById("game-modal");
const form = document.getElementById("game-form");
const screenshotInput = document.getElementById("screenshot");
const screenshotPreview = document.getElementById("screenshot-preview");
const removeScreenshotBtn = document.getElementById("remove-screenshot");
const searchInput = document.getElementById("search");
const statusSelect = document.getElementById("status");

// Инициализация
document.addEventListener("DOMContentLoaded", async () => {
  attachHandlers();
  await loadAndRender();
});

// Обработчики событий
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
}

// Обновление стиля выпадающего списка
function updateStatusSelectStyle() {
  const value = statusSelect.value;
  statusSelect.className = `status-select status-${value}`;
}

// Загрузка данных
async function loadAndRender() {
  allGames = (await eel.load_games()()) || [];
  updateStatsNumbers();
  filterAndDisplay();
}

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

// Фильтрация и отображение
function filterAndDisplay() {
  let filtered = allGames.filter((game) => {
    const matchesFilter =
      currentFilter === "all" || game.status === currentFilter;
    const matchesSearch =
      !currentSearch ||
      (game.title || "").toLowerCase().includes(currentSearch);
    return matchesFilter && matchesSearch;
  });

  // Сортировка: с рейтингом вначале, по убыванию рейтинга
  const rated = filtered.filter((g) => g.rating && Number(g.rating) > 0);
  const unrated = filtered.filter((g) => !g.rating || Number(g.rating) <= 0);
  rated.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

  renderList([...rated, ...unrated]);
}

// Форматирование даты и времени (DD/MM/YYYY)
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

// Отрисовка карточек игр
function renderList(games) {
  if (!games.length) {
    gamesListEl.innerHTML = '<div class="empty">Список пуст</div>';
    return;
  }

  gamesListEl.innerHTML = games
    .map(
      (game) => `
        <article class="game-card" data-id="${
          game.id
        }" onclick="showView(${JSON.stringify(game).replace(/"/g, "&quot;")})">
            <div class="card-image-block">
                <div class="card-rating">
                    ${
                      game.rating && Number(game.rating) > 0
                        ? `${Number(game.rating).toFixed(1)} ★`
                        : "0 ★"
                    }
                </div>
                <div class="card-image">
                    ${
                      game.screenshot_data
                        ? `<img src="${game.screenshot_data}" alt="${
                            game.title || "screenshot"
                          }" loading="lazy">`
                        : '<div style="color:var(--muted)">Нет изображения</div>'
                    }
                </div>
            </div>
            
            <!-- Заголовок в первой строке -->
            <div class="card-main">
                <div class="card-title">
                    <span class="card-title-text" title="${game.title || ""}">${
        game.title || "—"
      }</span>
                    <button class="copy-title" title="Копировать название" onclick="event.stopPropagation(); copyToClipboard('${(
                      game.title || ""
                    ).replace(/'/g, "\\'")}')">⧉</button>
                </div>
            </div>
            
            <!-- Статус в первой строке -->
            <div class="card-side">
                <div class="card-status-wrapper">
                    <div class="card-status ${statusClassFor(game.status)}">${(
        game.status || ""
      ).toUpperCase()}</div>
                </div>
            </div>
            <!-- Контент во второй строке -->
            <div class="card-content">
                <div class="card-version">Версия: ${game.version || "—"}</div>
                <div class="card-review">${game.review || ""}</div>
            </div>
            
            <!-- Кнопки действий во второй строке -->
            <div class="card-bottom-actions">
                ${
                  game.game_link
                    ? `
                    <div class="card-link-btn">
                        <button class="btn small" onclick="event.stopPropagation(); copyToClipboard('${game.game_link.replace(
                          /'/g,
                          "\\'"
                        )}')">
                            Ссылка
                        </button>
                    </div>
                `
                    : ""
                }
                <div class="card-time-stamp">
                    <span title="${formatDateTime(game.created_at, false)}">
                        Создал: ${formatDateTime(game.created_at, true)}
                    </span>
                    <span title="${formatDateTime(game.updated_at, false)}">
                        Обновил: ${formatDateTime(game.updated_at, true)}
                    </span>
                </div>
                
                <div class="card-actions">
                    <button class="btn small" title="Редактировать" onclick="event.stopPropagation(); openForm(${JSON.stringify(
                      game
                    ).replace(/"/g, "&quot;")})">✎</button>
                    <button class="btn small" title="Удалить" onclick="event.stopPropagation(); openConfirmModal(${
                      game.id
                    })">🗑</button>
                </div>
            </div>
        </article>
    `
    )
    .join("");
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

// Утилиты
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

// Работа с формой
function openForm(game = null) {
  editingGame = game;

  // Заполняем форму
  document.getElementById("game-id").value = game?.id || "";
  document.getElementById("title").value = game?.title || "";
  document.getElementById("version").value = game?.version || "";
  document.getElementById("rating").value = game?.rating || 0;
  document.getElementById("status").value = game?.status || "planned";
  document.getElementById("review").value = game?.review || "";
  document.getElementById("game-link").value = game?.game_link || "";

  // Исправление: убраны несуществующие поля created-at и updated-at
  // Эти поля в форме не используются, они только в модальном окне просмотра

  updateStatusSelectStyle();

  // Сброс скриншота
  unsavedScreenshotData = null;
  screenshotInput.value = "";
  screenshotPreview.classList.toggle("empty", !game?.screenshot_data);
  screenshotPreview.innerHTML = game?.screenshot_data
    ? `<img src="${game.screenshot_data}" alt="preview" loading="lazy">`
    : "";
  removeScreenshotBtn.classList.toggle("hidden", !game?.screenshot_data);

  document.getElementById("modal-title").textContent = game
    ? "Редактировать игру"
    : "Добавить игру";
  modal.setAttribute("aria-hidden", "false");
  updateBodyScroll();
}

function closeForm() {
  modal.setAttribute("aria-hidden", "true");
  editingGame = null;
  unsavedScreenshotData = null;
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
  }
}

// Просмотр игры
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

  // Вывод дат в модальном окне просмотра
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

// Подтверждение удаления
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
