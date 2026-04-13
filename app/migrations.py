# app/migrations.py

"""
Миграции базы данных.

Пример:
    def _migration_2_add_test(conn):
        conn.execute("ALTER TABLE games ADD COLUMN test TEXT DEFAULT ''")

    MIGRATIONS = [
        ...
        Migration(
            version=2,
            description="Add test column",
            up=_migration_2_add_test,
        ),
    ]
"""

import sqlite3
from typing import Callable

from app.logger import get_logger

logger = get_logger(__name__)


class Migration:
    """Описывает одну миграцию: версия + описание + функция применения."""

    def __init__(self, version: int, description: str, up: Callable[[sqlite3.Connection], None]):
        self.version = version
        self.description = description
        self.up = up  # функция, принимающая sqlite3.Connection


# ---------------------------------------------------------------------------
# Функции миграций
# ---------------------------------------------------------------------------

def _migration_1_create_games_table(conn: sqlite3.Connection) -> None:
    """Создание таблицы games."""
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


# ---------------------------------------------------------------------------
# Список миграций
# ---------------------------------------------------------------------------

MIGRATIONS: list[Migration] = [
    Migration(
        version=1,
        description="Create games table with indexes",
        up=_migration_1_create_games_table,
    ),
]


# ---------------------------------------------------------------------------
# Движок миграций
# ---------------------------------------------------------------------------

def _ensure_schema_version_table(conn: sqlite3.Connection) -> None:
    """Создает служебную таблицу schema_version, если её нет."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        )
    """
    )


def _get_current_version(conn: sqlite3.Connection) -> int:
    """Возвращает текущую версию схемы (0 если миграций ещё не было)."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    )
    if not cursor.fetchone():
        return 0
    cursor.execute("SELECT MAX(version) FROM schema_version")
    row = cursor.fetchone()
    return row[0] if row and row[0] is not None else 0


def _set_version(conn: sqlite3.Connection, version: int) -> None:
    """Записывает текущую версию схемы."""
    conn.execute("INSERT INTO schema_version (version) VALUES (?)", (version,))


def run_migrations(conn: sqlite3.Connection) -> None:
    """Применяет все неприменённые миграции к соединению."""
    _ensure_schema_version_table(conn)
    current = _get_current_version(conn)

    pending = [m for m in MIGRATIONS if m.version > current]
    if not pending:
        logger.info(f"Database schema is up to date (version {current})")
        return

    for migration in pending:
        logger.info(f"Applying migration {migration.version}: {migration.description}")
        try:
            migration.up(conn)
            _set_version(conn, migration.version)
            conn.commit()
            logger.info(f"Migration {migration.version} applied successfully")
        except sqlite3.Error as e:
            conn.rollback()
            logger.critical(
                f"Failed to apply migration {migration.version}: {e}", exc_info=True
            )
            raise RuntimeError(f"Migration {migration.version} failed: {e}") from e

    logger.info(f"All migrations applied. New schema version: {pending[-1].version}")
