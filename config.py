# config.py
"""
Конфигурационный файл приложения.
"""

# Версия приложения
APP_VERSION = "1.13.0"

# Название приложения
APP_NAME = "GameList"

# Размер окна приложения (ширина, высота)
WINDOW_SIZE = (1280, 720)

# Позиция окна при запуске (x, y)
WINDOW_POSITION = (100, 100)

# Настройки для сборки
BUILD_CONFIG = {
    # Имя для EXE файла
    "exe_name": "GameList",
    # Путь к иконке (относительно корня проекта)
    "icon_path": "web/favicon.ico",
    # Для release сборки - префикс архивов
    "release_prefix": "GameList",
}
