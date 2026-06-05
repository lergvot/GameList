# app/database.py

import re
import sqlite3
from typing import Optional

from app.logger import get_logger
from app.migrations import run_migrations
from config import DB_FILE, DB_TIMEOUT

logger = get_logger(__name__)


def sanitize_text(text: str) -> str:
    """Убирает < и > из текста — простая защита от XSS"""
    if not text:
        return ""
    return re.sub(r"[<>]", "", str(text))


class GameRepository:
    """Репозиторий для работы с таблицей games"""

    def __init__(self):
        self.db = DatabaseConnection()

    def get_all_games(self) -> list[dict]:
        """Получает все игры с сортировкой по статусу и дате"""
        import json
        
        with self.db as conn:
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
            
            # Парсим developer_ids из JSON в список имен
            for game in games:
                developer_ids = json.loads(game.get("developer_ids", "[]"))
                game["developers"] = self._get_developers_by_ids(conn, developer_ids)
            
            return games

    def add_game(self, game_data: dict) -> Optional[int]:
        """Добавляет новую игру, возвращает ID или None при ошибке"""
        import json
        
        try:
            developers = game_data.pop("developers", [])
            if isinstance(developers, str):
                developers = [d.strip() for d in developers.split(",") if d.strip()]
            
            with self.db as conn:
                cursor = conn.cursor()
                
                # Получаем или создаем ID разработчиков
                developer_ids = self._get_or_create_developer_ids(cursor, developers)
                
                cursor.execute(
                    """
                    INSERT INTO games (title, version, status, rating, review, game_link, developer_ids)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        sanitize_text(game_data.get("title", "")),
                        sanitize_text(game_data.get("version", "")),
                        game_data.get("status", "planned"),
                        float(game_data.get("rating", 0)),
                        sanitize_text(game_data.get("review", "")),
                        game_data.get("game_link", ""),
                        json.dumps(developer_ids),
                    ),
                )
                conn.commit()
                return cursor.lastrowid
        except sqlite3.IntegrityError as e:
            logger.warning(f"Integrity error when adding game: {e}")
            return None
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid game data: {e}")
            return None

    def update_game(
        self, game_id: int, game_data: dict, screenshot_path: Optional[str] = None
    ) -> bool:
        """Обновляет данные игры"""
        import json
        
        try:
            developers = game_data.pop("developers", [])
            if isinstance(developers, str):
                developers = [d.strip() for d in developers.split(",") if d.strip()]
            
            with self.db as conn:
                cursor = conn.cursor()
                
                # Получаем или создаем ID разработчиков
                developer_ids = self._get_or_create_developer_ids(cursor, developers)
                
                cursor.execute(
                    """
                    UPDATE games
                    SET title = ?, version = ?, status = ?, rating = ?,
                        review = ?, game_link = ?, developer_ids = ?, screenshot_path = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """,
                    (
                        sanitize_text(game_data.get("title", "")),
                        sanitize_text(game_data.get("version", "")),
                        game_data.get("status", "planned"),
                        float(game_data.get("rating", 0)),
                        sanitize_text(game_data.get("review", "")),
                        game_data.get("game_link", ""),
                        json.dumps(developer_ids),
                        screenshot_path,
                        game_id,
                    ),
                )
                conn.commit()
                return cursor.rowcount > 0
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid game data: {e}")
            return False

    def delete_game(self, game_id: int) -> bool:
        """Удаляет игру по ID"""
        with self.db as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
            conn.commit()
            return cursor.rowcount > 0

    def _get_or_create_developer_ids(self, cursor: sqlite3.Cursor, developer_names: list) -> list:
        """Получает или создает ID разработчиков (case-insensitive для ASCII)"""
        developer_ids = []
        for dev_name in developer_names:
            dev_name = sanitize_text(dev_name.strip())
            if dev_name:
                # Ищем разработчика case-insensitive
                cursor.execute(
                    "SELECT id FROM developers WHERE LOWER(name) = LOWER(?)",
                    (dev_name,)
                )
                result = cursor.fetchone()
                
                if result:
                    # Разработчик существует
                    dev_id = result[0]
                    if dev_id not in developer_ids:
                        developer_ids.append(dev_id)
                else:
                    # Создаем нового разработчика
                    try:
                        cursor.execute(
                            "INSERT INTO developers (name) VALUES (?)",
                            (dev_name,)
                        )
                        developer_ids.append(cursor.lastrowid)
                    except sqlite3.IntegrityError:
                        # Разработчик уже существует - пересоздаем поиск
                        cursor.execute(
                            "SELECT id FROM developers WHERE LOWER(name) = LOWER(?)",
                            (dev_name,)
                        )
                        result = cursor.fetchone()
                        if result:
                            dev_id = result[0]
                            if dev_id not in developer_ids:
                                developer_ids.append(dev_id)
        return developer_ids

    def _get_developers_by_ids(self, conn: sqlite3.Connection, developer_ids: list) -> list:
        """Получает имена разработчиков по их ID"""
        if not developer_ids:
            return []
        cursor = conn.cursor()
        placeholders = ",".join("?" * len(developer_ids))
        cursor.execute(
            f"SELECT name FROM developers WHERE id IN ({placeholders}) ORDER BY name",
            developer_ids
        )
        return [row[0] for row in cursor.fetchall()]

    def get_game_by_id(self, game_id: int) -> Optional[dict]:
        """Получает игру по ID"""
        with self.db as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT title, screenshot_path FROM games WHERE id = ?", (game_id,)
            )
            result = cursor.fetchone()
            if result:
                return {"title": result[0], "screenshot_path": result[1]}
            return None

    def get_screenshot_path(self, game_id: int) -> Optional[str]:
        """Получает путь к скриншоту игры"""
        with self.db as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT screenshot_path FROM games WHERE id = ?", (game_id,))
            result = cursor.fetchone()
            return result[0] if result else None

    def update_screenshot_path(self, game_id: int, screenshot_path: str) -> bool:
        """Обновляет путь к скриншоту"""
        with self.db as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE games SET screenshot_path = ? WHERE id = ?",
                (screenshot_path, game_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_statistics(self) -> dict:
        """Получает статистику по играм"""
        with self.db as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM games")
            total_games = cursor.fetchone()[0]

            status_counts = {}
            for status in ["completed", "playing", "planned", "dropped"]:
                cursor.execute("SELECT COUNT(*) FROM games WHERE status = ?", (status,))
                status_counts[status] = cursor.fetchone()[0]

            return {"total_games": total_games, **status_counts}


def init_db():
    """Инициализирует базу данных через систему миграций."""
    try:
        conn = get_db_connection()
        try:
            run_migrations(conn)
            logger.info("Database initialized successfully")
        finally:
            conn.close()
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
