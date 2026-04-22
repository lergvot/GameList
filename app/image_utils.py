# app/image_utils.py

import base64
import io
import os
import re

from PIL import Image

from app.database import GameRepository
from app.logger import get_logger
from config import DATA_DIR, IMAGE_MAX_WIDTH, IMAGE_QUALITY, SCREENSHOTS_DIR

logger = get_logger(__name__)

# Допустимые форматы изображений
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_IMAGE_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}


def normalize_filename(name):
    """Нормализует имя файла для безопасности"""
    if not name:
        return "unknown"
    name = re.sub(r"[^\w\s\u0400-\u04FF-]", "_", name)
    return re.sub(r"_+", "_", name.replace(" ", "_"))[:100].strip("_")


def validate_image_format(image_data):
    """
    Проверяет формат изображения.
    Возвращает True если формат допустим, иначе False.
    """
    try:
        if "," in image_data:
            # Извлекаем MIME тип из data URL
            header = image_data.split(",", 1)[0]
            # header format: "data:image/png;base64"
            if "image/" in header:
                mime_match = re.search(r"data:image/([^;]+)", header)
                if mime_match:
                    mime_type = f"image/{mime_match.group(1)}"
                    if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
                        logger.warning(f"Unsupported MIME type: {mime_type}")
                        return False
        
        # Декодируем и проверяем байты
        data_part = image_data.split(",", 1)[1] if "," in image_data else image_data
        image_bytes = base64.b64decode(data_part)
        
        # Проверяю по сигнатуре файла
        # JPEG: FF D8 FF
        # PNG: 89 50 4E 47
        # GIF: 47 49 46 38
        # WebP: RIFF....WEBP
        
        if image_bytes[:3] == b'\xff\xd8\xff':
            return True  # JPEG
        elif image_bytes[:4] == b'\x89PNG':
            return True  # PNG
        elif image_bytes[:4] == b'GIF8':
            return True  # GIF
        elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
            return True  # WebP
        else:
            logger.warning("Unknown image signature")
            return False
            
    except Exception as e:
        logger.error(f"Error validating image format: {e}")
        return False


def optimize_screenshot(image_data, max_width=IMAGE_MAX_WIDTH, quality=IMAGE_QUALITY):
    """Оптимизирует изображение в WebP"""
    try:
        # Проверяем формат перед обработкой
        if not validate_image_format(image_data):
            logger.error("Invalid image format - unsupported file type")
            return None

        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)

        image = Image.open(io.BytesIO(image_bytes))

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
        if optimized_data is None:
            logger.error(f"Failed to optimize screenshot for game {game_id}: invalid format")
            return ""
        
        if "," in optimized_data:
            optimized_data = optimized_data.split(",", 1)[1]

        image_bytes = base64.b64decode(optimized_data)

        # Все скриншоты сохраняем как WebP
        file_extension = ".webp"
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
