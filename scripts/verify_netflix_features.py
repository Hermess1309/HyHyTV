import subprocess
import time
import os
import sys

ADB = r"C:\Users\PC\Downloads\6\.tools\android-sdk\platform-tools\adb.exe"
OUTPUT_DIR = r"C:\Users\PC\.gemini\antigravity\brain\4ded25a1-537e-4924-8462-8d1db139b238\test_evidence"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def adb(args):
    cmd = [ADB] + args
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.stdout.strip()

def tap(x, y, delay=1.0):
    adb(["shell", "input", "tap", str(x), str(y)])
    time.sleep(delay)

def key(code, count=1, delay=0.5):
    for _ in range(count):
        adb(["shell", "input", "keyevent", str(code)])
        time.sleep(delay)

def type_text(txt):
    adb(["shell", "input", "text", txt])
    time.sleep(1.2)

def capture(name):
    p = os.path.join(OUTPUT_DIR, f"{name}.png")
    with open(p, "wb") as f:
        subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=f)
    print(f"Captured: {name} -> {p}")
    return p

def main():
    print("=== STARTING COMPREHENSIVE NETFLIX FEATURE VERIFICATION ===")

    # 1. Start App fresh
    print("[1] Launching App...")
    adb(["shell", "am", "start", "-S", "-n", "com.hyhytv.app/.MainActivity"])
    time.sleep(3.5)
    capture("v1_home_fresh")

    # 2. Test Tab 'Phim Bộ'
    print("[2] Switching to Phim Bộ (tap X=260, Y=60)...")
    tap(260, 60, delay=2.0)
    capture("v2_phim_bo")

    # 3. Test Tab 'Phim Lẻ'
    print("[3] Switching to Phim Lẻ (tap X=345, Y=60)...")
    tap(345, 60, delay=2.0)
    capture("v3_phim_le")

    # 4. Test Tab 'Tìm Kiếm' (Search)
    print("[4] Switching to Tìm Kiếm (tap X=735, Y=60)...")
    tap(735, 60, delay=1.5)
    capture("v4_search_page")

    # 5. Type keyword in search
    print("[5] Searching for 'tinh'...")
    type_text("tinh")
    time.sleep(2.0)
    capture("v5_search_results")

    # 6. Click on first search result card to open DetailOverlay
    # In search grid, first card is around X=160, Y=440
    print("[6] Opening Detail of first result (tap X=160, Y=440)...")
    tap(160, 440, delay=2.5)
    capture("v6_detail_overlay")

    # 7. Start Playing the Movie
    # "▶ Xem Phim" button in DetailOverlay is around X=150, Y=330
    print("[7] Starting Playback with Netflix Player Hub (tap X=150, Y=330)...")
    tap(150, 330, delay=4.5)
    capture("v7_netflix_player_playing")

    # 8. Test Seek Forward 10s (remote right arrow)
    print("[8] Testing Remote Seek Forward 10s...")
    key("KEYCODE_DPAD_RIGHT", 1, 1.0)
    capture("v8_netflix_player_seek_10s")

    # 9. Test Play / Pause
    print("[9] Testing Play/Pause toggle...")
    key("KEYCODE_MEDIA_PLAY_PAUSE", 1, 1.0)
    capture("v9_netflix_player_pause")
    key("KEYCODE_MEDIA_PLAY_PAUSE", 1, 1.0) # Resume

    # 10. Test Episode Drawer (press key 'E')
    print("[10] Opening Episode Drawer (press 'E')...")
    key("KEYCODE_E", 1, 1.5)
    capture("v10_episode_drawer")

    # 11. Test Next Episode (press key 'N')
    print("[11] Switching to Next Episode directly (press 'N')...")
    key("KEYCODE_N", 1, 3.5)
    capture("v11_next_episode_playing")

    # 12. Exit Player back to Detail (press BACK)
    print("[12] Exiting Player (press BACK)...")
    key("KEYCODE_BACK", 1, 1.5)
    capture("v12_back_to_detail")

    # 13. Exit Detail back to Home
    print("[13] Exiting Detail back to Home...")
    key("KEYCODE_BACK", 1, 1.5)
    tap(160, 60, delay=2.0) # Tap Trang Chủ
    capture("v13_back_to_home")

    print("\n=== ALL COMPREHENSIVE TESTS FINISHED ===")

if __name__ == "__main__":
    main()
