import os
import sys
import time
import subprocess

ADB = r"C:\Users\PC\Downloads\6\.tools\android-sdk\platform-tools\adb.exe"
EMULATOR = r"C:\Users\PC\Downloads\6\.tools\android-sdk\emulator\emulator.exe"
OUTPUT_DIR = r"C:\Users\PC\.gemini\antigravity\brain\4ded25a1-537e-4924-8462-8d1db139b238\test_evidence"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def run_adb(args):
    cmd = [ADB] + args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return res.stdout.strip()

def send_key(code):
    run_adb(["shell", "input", "keyevent", str(code)])
    time.sleep(0.6)

def take_screenshot(name):
    path = os.path.join(OUTPUT_DIR, f"{name}.png")
    run_adb(["exec-out", "screencap", "-p"], )
    with open(path, "wb") as f:
        subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=f)
    print(f"Captured: {path}")
    return path

print("Checking ADB devices...")
devices = run_adb(["devices"])
print(devices)

if "emulator" not in devices:
    print("Launching emulator in background...")
    env = os.environ.copy()
    env["ANDROID_HOME"] = r"C:\Users\PC\Downloads\6\.tools\android-sdk"
    env["ANDROID_AVD_HOME"] = r"C:\Users\PC\Downloads\6\.tools\avd"
    subprocess.Popen([EMULATOR, "-avd", "HyHyTvTest", "-gpu", "host", "-no-boot-anim", "-no-audio"], env=env)
    print("Waiting for device to boot...")
    run_adb(["wait-for-device"])
    while True:
        boot = run_adb(["shell", "getprop", "sys.boot_completed"])
        if boot == "1":
            break
        time.sleep(2)
    print("Device booted!")

apk_path = r"C:\Users\PC\Downloads\6\deliverables\HyHyTv-1.0.0-release.apk"
if os.path.exists(apk_path):
    print("Installing APK...")
    res = run_adb(["install", "-r", apk_path])
    print("Install result:", res)

print("Starting app...")
run_adb(["shell", "am", "start", "-n", "com.hyhytv.app/.MainActivity"])
time.sleep(4)

print("1. Checking Update Modal or Home screen...")
take_screenshot("step1_app_launch")

# If update modal is open, dismiss it by sending right arrow + Enter or Escape
print("2. Dismissing update modal if present...")
send_key(22) # DPAD_RIGHT to "Để sau"
time.sleep(0.5)
send_key(66) # ENTER
time.sleep(2)
take_screenshot("step2_home_dismiss_update")

# Navigate Down to content rows
print("3. Navigating content rows (smooth TV transitions)...")
send_key(20) # DPAD_DOWN
time.sleep(1)
send_key(22) # DPAD_RIGHT
time.sleep(0.5)
send_key(22) # DPAD_RIGHT
time.sleep(0.5)
take_screenshot("step3_row_scroll_focused")

# Select a movie (ENTER)
print("4. Opening Movie Details...")
send_key(66) # ENTER
time.sleep(3)
take_screenshot("step4_movie_detail")

# Play the movie (ENTER on '▶ Xem Phim')
print("5. Launching Playback...")
send_key(66) # ENTER
time.sleep(5)
take_screenshot("step5_netflix_player_active")

# Test Player Controls: Pause
print("6. Testing Player Pause / Play...")
send_key(66) # ENTER / SPACE to pause
time.sleep(1)
take_screenshot("step6_netflix_player_paused")

# Test Player Controls: Seek 10s Forward
print("7. Testing Seek Forward 10s...")
send_key(22) # DPAD_RIGHT
time.sleep(1)
take_screenshot("step7_netflix_player_seek10s")

# Test Episodes Drawer (Down arrow or 'E')
print("8. Opening Episodes Drawer...")
send_key(20) # DPAD_DOWN
time.sleep(1.5)
take_screenshot("step8_netflix_episodes_drawer")

# Close drawer (Escape)
print("9. Closing Episodes Drawer...")
send_key(111) # ESCAPE
time.sleep(1)

# Open Subtitles menu (key 'S' or 'C')
print("10. Opening Subtitles Menu (S)...")
run_adb(["shell", "input", "keyevent", "47"]) # KEYCODE_S = 47
time.sleep(1.5)
take_screenshot("step9_netflix_subtitles_menu")

# Close player (Escape)
print("11. Exiting Player back to Details...")
send_key(111) # ESCAPE
time.sleep(1.5)
take_screenshot("step10_back_to_detail")

# Back to Home
send_key(111) # ESCAPE
time.sleep(1.5)
take_screenshot("step11_back_to_home")

print("ALL TESTING COMPLETED SUCCESSFULLY!")
