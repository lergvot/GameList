# app/database.py

import sqlite3

from app.logger import *
from config import DB_FILE, DB_TIMEOUT


# SQLite функции
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
