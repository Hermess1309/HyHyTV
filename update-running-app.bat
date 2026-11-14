@echo off
title Update HyHyTv on Running Emulator
set "PROJECT_DIR=%~dp0"
set "ADB=%PROJECT_DIR%.tools\android-sdk\platform-tools\adb.exe"

echo Waiting for Android TV emulator...
"%ADB%" wait-for-device

echo Installing updated HyHyTv APK...
"%ADB%" install -r "%PROJECT_DIR%deliverables\HyHyTv-1.0.0-release.apk"

echo Re-launching HyHyTv...
"%ADB%" shell am start -n com.hyhytv.app/.MainActivity

echo.
echo ============================================================
echo   Update completed successfully!
echo   You can now test the new Netflix Hub, Episode Switcher,
echo   and Search Grid on the emulator.
echo ============================================================
pause
