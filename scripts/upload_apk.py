import urllib.request
import os
import sys

file_path = os.path.abspath(r"deliverables\HyHyTv-1.0.0-release.apk")
filename = os.path.basename(file_path)
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

print(f"Reading {file_path} ({os.path.getsize(file_path)} bytes)...")
with open(file_path, "rb") as f:
    file_bytes = f.read()

body = []
body.append(f"--{boundary}".encode())
body.append(b'Content-Disposition: form-data; name="reqtype"')
body.append(b"")
body.append(b"fileupload")

body.append(f"--{boundary}".encode())
body.append(f'Content-Disposition: form-data; name="fileToUpload"; filename="{filename}"'.encode())
body.append(b"Content-Type: application/vnd.android.package-archive")
body.append(b"")
body.append(file_bytes)
body.append(f"--{boundary}--".encode())
body.append(b"")

data = b"\r\n".join(body)

print("Uploading to catbox.moe...")
req = urllib.request.Request(
    "https://catbox.moe/user/api.php",
    data=data,
    headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
)

try:
    with urllib.request.urlopen(req, timeout=60) as r:
        direct_url = r.read().decode("utf-8").strip()
        print("SUCCESS! Direct APK URL:", direct_url)
        with open("direct_apk_url.txt", "w", encoding="utf-8") as out:
            out.write(direct_url)
except Exception as e:
    print("Upload failed:", e)
    sys.exit(1)
