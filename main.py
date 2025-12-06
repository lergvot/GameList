# main.py
import base64
import io
import logging
import os
import re
import sqlite3
from pathlib import Path

import eel
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

eel.init("web")

APP_VERSION = "1.10.6"
DATA_DIR = Path("data")
DB_FILE = DATA_DIR / "games.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"


def normalize_filename(name):
    """Нормализует имя файла для безопасности"""
    if not name:
        return "unknown"
    name = re.sub(r"[^\w\s\u0400-\u04FF-]", "_", name)
    return name.replace(" ", "_").replace("_+", "_")[:100].strip("_")


def optimize_screenshot(image_data, max_width=1200, quality=85):
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
        if image.width > max_width:
            ratio = max_width / image.width
            image = image.resize(
                (max_width, int(image.height * ratio)), Image.Resampling.LANCZOS
            )

        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, optimize=True)
        return base64.b64encode(output.getvalue()).decode("utf-8")
    except Exception as e:
        logger.error(f"Error optimizing image: {e}")
        return image_data


def ensure_dirs():
    """Создает необходимые папки"""
    DATA_DIR.mkdir(exist_ok=True)
    SCREENSHOTS_DIR.mkdir(exist_ok=True)


def init_db():
    """Инициализирует базу данных"""
    ensure_dirs()
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

        return str(filepath)
    except Exception as e:
        logger.error(f"Error saving screenshot: {e}")
        return ""


def delete_screenshot(screenshot_path):
    """Удаляет файл скриншота"""
    if screenshot_path and os.path.exists(screenshot_path):
        os.remove(screenshot_path)


# SQLite функции
def sqlite_file_exists(path):
    return 1 if path and os.path.exists(path) else 0


def sqlite_base64_screenshot(path):
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            file_extension = Path(path).suffix.lower()
            image_data = base64.b64encode(f.read()).decode("utf-8")

            # Определяем MIME тип для data URL
            if file_extension == ".svg":
                return f"data:image/svg+xml;base64,{image_data}"
            else:
                return f"data:image/webp;base64,{image_data}"
    return ""


def get_db_connection():
    """Создает соединение с БД с кастомными функциями"""
    conn = sqlite3.connect(DB_FILE)
    conn.create_function("file_exists", 1, sqlite_file_exists)
    conn.create_function("base64_screenshot", 1, sqlite_base64_screenshot)
    return conn


@eel.expose
def get_version():
    return APP_VERSION


@eel.expose
def load_games():
    """Загружает все игры из базы"""
    if not DB_FILE.exists():
        init_db()

    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *, 
               CASE 
                   WHEN screenshot_path != '' AND file_exists(screenshot_path) = 1 
                   THEN base64_screenshot(screenshot_path)
                   ELSE ''
               END as screenshot_data
        FROM games 
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

        if game["game_link"]:
            display_text = (
                game["game_link"].replace("https://", "").replace("http://", "")
            )
            game["display_link"] = (
                display_text[:27] + "..." if len(display_text) > 30 else display_text
            )
        else:
            game["display_link"] = ""

    conn.close()
    return games


@eel.expose
def add_game(game_data, screenshot_data=None):
    """Добавляет новую игру"""
    if not DB_FILE.exists():
        init_db()

    conn = get_db_connection()
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
    conn.close()
    logger.info(f"Added game: {game_data.get('title')} (ID: {game_id})")
    return True


@eel.expose
def update_game(game_id, game_data, screenshot_data=None):
    """Обновляет данные игры"""
    if not DB_FILE.exists():
        init_db()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Получаем старый путь к скриншоту
    cursor.execute("SELECT screenshot_path FROM games WHERE id = ?", (game_id,))
    old_screenshot_path = cursor.fetchone()[0]

    # Обрабатываем скриншот
    new_screenshot_path = old_screenshot_path
    if screenshot_data == "":  # Удалить скриншот
        if old_screenshot_path:
            delete_screenshot(old_screenshot_path)
            new_screenshot_path = ""
    elif screenshot_data:  # Новый скриншот
        if old_screenshot_path:
            delete_screenshot(old_screenshot_path)
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
    conn.close()
    logger.info(f"Updated game ID: {game_id}")
    return True


@eel.expose
def delete_game(game_id):
    """Удаляет игру"""
    if not DB_FILE.exists():
        return True

    conn = get_db_connection()
    cursor = conn.cursor()

    # Получаем и удаляем скриншот
    cursor.execute("SELECT screenshot_path FROM games WHERE id = ?", (game_id,))
    if result := cursor.fetchone():
        delete_screenshot(result[0])

    cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
    conn.commit()
    conn.close()

    logger.info(f"Deleted game ID: {game_id}")
    return True


@eel.expose
def get_statistics():
    """Получает статистику по играм"""
    if not DB_FILE.exists():
        init_db()
        return {
            "total_games": 0,
            "completed": 0,
            "playing": 0,
            "planned": 0,
            "dropped": 0,
        }

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM games")
    total_games = cursor.fetchone()[0]

    status_counts = {}
    for status in ["completed", "playing", "planned", "dropped"]:
        cursor.execute(f'SELECT COUNT(*) FROM games WHERE status = "{status}"')
        status_counts[status] = cursor.fetchone()[0]

    conn.close()
    return {"total_games": total_games, **status_counts}


if __name__ == "__main__":
    print("🚀 Запуск Game Collection Manager...")
    ensure_dirs()
    init_db()

    eel.start("index.html", size=(1200, 660), position=(100, 100))
