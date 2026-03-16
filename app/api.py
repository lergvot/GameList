# app/api.py

import base64
import os
from pathlib import Path

import eel

from app.database import GameRepository
from app.image_utils import delete_screenshot, save_screenshot
from app.logger import get_logger
from config import APP_VERSION

logger = get_logger(__name__)


@eel.expose
def get_version():
    return APP_VERSION


@eel.expose
def load_games():
    """Загружает все игры из базы"""
    try:
        repo = GameRepository()
        games = repo.get_all_games()

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
                    logger.warning(f"Error loading screenshot {screenshot_path}: {e}")
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

    except Exception as e:
        logger.error(f"Unexpected error in load_games: {e}", exc_info=True)
        return []


@eel.expose
def add_game(game_data, screenshot_data=None):
    """Добавляет новую игру"""
    try:
        repo = GameRepository()
        game_id = repo.add_game(game_data)

        if not game_id:
            return False

        # Сохраняем скриншот если есть
        if screenshot_data:
            screenshot_path = save_screenshot(
                screenshot_data, game_id, game_data.get("title", "")
            )
            if screenshot_path:
                repo.update_screenshot_path(game_id, screenshot_path)

        logger.info(f"Added game (ID: {game_id}): '{game_data.get('title')}'")
        return True

    except Exception as e:
        logger.error(f"Unexpected error in add_game: {e}", exc_info=True)
        return False


@eel.expose
def update_game(game_id, game_data, screenshot_data=None):
    """Обновляет данные игры"""
    try:
        repo = GameRepository()

        # Получаем старый путь к скриншоту
        old_screenshot_path = repo.get_screenshot_path(game_id)

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
        success = repo.update_game(game_id, game_data, new_screenshot_path)

        if success:
            logger.info(f"Updated game (ID: {game_id}): '{game_data.get('title')}'")
        return success

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
        repo = GameRepository()

        # Получаем название игры для логов и путь к скриншоту
        game_info = repo.get_game_by_id(game_id)

        if not game_info:
            return False

        game_title = game_info["title"]
        screenshot_path = game_info["screenshot_path"]

        # Удаляем скриншот
        if screenshot_path:
            delete_screenshot(screenshot_path, game_id)

        # Удаляем игру из БД
        success = repo.delete_game(game_id)

        if success:
            logger.info(f"Deleted game (ID: {game_id}): '{game_title}'")
        return success

    except Exception as e:
        logger.error(f"Unexpected error in delete_game: {e}", exc_info=True)
        return False


@eel.expose
def get_statistics():
    """Получает статистику по играм"""
    try:
        repo = GameRepository()
        stats = repo.get_statistics()
        logger.info("Statistics: total %d games", stats["total_games"])
        return stats

    except Exception as e:
        logger.error(f"Error getting statistics: {e}", exc_info=True)
        return {
            "total_games": 0,
            "completed": 0,
            "playing": 0,
            "planned": 0,
            "dropped": 0,
        }
