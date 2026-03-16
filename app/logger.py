# app/logger.py

import logging

# Конфигурируем логирование один раз при импорте
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)


def get_logger(name=None) -> logging.Logger:
    """
    Получает логгер с заданным именем или по умолчанию.
    """
    if name is None:
        name = "app"
    return logging.getLogger(name)


# Символ разделителя для логов
LOG_SEPARATOR = "─" * 60
