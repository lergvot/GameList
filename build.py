import os
import shutil
import PyInstaller.__main__


def build_app():
    print("🔨 Сборка приложения...")

    # Сборка
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

    # Очистка временных файлов ПОСЛЕ сборки
    if os.path.exists("build"):
        shutil.rmtree("build")

    spec_file = "Games List Manager.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print("✅ Сборка завершена!")
    print("📁 EXE: Games List Manager/Games List Manager.exe")


if __name__ == "__main__":
    build_app()
