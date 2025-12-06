import os
import re
import shutil
import zipfile
import sys
import PyInstaller.__main__


def get_version():
    """Получаем версию из main.py"""
    with open("main.py", "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
    if match:
        return match.group(1)
    return "dev"


def build_local():
    """Локальная сборка (быстрая, без версии в имени)"""
    print("🔨 Локальная сборка...")

    PyInstaller.__main__.run(
        [
            "main.py",
            "--onefile",
            "--windowed",
            "--name=Games List Manager",
            "--distpath=Games List Manager",
            "--add-data=web;web",
            "--hidden-import=sqlite3",
            "--clean",
            "--noconfirm",
            "--icon=web/favicon.ico",
        ]
    )

    # Очистка
    if os.path.exists("build"):
        shutil.rmtree("build")

    spec_file = "Games List Manager.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print("[OK] Локальная сборка завершена!")
    print("[DIR] EXE: Games List Manager/Games List Manager.exe")


def build_release():
    """Релизная сборка - только приложение с README"""
    version = get_version()
    print(f"[RELEASE] Релизная сборка v{version}...")

    # Безопасное имя (без пробелов)
    safe_name = f"Games_List_Manager_v{version}"
    # Человеческое имя
    human_name = f"Games List Manager"

    # Создаём папки
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs(f"dist/{human_name}", exist_ok=True)

    # Сборка
    PyInstaller.__main__.run(
        [
            "main.py",
            "--onefile",
            "--windowed",
            f"--name={human_name}",
            f"--distpath=dist/{human_name}",
            "--add-data=web;web",
            "--hidden-import=sqlite3",
            "--clean",
            "--noconfirm",
            "--icon=web/favicon.ico",
        ]
    )

    # 1. Копируем существующий README.md проекта (если есть)
    readme_src = "README.md"
    if os.path.exists(readme_src):
        shutil.copy2(readme_src, f"dist/{human_name}/README.md")
        print(f"Добавлен README.md из проекта")
    else:
        print("README.md не найден, пропускаем")

    # 2. Добавляем LICENSE если есть
    license_files = ["LICENSE", "LICENSE.txt", "LICENSE.md"]
    for license_file in license_files:
        if os.path.exists(license_file):
            shutil.copy2(license_file, f"dist/{human_name}/{license_file}")
            print(f"Добавлен {license_file}")
            break

    # 3. ТОЛЬКО архив с приложением (без исходников)
    zip_path = f"dist/{safe_name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(f"dist/{human_name}"):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.join(human_name, file)
                zipf.write(file_path, arcname)

    # Очистка временных файлов
    shutil.rmtree("build", ignore_errors=True)

    spec_file = f"{human_name}.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print(f"[OK] Релиз v{version} собран!")
    print(f"[ZIP] App ZIP: {zip_path}")
    print("[INFO] Source code архивы создаст GitHub автоматически")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--release":
        build_release()
    else:
        build_local()
