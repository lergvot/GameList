// web/gameCard.js
(function () {
  // Создаем глобальный объект для хранения шаблонов
  window.Templates = window.Templates || {};

  // Функция экранирования для безопасности (предотвращение XSS)
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Основная функция для создания HTML карточек игр
  window.Templates.gameCards = function (games, helpers) {
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
              : "0",
          status: game.status || "planned",
          screenshot: game.screenshot_data || "",
          createdDate: helpers.formatDateTime(game.created_at, true),
          createdFull: helpers.formatDateTime(game.created_at, false),
          updatedDate: helpers.formatDateTime(game.updated_at, true),
          updatedFull: helpers.formatDateTime(game.updated_at, false),
          statusClass: helpers.statusClassFor(game.status),
        };

        // ВАЖНО: JSON.stringify для передачи объекта в onclick
        // экранируем кавычки для корректной работы в HTML
        const gameJson = JSON.stringify(game).replace(/"/g, "&quot;");

        return `
        <article class="game-card" data-id="${escapedGame.id}" 
                 onclick="showView(${gameJson})">
          <div class="card-image-block">
            <div class="card-rating">
              ${escapedGame.rating} ★
            </div>
            <div class="card-image">
              ${
                escapedGame.screenshot
                  ? `<img src="${escapedGame.screenshot}" alt="${escapedGame.title}" loading="lazy">`
                  : '<div style="color:var(--muted)">Нет изображения</div>'
              }
            </div>
          </div>
          
          <!-- Заголовок в первой строке -->
          <div class="card-main">
            <div class="card-title">
              <span class="card-title-text" title="${escapedGame.title}">
                ${escapedGame.title || "—"}
              </span>
              <button class="copy-title" title="Копировать название" 
                onclick="event.stopPropagation(); copyToClipboard('${escapedGame.title.replace(
                  /'/g,
                  "\\'"
                )}')">
                ⧉
              </button>
            </div>
          </div>
          
          <!-- Статус в первой строке -->
          <div class="card-side">
            <div class="card-status-wrapper">
              <div class="card-status ${escapedGame.statusClass}">
                ${escapedGame.status.toUpperCase()}
              </div>
            </div>
          </div>
          
          <!-- Контент во второй строке -->
          <div class="card-content">
            <div class="card-version">Версия: ${
              escapedGame.version || "—"
            }</div>
            <div class="card-review">${escapedGame.review}</div>
          </div>
          
          <!-- Кнопки действий во второй строке -->
          <div class="card-bottom-actions">
            ${
              escapedGame.gameLink
                ? `
              <div class="card-link-btn">
                <button class="btn small" 
                  onclick="event.stopPropagation(); copyToClipboard('${escapedGame.gameLink.replace(
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
              <span title="${escapedGame.createdFull}">
                Создал: ${escapedGame.createdDate}
              </span>
              <span title="${escapedGame.updatedFull}">
                Обновил: ${escapedGame.updatedDate}
              </span>
            </div>
            
            <div class="card-actions">
              <button class="btn small" title="Редактировать" 
                onclick="event.stopPropagation(); openForm(${gameJson})">
                ✎
              </button>
              <button class="btn small" title="Удалить" 
                onclick="event.stopPropagation(); openConfirmModal(${game.id})">
                🗑
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
  };
})();
