# app/database.py

import sqlite3
from typing import Optional

from app.logger import *
from config import DB_FILE, DB_TIMEOUT


class GameRepository:
    """Репозиторий для работы с таблицей games"""

    def __init__(self):
        self.db = DatabaseConnection()

    def get_all_games(self) -> list[dict]:
        """Получает все игры с сортировкой по статусу и дате"""
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
            return [dict(row) for row in cursor.fetchall()]

    def add_game(self, game_data: dict) -> Optional[int]:
        """Добавляет новую игру, возвращает ID или None при ошибке"""
        try:
            with self.db as conn:
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
        try:
            with self.db as conn:
                cursor = conn.cursor()
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
    """Инициализирует базу данных"""
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
