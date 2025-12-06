import os
import re
import shutil
import sys
import zipfile

import PyInstaller.__main__


def get_version():
    """Get version from main.py"""
    with open("main.py", "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
    if match:
        return match.group(1)
    return "dev"


def build_local():
    """Local build (fast, without version in name)"""
    print("[BUILD] Local build...")

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

    # Cleanup
    if os.path.exists("build"):
        shutil.rmtree("build")

    spec_file = "Games List Manager.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print("[OK] Local build completed!")
    print("[DIR] EXE: Games List Manager/Games List Manager.exe")


def build_release():
    """Release build - only app with README"""
    version = get_version()
    print(f"[RELEASE] Building release v{version}...")

    # Safe name (without spaces)
    safe_name = f"Games_List_Manager_v{version}"
    # Human readable name
    human_name = f"Games List Manager"

    # Create folders
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs(f"dist/{human_name}", exist_ok=True)

    # Build
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

    # 1. Copy existing README.md from project (if exists)
    readme_src = "README.md"
    if os.path.exists(readme_src):
        shutil.copy2(readme_src, f"dist/{human_name}/README.md")
        print(f"[INFO] Added README.md from project")
    else:
        print("[WARN] README.md not found, skipping")

    # 2. Add LICENSE if exists
    license_files = ["LICENSE", "LICENSE.txt", "LICENSE.md"]
    for license_file in license_files:
        if os.path.exists(license_file):
            shutil.copy2(license_file, f"dist/{human_name}/{license_file}")
            print(f"[INFO] Added {license_file}")
            break

    # 3. ONLY app archive (no sources)
    zip_path = f"dist/{safe_name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(f"dist/{human_name}"):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.join(human_name, file)
                zipf.write(file_path, arcname)

    # Cleanup temp files
    shutil.rmtree("build", ignore_errors=True)

    spec_file = f"{human_name}.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print(f"[OK] Release v{version} built!")
    print(f"[ZIP] App archive: {zip_path}")
    print("[INFO] Source code archives will be created by GitHub automatically")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--release":
        build_release()
    else:
        build_local()
