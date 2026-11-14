import urllib.request
import json

data_dict = {
    "versionCode": 2,
    "versionName": "1.1.0",
    "apkUrl": "https://files.catbox.moe/5rp34a.apk",
    "changelog": "Cập nhật trình phát Netflix chuẩn TV, hỗ trợ phụ đề tiếng Việt, tối ưu mượt mà 60 FPS.",
    "forceUpdate": False
}

json_bytes = json.dumps(data_dict, ensure_ascii=False, indent=2).encode('utf-8')
boundary = "----WebKitFormBoundaryUpdateCheck"

body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="reqtype"\r\n\r\n'
    f"fileupload\r\n"
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="fileToUpload"; filename="version.json"\r\n'
    f"Content-Type: application/json\r\n\r\n"
).encode('utf-8') + json_bytes + f"\r\n--{boundary}--\r\n".encode('utf-8')

req = urllib.request.Request(
    "https://catbox.moe/user/api.php",
    data=body,
    headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "Mozilla/5.0",
    }
)

try:
    with urllib.request.urlopen(req, timeout=15) as r:
        url = r.read().decode().strip()
        print("Uploaded version.json URL:", url)
except Exception as e:
    print("Upload error:", e)
