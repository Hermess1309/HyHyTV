@echo off
title Android TV Emulator - HyHyTv
echo ============================================================
echo   Starting Android TV Emulator (HyHyTvTest) from Command Line
echo   Ref: https://developer.android.com/studio/run/emulator-commandline
echo ============================================================

set "PROJECT_DIR=%~dp0"
set "ANDROID_HOME=%PROJECT_DIR%.tools\android-sdk"
set "ANDROID_AVD_HOME=%PROJECT_DIR%.tools\avd"
set "EMULATOR=%ANDROID_HOME%\emulator\emulator.exe"
set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"

REM Clear any stale locks before launching
del /s /q /f "%PROJECT_DIR%.tools\avd\*.lock" 2>nul
for /d /r "%PROJECT_DIR%.tools\avd" %%d in (*.lock) do @rmdir /s /q "%%d" 2>nul

echo [1/3] Checking AVD list...
"%EMULATOR%" -list-avds

echo [2/3] Launching emulator with command:
echo "%EMULATOR%" -avd HyHyTvTest -gpu host -dns-server 8.8.8.8
start "" "%EMULATOR%" -avd HyHyTvTest -gpu host -dns-server 8.8.8.8

echo [3/3] Waiting for Android TV device to connect via ADB...
"%ADB%" wait-for-device

echo Android TV connected! Waiting for boot completion...
:wait_boot
timeout /t 2 /nobreak >nul
for /f "tokens=*" %%a in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do set BOOT=%%a
if not "%BOOT%"=="1" goto wait_boot

echo Boot complete!
echo Installing HyHyTv release APK...
"%ADB%" install -r "%PROJECT_DIR%deliverables\HyHyTv-1.0.0-release.apk"

echo Launching HyHyTv on Android TV...
"%ADB%" shell am start -n com.hyhytv.app/.MainActivity

echo.
echo ============================================================
echo   HyHyTv is now running on the Android TV Emulator!
echo   Use Arrow keys, Enter and Esc to navigate.
echo ============================================================
echo.
pause
