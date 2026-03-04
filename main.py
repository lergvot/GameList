# main.py
import base64
import io
import logging
import os
import re
import socket
import sqlite3
import sys
from pathlib import Path

import eel
from PIL import Image

from config import (
    APP_NAME,
    APP_VERSION,
    DATA_DIR,
    DB_FILE,
    DB_TIMEOUT,
    SCREENSHOTS_DIR,
    IMAGE_MAX_WIDTH,
    IMAGE_QUALITY,
    PORT_RANGE,
    PORT_START,
    WINDOW_POSITION,
    WINDOW_SIZE,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Символ разделителя для логов
LOG_SEPARATOR = "─" * 60

eel.init("web")


def normalize_filename(name):
    """Нормализует имя файла для безопасности"""
    if not name:
        return "unknown"
    name = re.sub(r"[^\w\s\u0400-\u04FF-]", "_", name)
    return re.sub(r"_+", "_", name.replace(" ", "_"))[:100].strip("_")


def optimize_screenshot(image_data, max_width=IMAGE_MAX_WIDTH, quality=IMAGE_QUALITY):
    """Оптимизирует изображение в WebP, пропускает SVG"""
    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)

        # Проверяем, является ли изображение SVG (по первым байтам)
        if image_bytes.startswith(b"<?xml") or b"<svg" in image_bytes[:100]:
            logger.info("SVG image detected, skipping optimization")
            return image_data  # Возвращаем оригинал для SVG

        image = Image.open(io.BytesIO(image_bytes))

        # Конвертация в RGB если нужно
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(
                image, mask=image.split()[-1] if image.mode == "RGBA" else None
            )
            image = background

        # Ресайз если нужно
        original_size = (image.width, image.height)
        if image.width > max_width:
            ratio = max_width / image.width
            image = image.resize(
                (max_width, int(image.height * ratio)), Image.Resampling.LANCZOS
            )

        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, optimize=True)

        logger.info(
            f"Image optimized: {original_size[0]}x{original_size[1]} → {image.width}x{image.height}"
        )
        return base64.b64encode(output.getvalue()).decode("utf-8")
    except Exception as e:
        logger.error(f"Error optimizing image: {e}", exc_info=True)
        return image_data


def ensure_dirs():
    """Создает необходимые папки"""
    try:
        DATA_DIR.mkdir(exist_ok=True)
        SCREENSHOTS_DIR.mkdir(exist_ok=True)
        logger.debug(f"Directories checked/created: {DATA_DIR}, {SCREENSHOTS_DIR}")
    except OSError as e:
        logger.critical(f"Failed to create directories: {e}", exc_info=True)
        raise


def save_screenshot(image_data, game_id, game_title):
    """Сохраняет оптимизированный скриншот"""
    if not image_data:
        return ""

    try:
        optimized_data = optimize_screenshot(image_data)
        if "," in optimized_data:
            optimized_data = optimized_data.split(",", 1)[1]

        image_bytes = base64.b64decode(optimized_data)

        # Определяем расширение файла
        file_extension = ".webp"
        if image_bytes.startswith(b"<?xml") or b"<svg" in image_bytes[:100]:
            file_extension = ".svg"

        filename = f"{game_id}_{normalize_filename(game_title)}{file_extension}"
        filepath = SCREENSHOTS_DIR / filename

        with open(filepath, "wb") as f:
            f.write(image_bytes)

        logger.info(f"Screenshot saved: {filename} (ID: {game_id})")
        return str(filepath)
    except Exception as e:
        logger.error(f"Error saving screenshot for game {game_id}: {e}")
        return ""


def delete_screenshot(screenshot_path, game_id):
    """Удаляет файл скриншота"""
    if screenshot_path and os.path.exists(screenshot_path):
        try:
            os.remove(screenshot_path)
            logger.info(f"Screenshot deleted: {screenshot_path} (ID: {game_id})")
        except OSError as e:
            logger.warning(f"Error deleting screenshot {screenshot_path}: {e}")


# SQLite функции
def init_db():
    """Инициализирует базу данных"""
    ensure_dirs()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                version TEXT DEFAULT '',
                status TEXT DEFAULT 'planned',
                rating REAL DEFAULT 0,
                review TEXT DEFAULT '',
                game_link TEXT DEFAULT '',
                screenshot_path TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_status ON games(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_title ON games(title)")

        conn.commit()
        conn.close()
        logger.info("Database initialized successfully")
    except sqlite3.Error as e:
        logger.critical(f"Failed to initialize database: {e}", exc_info=True)
        raise RuntimeError(f"Database initialization failed: {e}")


def get_db_connection():
    """Создает соединение с БД"""
    try:
        return sqlite3.connect(str(DB_FILE), timeout=DB_TIMEOUT)
    except sqlite3.Error as e:
        logger.critical(f"Failed to connect to database: {e}", exc_info=True)
        raise RuntimeError(f"Cannot connect to database: {e}")


class DatabaseConnection:
    """Контекстный менеджер для работы с БД"""

    def __init__(self):
        self.conn = None

    def __enter__(self):
        self.conn = get_db_connection()
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.close()
        if exc_type is not None:
            logger.error(f"Database error: {exc_val}", exc_info=True)
        return False


# Проверка доступности порта
def check_port(start_port: int = PORT_START, num_ports: int = PORT_RANGE) -> int:
    """Проверяет, что порт доступен и возвращает первый свободный порт (int)."""
    for port in range(start_port, start_port + num_ports):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                # Пытаемся привязаться к порту
                s.bind(("localhost", port))
                # Если успешно — порт свободен
                logger.info(f"Port {port} is available.")
                return port
            except OSError:
                # Порт занят — пробуем следующий
                logger.info(f"Port {port} is in use, trying next...")
                continue

    raise RuntimeError(
        f"No free port found in range {start_port}-{start_port + num_ports - 1}"
    )


@eel.expose
def get_version():
    return APP_VERSION


@eel.expose
def load_games():
    """Загружает все игры из базы"""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT * FROM games
                ORDER BY
                    CASE status
                        WHEN 'playing' THEN 1
                        WHEN 'completed' THEN 2
                        WHEN 'planned' THEN 3
                        WHEN 'dropped' THEN 4
                        ELSE 5
                    END,
                    created_at DESC
            """
            )

            games = [dict(row) for row in cursor.fetchall()]

            for game in games:
                game["rating"] = float(game["rating"]) if game["rating"] else 0.0

                # Конвертируем скриншот в base64 если файл существует
                screenshot_path = game.get("screenshot_path")
                if screenshot_path and os.path.exists(screenshot_path):
                    try:
                        with open(screenshot_path, "rb") as f:
                            file_extension = Path(screenshot_path).suffix.lower()
                            image_data = base64.b64encode(f.read()).decode("utf-8")

                            if file_extension == ".svg":
                                game["screenshot_data"] = (
                                    f"data:image/svg+xml;base64,{image_data}"
                                )
                            else:
                                game["screenshot_data"] = (
                                    f"data:image/webp;base64,{image_data}"
                                )
                    except Exception as e:
                        logger.warning(
                            f"Error loading screenshot {screenshot_path}: {e}"
                        )
                        game["screenshot_data"] = ""
                else:
                    game["screenshot_data"] = ""

                if game["game_link"]:
                    display_text = (
                        game["game_link"].replace("https://", "").replace("http://", "")
                    )
                    game["display_link"] = (
                        display_text[:27] + "..."
                        if len(display_text) > 30
                        else display_text
                    )
                else:
                    game["display_link"] = ""

            return games

    except sqlite3.Error as e:
        logger.error(f"Database error in load_games: {e}", exc_info=True)
        return []
    except Exception as e:
        logger.error(f"Unexpected error in load_games: {e}", exc_info=True)
        return []


@eel.expose
def add_game(game_data, screenshot_data=None):
    """Добавляет новую игру"""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT INTO games (title, version, status, rating, review, game_link)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    game_data.get("title", ""),
                    game_data.get("version", ""),
                    game_data.get("status", "planned"),
                    float(game_data.get("rating", 0)),
                    game_data.get("review", ""),
                    game_data.get("game_link", ""),
                ),
            )

            game_id = cursor.lastrowid

            # Сохраняем скриншот если есть
            if screenshot_data:
                screenshot_path = save_screenshot(
                    screenshot_data, game_id, game_data.get("title", "")
                )
                if screenshot_path:
                    cursor.execute(
                        "UPDATE games SET screenshot_path = ? WHERE id = ?",
                        (screenshot_path, game_id),
                    )

            conn.commit()
            logger.info(f"Added game: '{game_data.get('title')}' (ID: {game_id})")
            return True

    except sqlite3.IntegrityError as e:
        logger.warning(f"Integrity error when adding game: {e}")
        return False
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid game data: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in add_game: {e}", exc_info=True)
        return False


@eel.expose
def update_game(game_id, game_data, screenshot_data=None):
    """Обновляет данные игры"""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            # Получаем старый путь к скриншоту
            cursor.execute("SELECT screenshot_path FROM games WHERE id = ?", (game_id,))
            result = cursor.fetchone()
            old_screenshot_path = result[0] if result else None

            # Обрабатываем скриншот
            new_screenshot_path = old_screenshot_path
            if screenshot_data == "":  # Удалить скриншот
                if old_screenshot_path:
                    delete_screenshot(old_screenshot_path, game_id)
                    new_screenshot_path = ""
            elif screenshot_data:  # Новый скриншот
                if old_screenshot_path:
                    delete_screenshot(old_screenshot_path, game_id)
                new_screenshot_path = save_screenshot(
                    screenshot_data, game_id, game_data.get("title", "")
                )

            # Обновляем данные игры
            cursor.execute(
                """
                UPDATE games
                SET title = ?, version = ?, status = ?, rating = ?,
                    review = ?, game_link = ?, screenshot_path = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """,
                (
                    game_data.get("title", ""),
                    game_data.get("version", ""),
                    game_data.get("status", "planned"),
                    float(game_data.get("rating", 0)),
                    game_data.get("review", ""),
                    game_data.get("game_link", ""),
                    new_screenshot_path,
                    game_id,
                ),
            )

            conn.commit()
            logger.info(f"Updated game: '{game_data.get('title')}' (ID: {game_id})")
            return True

    except (ValueError, TypeError) as e:
        logger.error(f"Invalid game data: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in update_game: {e}", exc_info=True)
        return False


@eel.expose
def delete_game(game_id):
    """Удаляет игру"""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            # Получаем название игры для логов и путь к скриншоту
            cursor.execute(
                "SELECT title, screenshot_path FROM games WHERE id = ?", (game_id,)
            )
            result = cursor.fetchone()

            if not result:
                return False

            game_title, screenshot_path = result

            # Удаляем скриншот
            if screenshot_path:
                delete_screenshot(screenshot_path, game_id)

            # Удаляем игру из БД
            cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
            conn.commit()

            logger.info(f"Deleted game: '{game_title}' (ID: {game_id})")
            return True

    except Exception as e:
        logger.error(f"Unexpected error in delete_game: {e}", exc_info=True)
        return False


@eel.expose
def get_statistics():
    """Получает статистику по играм"""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM games")
            total_games = cursor.fetchone()[0]

            status_counts = {}
            for status in ["completed", "playing", "planned", "dropped"]:
                cursor.execute("SELECT COUNT(*) FROM games WHERE status = ?", (status,))
                status_counts[status] = cursor.fetchone()[0]

            logger.info("Statistics: total %d games", total_games)
            return {"total_games": total_games, **status_counts}

    except Exception as e:
        logger.error(f"Error getting statistics: {e}", exc_info=True)
        return {
            "total_games": 0,
            "completed": 0,
            "playing": 0,
            "planned": 0,
            "dropped": 0,
        }


if __name__ == "__main__":
    try:
        logger.info(LOG_SEPARATOR)
        logger.info("Launching %s v%s...", APP_NAME, APP_VERSION)
        ensure_dirs()
        init_db()
        free_port = check_port()
        logger.info("Starting server on port %d", free_port)
        logger.info(LOG_SEPARATOR)
        eel.start(
            "index.html",
            size=WINDOW_SIZE,
            position=WINDOW_POSITION,
            port=free_port,
            disable_cache=True,
        )
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
        sys.exit(0)
    except RuntimeError as e:
        logger.error("Runtime error: %s", e)
        sys.exit(1)
    except Exception as e:
        logger.critical("Fatal error: %s", e, exc_info=True)
        sys.exit(1)
