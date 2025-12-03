#!/usr/bin/env python3
"""
Автономный скрипт для миграции скриншотов игр
Конвертирует существующие скриншоты в WebP с нормализованными именами
"""

import os
import sqlite3
import base64
import re
from pathlib import Path
from PIL import Image
import io
import sys

# Конфигурация
DATA_DIR = Path("data")
DB_FILE = DATA_DIR / "games.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"


def normalize_filename(name):
    """Нормализует имя файла: оставляет только безопасные символы"""
    if not name:
        return "unknown"

    # Заменяем небезопасные символы на подчеркивания
    # Разрешаем буквы (включая кириллицу), цифры, пробелы, дефисы и подчеркивания
    name = re.sub(r"[^\w\s\u0400-\u04FF-]", "_", name)

    # Заменяем пробелы на подчеркивания
    name = name.replace(" ", "_")

    # Убираем множественные подчеркивания
    name = re.sub(r"_+", "_", name)

    # Обрезаем длину (макс 100 символов)
    name = name[:100]

    return name.strip("_")


def optimize_screenshot(image_path, max_width=1200, quality=85):
    """Конвертирует и оптимизирует изображение в WebP"""
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        image = Image.open(io.BytesIO(image_bytes))

        # Конвертируем в RGB если нужно (для PNG с прозрачностью)
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(
                image, mask=image.split()[-1] if image.mode == "RGBA" else None
            )
            image = background

        # Ресайз если нужно (сохраняем пропорции)
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

        # Конвертация в WebP
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, optimize=True)

        return output.getvalue()

    except Exception as e:
        print(f"❌ Ошибка оптимизации {image_path}: {e}")
        return None


def get_screenshot_report():
    """Получить отчет о текущих скриншотах"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, screenshot_path FROM games WHERE screenshot_path != ''"
        )
        games_with_screenshots = cursor.fetchall()

        screenshot_info = []
        total_size_kb = 0
        format_stats = {}

        for game_id, title, path in games_with_screenshots:
            if path and os.path.exists(path):
                file_size = os.path.getsize(path)
                file_ext = Path(path).suffix.lower()

                screenshot_info.append(
                    {
                        "game_id": game_id,
                        "title": title,
                        "path": path,
                        "size_kb": round(file_size / 1024, 2),
                        "format": file_ext,
                    }
                )

                total_size_kb += file_size / 1024
                format_stats[file_ext] = format_stats.get(file_ext, 0) + 1

        return screenshot_info, total_size_kb, format_stats
    except Exception as e:
        print(f"❌ Ошибка получения отчета: {e}")
        return [], 0, {}


def migrate_screenshots():
    """Основная функция миграции"""
    print("🔄 Запуск миграции скриншотов...")
    print("=" * 60)

    # Проверяем существование БД
    if not DB_FILE.exists():
        print(f"❌ База данных не найдена: {DB_FILE}")
        return False

    # Получаем отчет
    screenshots, total_size, formats = get_screenshot_report()

    if not screenshots:
        print("✅ Нет скриншотов для миграции")
        return True

    print(f"📊 Найдено скриншотов: {len(screenshots)}")
    print(f"📦 Общий размер: {total_size:.2f} KB")
    print("📁 Форматы:")
    for fmt, count in formats.items():
        print(f"   {fmt}: {count} файлов")

    # Ожидаемая экономия (WebP обычно на 30-70% меньше)
    estimated_saving = total_size * 0.5
    print(f"💾 Ожидаемая экономия: ~{estimated_saving:.2f} KB")

    # Подтверждение
    print("\n⚠️  ВНИМАНИЕ: Эта операция изменит файлы скриншотов!")
    print("   Старые файлы будут удалены после успешной конвертации.")
    confirm = input("\nПродолжить миграцию? (y/N): ").lower()

    if confirm != "y":
        print("❌ Миграция отменена")
        return False

    print("\n🔄 Начинаем миграцию...")

    migrated_count = 0
    errors = []

    for screenshot in screenshots:
        game_id = screenshot["game_id"]
        game_title = screenshot["title"]
        old_path = screenshot["path"]

        print(f"\n🎮 Обрабатываем: '{game_title}'")
        print(f"   Старый файл: {Path(old_path).name} ({screenshot['size_kb']} KB)")

        try:
            # Пропускаем уже конвертированные WebP файлы
            if old_path.lower().endswith(".webp"):
                print("   ✅ Уже в формате WebP - пропускаем")
                migrated_count += 1
                continue

            # Конвертируем в WebP
            optimized_data = optimize_screenshot(old_path)
            if not optimized_data:
                errors.append(f"{game_title}: ошибка конвертации")
                continue

            # Создаем новое имя файла
            normalized_name = normalize_filename(game_title)
            new_filename = f"{game_id}_{normalized_name}.webp"
            new_path = SCREENSHOTS_DIR / new_filename

            # Сохраняем новый файл
            with open(new_path, "wb") as f:
                f.write(optimized_data)

            new_size_kb = os.path.getsize(new_path) / 1024
            print(f"   ✅ Новый файл: {new_filename} ({new_size_kb:.1f} KB)")

            # Обновляем базу данных
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE games SET screenshot_path = ? WHERE id = ?",
                (str(new_path), game_id),
            )
            conn.commit()
            conn.close()

            # Удаляем старый файл
            try:
                os.remove(old_path)
                print(f"   🗑️ Удален старый файл")
            except Exception as e:
                errors.append(f"{game_title}: не удалось удалить старый файл - {e}")

            migrated_count += 1

        except Exception as e:
            error_msg = f"{game_title}: {e}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
            continue

    # Формируем отчет
    print("\n" + "=" * 60)
    print("📊 ОТЧЕТ О МИГРАЦИИ:")
    print(f"✅ Успешно мигрировано: {migrated_count}/{len(screenshots)}")

    if errors:
        print(f"❌ Ошибки ({len(errors)}):")
        for error in errors:
            print(f"   - {error}")
    else:
        print("🎉 Все скриншоты успешно мигрированы!")

    # Проверяем результаты
    if migrated_count > 0:
        print(f"\n💾 Новый формат: WebP")
        print(f"📁 Папка скриншотов: {SCREENSHOTS_DIR}")
        print("\n✅ Миграция завершена! Теперь можно обновить основной код.")
        return True
    else:
        print("\n❌ Миграция не выполнена")
        return False


def verify_migration():
    """Проверка результатов миграции"""
    print("\n🔍 Проверка результатов миграции...")

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, title, screenshot_path FROM games WHERE screenshot_path != ''"
    )
    games = cursor.fetchall()

    webp_count = 0
    other_count = 0
    missing_files = []

    for game_id, title, path in games:
        if path.lower().endswith(".webp"):
            webp_count += 1
        else:
            other_count += 1

        if not os.path.exists(path):
            missing_files.append(f"{title} (ID: {game_id})")

    print(f"📊 WebP файлов: {webp_count}")
    print(f"📊 Файлов других форматов: {other_count}")

    if missing_files:
        print(f"⚠️  Отсутствующие файлы: {len(missing_files)}")
        for item in missing_files:
            print(f"   - {item}")
    else:
        print("✅ Все файлы на месте")

    conn.close()

    return webp_count > 0 and len(missing_files) == 0


def main():
    """Основная функция"""
    print("🛠️  Мигратор скриншотов Game Collection")
    print("=" * 50)

    if not DATA_DIR.exists():
        print(f"❌ Папка данных не найдена: {DATA_DIR}")
        sys.exit(1)

    SCREENSHOTS_DIR.mkdir(exist_ok=True)

    # Меню
    while True:
        print("\nВыберите действие:")
        print("1. 📊 Показать отчет о скриншотах")
        print("2. 🚀 Запустить миграцию")
        print("3. 🔍 Проверить результаты")
        print("4. ❌ Выйти")

        choice = input("\nВаш выбор (1-4): ").strip()

        if choice == "1":
            screenshots, total_size, formats = get_screenshot_report()
            if screenshots:
                print(f"\n📊 Найдено скриншотов: {len(screenshots)}")
                for screenshot in screenshots:
                    print(
                        f"   • {screenshot['title']}: {screenshot['format']} ({screenshot['size_kb']} KB)"
                    )
            else:
                print("📊 Скриншоты не найдены")

        elif choice == "2":
            success = migrate_screenshots()
            if success:
                print("\n🎉 Миграция успешно завершена!")
                print("Теперь можно обновить основной код для работы с WebP.")
            else:
                print("\n❌ Миграция завершена с ошибками")

        elif choice == "3":
            verify_migration()

        elif choice == "4":
            print("👋 До свидания!")
            break

        else:
            print("❌ Неверный выбор")


if __name__ == "__main__":
    main()
