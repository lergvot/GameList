# app/logger.py

import logging
from logging.handlers import RotatingFileHandler

from config import LOG_MAX_BYTES

# Конфигурируем логирование один раз при импорте
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)

class _LoggingRotatingFileHandler(RotatingFileHandler):
    """RotatingFileHandler с логированием события ротации."""

    def doRollover(self):
        # Записываем предупреждение в старый файл до ротации
        with open(self.baseFilename, "a", encoding="utf-8") as f:
            f.write(f"--- Лог-файл достиг лимита в {LOG_MAX_BYTES} байт, выполняется ротация ---\n")
        super().doRollover()
        # Записываем в новый файл
        with open(self.baseFilename, "w", encoding="utf-8") as f:
            f.write(f"--- Новый лог-файл создан: {self.baseFilename} ---\n")


# Логируем в файл с ротацией (перезапись при достижении лимита)
file_handler = _LoggingRotatingFileHandler(
    "app.log", maxBytes=LOG_MAX_BYTES, backupCount=1, encoding="utf-8"
)
file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s"))
logging.getLogger().addHandler(file_handler)


def get_logger(name=None) -> logging.Logger:
    """
    Получает логгер с заданным именем или по умолчанию.
    """
    if name is None:
        name = "app"
    return logging.getLogger(name)

