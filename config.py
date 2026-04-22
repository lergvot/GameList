# config.py
"""
Конфигурационный файл приложения.
"""
from pathlib import Path

# Конфигурация приложения GameList
APP_VERSION = "1.17.0"
APP_NAME = "GameList"
WINDOW_SIZE = (1280, 720) # Размер окна приложения (ширина, высота)
WINDOW_POSITION = (100, 100) # Позиция окна при запуске (x, y)

# Настройки для сборки
BUILD_CONFIG = {
    "exe_name": "GameList", # Имя для EXE файла
    "icon_path": "web/favicon.ico", # Путь к иконке (относительно корня проекта)
    "release_prefix": "GameList", # Для release сборки - префикс архивов
}

# Пути к данным
DATA_DIR = Path("data")
DB_FILE = DATA_DIR / "app.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"

# Настройки базы данных
DB_TIMEOUT = 5  # таймаут подключения к БД (секунды)

# Настройки оптимизации изображений
IMAGE_MAX_WIDTH = 1920
IMAGE_QUALITY = 85

# Настройки проверки порта
PORT_START = 8000
PORT_RANGE = 25  # количество портов для проверки

# Настройки репозитория
GITHUB_API_URL = "https://api.github.com/repos/lergvot/GameList/releases/latest"

# Настройки логирования
LOG_SEPARATOR = "─" * 60 # Разделителя для логов