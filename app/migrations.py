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

def _migration_2_add_developer_column(conn: sqlite3.Connection) -> None:
    """Добавление колонки developer в таблицу games."""
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE games ADD COLUMN developer TEXT DEFAULT ''")


def _migration_3_normalize_developers(conn: sqlite3.Connection) -> None:
    """
    Создает таблицу developers и добавляет поле developer_ids в games.
    Распарсивает существующие разработчиков (через запятую) в developer_ids как JSON.
    """
    import json
    
    cursor = conn.cursor()
    
    # Создаем таблицу developers с case-insensitive UNIQUE (работает для ASCII/латиницы)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS developers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )
    
    # Добавляем поле developer_ids в games (JSON со списком ID)
    cursor.execute("ALTER TABLE games ADD COLUMN developer_ids TEXT DEFAULT '[]'")
    
    # Мигрируем существующих разработчиков
    cursor.execute("SELECT id, developer FROM games WHERE developer != ''")
    rows = cursor.fetchall()
    
    for game_id, developer_str in rows:
        # Парсим разработчиков (отделены запятыми и пробелами)
        developer_names = [d.strip() for d in developer_str.split(",") if d.strip()]
        developer_ids = []
        
        for dev_name in developer_names:
            # Вставляем разработчика если его еще нет
            try:
                cursor.execute(
                    "INSERT INTO developers (name) VALUES (?)",
                    (dev_name,)
                )
                developer_ids.append(cursor.lastrowid)
            except sqlite3.IntegrityError:
                # Разработчик уже существует
                cursor.execute("SELECT id FROM developers WHERE name = ?", (dev_name,))
                result = cursor.fetchone()
                if result:
                    dev_id = result[0]
                    if dev_id not in developer_ids:
                        developer_ids.append(dev_id)
        
        # Сохраняем список ID как JSON
        cursor.execute(
            "UPDATE games SET developer_ids = ? WHERE id = ?",
            (json.dumps(developer_ids), game_id)
        )
    
    # Удаляем старую колонку developer из games
    cursor.execute(
        """
        CREATE TABLE games_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            version TEXT DEFAULT '',
            status TEXT DEFAULT 'planned',
            rating REAL DEFAULT 0,
            review TEXT DEFAULT '',
            game_link TEXT DEFAULT '',
            screenshot_path TEXT DEFAULT '',
            developer_ids TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )
    
    cursor.execute(
        """
        INSERT INTO games_new 
        SELECT id, title, version, status, rating, review, game_link, screenshot_path, developer_ids, created_at, updated_at
        FROM games
    """
    )
    
    cursor.execute("DROP TABLE games")
    cursor.execute("ALTER TABLE games_new RENAME TO games")
    
    # Пересоздаем индексы
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
    Migration(
        version=2,
        description="Add developer column to games table",
        up=_migration_2_add_developer_column,
    ),
    Migration(
        version=3,
        description="Normalize developers into separate table with M:N relationship",
        up=_migration_3_normalize_developers,
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
