import os
import sys
import json
import re
import shutil
import subprocess
import urllib.request
import uuid

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def run_cmd(cmd, cwd=ROOT_DIR):
    print(f"\n[RUN] {cmd} (in {cwd})")
    ret = subprocess.run(cmd, shell=True, cwd=cwd)
    if ret.returncode != 0:
        print(f"[ERROR] Command failed with returncode {ret.returncode}: {cmd}")
        sys.exit(1)

def main():
    os.chdir(ROOT_DIR)
    version_file = os.path.join(ROOT_DIR, "version.json")
    with open(version_file, "r", encoding="utf-8") as f:
        version_data = json.load(f)

    current_code = version_data.get("versionCode", 3)
    new_code = current_code + 1
    
    # Calculate new versionName (e.g. 1.2.0 -> 1.2.1)
    current_name = version_data.get("versionName", "1.2.0")
    parts = current_name.split(".")
    if len(parts) == 3:
        new_name = f"{parts[0]}.{parts[1]}.{int(parts[2]) + 1}"
    else:
        new_name = f"1.{new_code}.0"

    print(f"==================================================")
    print(f"  HyHyTV Auto Release Pipeline")
    print(f"  Current Version: {current_name} (code: {current_code})")
    print(f"  New Version:     {new_name} (code: {new_code})")
    print(f"==================================================")

    # 1. Update app/build.gradle.kts
    gradle_file = os.path.join(ROOT_DIR, "app", "build.gradle.kts")
    with open(gradle_file, "r", encoding="utf-8") as f:
        gradle_text = f.read()

    gradle_text = re.sub(r'versionCode\s*=\s*\d+', f'versionCode = {new_code}', gradle_text)
    gradle_text = re.sub(r'versionName\s*=\s*"[^"]+"', f'versionName = "{new_name}"', gradle_text)

    with open(gradle_file, "w", encoding="utf-8") as f:
        f.write(gradle_text)
    print("1. Updated app/build.gradle.kts")

    # 2. Build web
    print("\n2. Building Web frontend...")
    run_cmd("npm run build", cwd=os.path.join(ROOT_DIR, "web"))

    # 3. Copy dist to Android assets
    print("\n3. Syncing assets into Android app...")
    src_dist = os.path.join(ROOT_DIR, "web", "dist")
    dst_dist = os.path.join(ROOT_DIR, "app", "src", "main", "assets", "dist")
    if os.path.exists(dst_dist):
        shutil.rmtree(dst_dist)
    shutil.copytree(src_dist, dst_dist)

    # 4. Assemble release APK
    print("\n4. Building Android Release APK...")
    gradlew = "gradlew.bat" if os.name == "nt" else "./gradlew"
    run_cmd(f"{gradlew} clean assembleRelease")

    # 5. Copy to deliverables
    print("\n5. Copying APK to deliverables...")
    out_apk = os.path.join(ROOT_DIR, "app", "build", "outputs", "apk", "release", "app-release.apk")
    deliv_apk = os.path.join(ROOT_DIR, "deliverables", "HyHyTv-1.0.0-release.apk")
    shutil.copyfile(out_apk, deliv_apk)

    # 6. Set APK URL (Raw GitHub is 100% reliable permanent CDN, Catbox as optional mirror)
    print("\n6. Configuring permanent APK Download CDN...")
    apk_url = "https://raw.githubusercontent.com/Hermess1309/HyHyTV/main/deliverables/HyHyTv-1.0.0-release.apk"
    try:
        boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
        body = bytearray()
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n'.encode('utf-8'))
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="HyHyTv-v{new_name}.apk"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n'.encode('utf-8'))
        with open(deliv_apk, "rb") as f:
            body.extend(f.read())
        body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))

        req = urllib.request.Request(
            "https://catbox.moe/user/api.php",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "Mozilla/5.0"
            }
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            catbox_res = res.read().decode("utf-8").strip()
            if catbox_res.startswith("http"):
                print(f"-> Catbox mirror: {catbox_res}")
    except Exception as e:
        print(f"-> Notice: Catbox upload skipped ({e}), using raw GitHub CDN.")

    print(f"-> Main APK CDN URL: {apk_url}")

    # 7. Update version.json
    print("\n7. Updating version.json...")
    version_data["versionCode"] = new_code
    version_data["versionName"] = new_name
    version_data["apkUrl"] = apk_url
    with open(version_file, "w", encoding="utf-8") as f:
        json.dump(version_data, f, indent=2, ensure_ascii=False)

    # 8. Git commit & push
    print("\n8. Committing and pushing to GitHub...")
    run_cmd("git add .")
    run_cmd(f'git commit -m "release: v{new_name} (code {new_code})"')
    run_cmd("git push origin main")

    print("\n" + "="*50)
    print(f"  SUCCESS! HyHyTV v{new_name} released to GitHub!")
    print(f"  All TVs running HyHyTV will automatically update on next launch.")
    print("="*50)

if __name__ == "__main__":
    main()
