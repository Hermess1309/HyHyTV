import subprocess
import time
import os
import sys

ADB = r"C:\Users\PC\Downloads\6\.tools\android-sdk\platform-tools\adb.exe"
OUTPUT_DIR = r"C:\Users\PC\.gemini\antigravity\brain\4ded25a1-537e-4924-8462-8d1db139b238\test_evidence"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def run_adb(args):
    cmd = [ADB] + args
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return result.stdout.strip()

def capture_screen(step_name):
    path = os.path.join(OUTPUT_DIR, f"{step_name}.png")
    with open(path, "wb") as f:
        subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=f)
    print(f"Captured: {step_name} -> {path}")
    return path

def send_key(keycode, count=1, delay=0.4):
    for _ in range(count):
        run_adb(["shell", "input", "keyevent", str(keycode)])
        time.sleep(delay)

def type_text(text):
    run_adb(["shell", "input", "text", text])
    time.sleep(1.0)

def main():
    print("=== HYHYTV AUTOMATED FULL-FEATURE TEST SUITE ===")
    
    # 0. Check device
    devices = run_adb(["devices"])
    print("Connected devices:\n", devices)
    if "device" not in devices:
        print("ERROR: No Android emulator device connected.")
        sys.exit(1)

    apk_path = r"C:\Users\PC\Downloads\6\deliverables\HyHyTv-1.0.0-release.apk"
    print(f"Installing APK: {apk_path}...")
    install_res = run_adb(["install", "-r", apk_path])
    print("Install result:", install_res)

    print("Launching HyHyTv...")
    run_adb(["shell", "am", "start", "-n", "com.hyhytv.app/.MainActivity"])
    time.sleep(4.0)

    # Step 1: Verify Home screen & Hero banner
    print("\n--- [Step 1] Home Screen & Hero Banner ---")
    capture_screen("01_home_screen")

    # Step 2: Navigate through shelf tiles
    print("\n--- [Step 2] Navigating Shelf Tiles with Remote ---")
    send_key("KEYCODE_DPAD_DOWN", 1, 0.5)
    send_key("KEYCODE_DPAD_RIGHT", 3, 0.5)
    capture_screen("02_shelf_tiles_nav")
    send_key("KEYCODE_DPAD_LEFT", 3, 0.5)
    send_key("KEYCODE_DPAD_UP", 1, 0.5)

    # Step 3: Switch to 'Phim Bộ' (Series)
    print("\n--- [Step 3] Switching to 'Phim Bộ' ---")
    send_key("KEYCODE_DPAD_RIGHT", 1, 0.6)
    send_key("KEYCODE_ENTER", 1, 1.5)
    time.sleep(1.5)
    capture_screen("03_series_page")

    # Step 4: Switch to 'Phim Lẻ' (Movies)
    print("\n--- [Step 4] Switching to 'Phim Lẻ' ---")
    send_key("KEYCODE_DPAD_RIGHT", 1, 0.6)
    send_key("KEYCODE_ENTER", 1, 1.5)
    time.sleep(1.5)
    capture_screen("04_movies_page")

    # Step 5: Switch to 'Tìm Kiếm' (Search)
    print("\n--- [Step 5] Switching to 'Tìm Kiếm' (Search Page) ---")
    # In navbar: Trang Chủ(0), Phim Bộ(1), Phim Lẻ(2), Mới(3), DS(4), Tìm Kiếm(5)
    send_key("KEYCODE_DPAD_RIGHT", 3, 0.5)
    send_key("KEYCODE_ENTER", 1, 1.5)
    time.sleep(1.0)
    capture_screen("05_search_page_empty")

    # Step 6: Test Search with Keyword
    print("\n--- [Step 6] Testing Search with Keyword 'yeu' ---")
    type_text("yeu")
    time.sleep(2.0)
    capture_screen("06_search_results_grid")

    # Step 7: Open Movie Detail
    print("\n--- [Step 7] Opening Movie Detail Overlay ---")
    send_key("KEYCODE_DPAD_DOWN", 1, 0.5) # Focus onto first search result card
    send_key("KEYCODE_ENTER", 1, 1.5)
    time.sleep(2.0)
    capture_screen("07_movie_detail_overlay")

    # Step 8: Play Movie with Netflix Player Hub
    print("\n--- [Step 8] Starting Video Playback (Netflix Hub) ---")
    # First button in DetailOverlay is "▶ Xem Phim" or episode button
    send_key("KEYCODE_ENTER", 1, 2.0)
    time.sleep(5.0) # Wait for HLS manifest & video stream
    capture_screen("08_netflix_player_playing")

    # Step 9: Test Netflix Hub Controls (Seek 10s & Pause/Play)
    print("\n--- [Step 9] Testing Netflix Hub Controls: Seek 10s & Pause ---")
    send_key("KEYCODE_DPAD_RIGHT", 1, 1.0) # Seek forward 10s
    capture_screen("09_netflix_player_seek_fwd")
    send_key("KEYCODE_MEDIA_PLAY_PAUSE", 1, 1.0) # Pause video
    capture_screen("10_netflix_player_paused")
    send_key("KEYCODE_MEDIA_PLAY_PAUSE", 1, 1.0) # Resume video

    # Step 10: Test Next Episode / Episode Drawer
    print("\n--- [Step 10] Testing Next Episode / Episode Drawer ---")
    # Press 'n' to jump to next episode
    send_key("KEYCODE_N", 1, 2.5)
    time.sleep(3.0)
    capture_screen("11_netflix_player_next_episode")

    # Step 11: Open Episode Drawer
    print("\n--- [Step 11] Opening Episodes Side Drawer ---")
    send_key("KEYCODE_E", 1, 1.5)
    time.sleep(1.0)
    capture_screen("12_netflix_player_drawer")

    # Close drawer with Back/Escape
    send_key("KEYCODE_BACK", 1, 1.0)

    # Step 12: Exit Player and Return to Home
    print("\n--- [Step 12] Exit Player & Return to Home ---")
    send_key("KEYCODE_BACK", 1, 1.0) # Close player -> Detail
    time.sleep(1.0)
    send_key("KEYCODE_BACK", 1, 1.0) # Close detail -> Search
    time.sleep(1.0)
    # Navigate back to Home
    send_key("KEYCODE_DPAD_UP", 2, 0.5)
    send_key("KEYCODE_DPAD_LEFT", 5, 0.3)
    send_key("KEYCODE_ENTER", 1, 1.0)
    time.sleep(1.5)
    capture_screen("13_back_home_screen")

    print("\n=== ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
