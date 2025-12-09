# build.py
import os
import shutil
import sys
import zipfile

import PyInstaller.__main__

from config import APP_NAME, APP_VERSION, BUILD_CONFIG


def get_version():
    """Получаем версию из config.py"""
    return APP_VERSION


def build_local():
    """Локальная сборка"""
    print(f"[BUILD] Local build {APP_NAME} v{APP_VERSION}...")

    args = [
        "main.py",
        "--onefile",
        "--windowed",
        f"--name={BUILD_CONFIG['exe_name']}",
        f"--distpath={BUILD_CONFIG['exe_name']}",
        "--add-data=web;web",
        "--hidden-import=sqlite3",
        "--clean",
        "--noconfirm",
    ]

    # Добавляем иконку если указана
    if BUILD_CONFIG.get("icon_path") and os.path.exists(BUILD_CONFIG["icon_path"]):
        args.append(f"--icon={BUILD_CONFIG['icon_path']}")

    PyInstaller.__main__.run(args)

    # Очистка
    cleanup()
    print(f"[OK] Local build completed!")
    print(f"[DIR] EXE: {BUILD_CONFIG['exe_name']}/{BUILD_CONFIG['exe_name']}.exe")


def build_release():
    """Релизная сборка"""
    print(f"[RELEASE] Building release v{APP_VERSION}...")

    # Формируем имена из конфига
    safe_name = f"{BUILD_CONFIG['release_prefix']}_v{APP_VERSION}"
    human_name = BUILD_CONFIG["exe_name"]

    # Создаем директории
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs(f"dist/{human_name}", exist_ok=True)

    # Аргументы для сборки
    args = [
        "main.py",
        "--onefile",
        "--windowed",
        f"--name={human_name}",
        f"--distpath=dist/{human_name}",
        "--add-data=web;web",
        "--hidden-import=sqlite3",
        "--clean",
        "--noconfirm",
    ]

    if BUILD_CONFIG.get("icon_path") and os.path.exists(BUILD_CONFIG["icon_path"]):
        args.append(f"--icon={BUILD_CONFIG['icon_path']}")

    PyInstaller.__main__.run(args)

    # Копируем дополнительные файлы
    copy_additional_files(f"dist/{human_name}")

    # Создаем архив
    zip_path = f"dist/{safe_name}.zip"
    create_archive(f"dist/{human_name}", zip_path, human_name)

    # Очистка
    cleanup()

    print(f"[OK] Release v{APP_VERSION} built!")
    print(f"[ARCHIVE] {zip_path}")


def cleanup():
    """Очистка временных файлов"""
    if os.path.exists("build"):
        shutil.rmtree("build")

    spec_file = f"{BUILD_CONFIG['exe_name']}.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)


def copy_additional_files(dest_dir):
    """Копирует дополнительные файлы в дистрибутив"""
    files_to_copy = ["README.md", "LICENSE", "LICENSE.txt", "LICENSE.md"]

    for file in files_to_copy:
        if os.path.exists(file):
            shutil.copy2(file, f"{dest_dir}/{file}")
            print(f"[INFO] Added: {file}")


def create_archive(source_dir, output_path, base_dir):
    """Создает архив"""
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.join(base_dir, file)
                zipf.write(file_path, arcname)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--release":
        build_release()
    else:
        build_local()
