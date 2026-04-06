# config.py
"""
Конфигурационный файл приложения.
"""
from pathlib import Path

# Версия приложения
APP_VERSION = "1.15.2"

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

# Пути к данным
DATA_DIR = Path("data")
DB_FILE = DATA_DIR / "app.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"

# Настройки базы данных
DB_TIMEOUT = 10  # таймаут подключения к БД (секунды)

# Настройки оптимизации изображений
IMAGE_MAX_WIDTH = 1366
IMAGE_QUALITY = 85

# Настройки проверки порта
PORT_START = 8000
PORT_RANGE = 25  # количество портов для проверки

# Настройки репозитория
GITHUB_API_URL = "https://api.github.com/repos/lergvot/GameList/releases/latest"

# Настройки логирования
LOG_MAX_BYTES = 1 * 1024 * 1024  # 1 МБ на файл логов
LOG_SEPARATOR = "─" * 60 # Разделителя для логов