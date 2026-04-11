# app/logger.py

import logging


# Конфигурируем логирование один раз при импорте
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)

# Логируем в файл без ротации
file_handler = logging.FileHandler("app.log", encoding="utf-8")
file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
logging.getLogger().addHandler(file_handler)


def get_logger(name=None) -> logging.Logger:
    """
    Получает логгер с заданным именем или по умолчанию.
    """
    if name is None:
        name = "app"
    return logging.getLogger(name)

