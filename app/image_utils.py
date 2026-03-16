# app/image_utils.py

import base64
import io
import os
import re

from PIL import Image

from app.database import *
from app.logger import get_logger
from config import DATA_DIR, IMAGE_MAX_WIDTH, IMAGE_QUALITY, SCREENSHOTS_DIR

logger = get_logger(__name__)


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

        logger.info(f"Screenshot saved (ID: {game_id}): {filename}")
        return str(filepath)
    except Exception as e:
        logger.error(f"Error saving screenshot for game {game_id}: {e}")
        return ""


def delete_screenshot(screenshot_path, game_id):
    """Удаляет файл скриншота"""
    if screenshot_path and os.path.exists(screenshot_path):
        try:
            os.remove(screenshot_path)
            logger.info(f"Screenshot deleted (ID: {game_id}): {screenshot_path}")
        except OSError as e:
            logger.warning(
                f"Error deleting screenshot (ID: {game_id}): {screenshot_path}: {e}"
            )
