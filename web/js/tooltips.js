// tooltips.js
// Глобальная система управления тултипами

class TooltipManager {
  constructor() {
    this.tooltip = null;
    this.currentElement = null;
    this.showTimeout = null;
    this.hideTimeout = null;
    this.delay = 500; // Задержка перед показом в миллисекундах
    this.init();
  }

  init() {
    // Создаем контейнер для тулпипа
    this.tooltip = document.createElement("div");
    this.tooltip.className = "global-tooltip";
    document.body.appendChild(this.tooltip);

    // Назначаем обработчики для всех элементов с data-tooltip
    this.bindEvents();
  }

  bindEvents() {
    // Используем делегирование событий
    document.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[data-tooltip]");

      // Если курсор переместился на другой элемент, очищаем предыдущие таймеры
      if (target && target !== this.currentElement) {
        this.clearTimeouts();
        this.currentElement = target;

        // Устанавливаем таймер для показа тултипа
        this.showTimeout = setTimeout(() => {
          this.showTooltip(target);
        }, this.delay);
      }
    });

    document.addEventListener("mouseout", (e) => {
      if (
        this.currentElement &&
        !this.currentElement.contains(e.relatedTarget) &&
        e.relatedTarget !== this.tooltip
      ) {
        this.clearTimeouts();

        // Устанавливаем таймер для скрытия тултипа
        this.hideTimeout = setTimeout(() => {
          this.hideTooltip();
          this.currentElement = null;
        }, 150); // Небольшая задержка перед скрытием для плавности
      }
    });

    // Скрываем тултип при клике
    document.addEventListener("click", () => {
      this.clearTimeouts();
      this.hideTooltip();
      this.currentElement = null;
    });

    // Скрываем тултип при скролле
    document.addEventListener(
      "scroll",
      () => {
        this.clearTimeouts();
        this.hideTooltip();
        this.currentElement = null;
      },
      true
    );

    // Показать тултип при долгом наведении на сам тултип
    this.tooltip.addEventListener("mouseover", () => {
      this.clearTimeouts();
    });

    this.tooltip.addEventListener("mouseout", (e) => {
      if (!this.currentElement?.contains(e.relatedTarget)) {
        this.clearTimeouts();
        this.hideTimeout = setTimeout(() => {
          this.hideTooltip();
          this.currentElement = null;
        }, 150);
      }
    });
  }

  clearTimeouts() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  showTooltip(element) {
    const text = element.getAttribute("data-tooltip");
    if (!text) return;

    // Проверка для заголовков: не показывать тултип для короткого текста
    const isTitleElement =
      element.classList.contains("game-card__title") ||
      element.classList.contains("view__title");

    if (isTitleElement) {
      // Проверяем, переполнен ли текст (обрезан ли ellipsis)
      const isTextOverflowed = element.scrollWidth > element.clientWidth + 1;
      // Для view__title также проверяем вертикальное переполнение (многострочный текст)
      const isHeightOverflowed =
        element.classList.contains("view__title") &&
        element.scrollHeight > element.clientHeight + 1;

      // Не показывать тултип если текст полностью виден
      if (!isTextOverflowed && !isHeightOverflowed) {
        return;
      }
    }

    this.tooltip.textContent = text;
    this.tooltip.classList.add("global-tooltip--visible");

    // Получаем позицию элемента
    const rect = element.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    // Определяем позицию (по умолчанию - сверху)
    let top = rect.top - tooltipRect.height - 5;
    let left = rect.left + (rect.width - tooltipRect.width) / 2;

    // Корректируем позицию, если тултип выходит за границы экрана
    if (top < 0) {
      top = rect.bottom + 5; // Показываем снизу
    }

    if (left < 0) {
      left = 5;
    } else if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 5;
    }

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  hideTooltip() {
    this.tooltip.classList.remove("global-tooltip--visible");
  }

  // Метод для изменения задержки при необходимости
  setDelay(ms) {
    this.delay = ms;
  }
}

// Инициализируем при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  window.tooltipManager = new TooltipManager();

  // Можно изменить задержку (по умолчанию 500мс)
  // window.tooltipManager.setDelay(800);
});

// Экспортируем для использования в других модулях
export default TooltipManager;
