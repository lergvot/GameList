# app/updater.py

import webbrowser
from typing import Any, Dict, Optional

import requests
from packaging.version import InvalidVersion, Version

from app.logger import get_logger
from config import APP_VERSION, GITHUB_API_URL

logger = get_logger(__name__)


def get_latest_release_info() -> Optional[Dict[str, Any]]:
    """
    Запрашивает информацию о последнем релизе с GitHub.
    """
    try:
        response = requests.get(GITHUB_API_URL, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.info(f"Error fetching GitHub API: {e}")
        return None


def parse_version(tag: str) -> Optional[Version]:
    """
    Извлекает версию из тега (например, из 'v1.2.3' -> '1.2.3').
    Возвращает объект packaging.version.Version или None.
    """
    ver_str = tag.lstrip("v")
    try:
        return Version(ver_str)
    except InvalidVersion:
        return None


def check_for_updates() -> Dict[str, Any]:
    """
    Проверяет наличие обновлений.
    Возвращает информацию о доступном релизе.
    """
    current = APP_VERSION
    result = {
        "has_update": False,  # есть ли обновление
        "current_version": current,  # текущая версия
        "latest_version": None,  # последняя версия на GitHub
        "created_at": None,  # дата создания релиза
        "release_url": None,  # ссылка на релиз
        "download_url": None,  # ссылка на скачивание
        "release_notes": None,  # описание изменений
        "error": None,  # сообщение об ошибке, если что-то пошло не так
    }

    release_info = get_latest_release_info()
    if release_info is None:
        result["error"] = "Failed to get release information"
        return result

    tag = release_info.get("tag_name", "")
    latest_ver_obj = parse_version(tag)
    if latest_ver_obj is None:
        result["error"] = f"Not a valid version: '{tag}'"
        return result

    current_ver_obj = parse_version(current)
    if current_ver_obj is None:
        result["error"] = f"Not a valid version: '{current}'"
        return result

    logger.info(
        f"Check for updates: latest = {latest_ver_obj}, current = {current_ver_obj}"
    )

    result["latest_version"] = str(latest_ver_obj)
    result["created_at"] = release_info.get("created_at")
    result["release_url"] = release_info.get("html_url")
    result["download_url"] = (release_info.get("assets") or [{}])[0].get(
        "browser_download_url"
    )
    result["release_notes"] = release_info.get("body", "")

    if latest_ver_obj > current_ver_obj:
        result["has_update"] = True

    return result


def perform_update(update_info: Dict[str, Any]) -> None:
    """
    Выполняет обновление.
    """
    url = update_info.get("release_url")
    if url:
        # Открываем ссылку на релиз в браузере
        logger.info(f"Opening release page: {url}")
        webbrowser.open(url)
    else:
        logger.info("URL for update not found")
