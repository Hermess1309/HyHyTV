# Start Android TV Emulator from Command Line
# Ref: https://developer.android.com/studio/run/emulator-commandline

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:ANDROID_HOME = Join-Path $projectDir ".tools\android-sdk"
$env:ANDROID_AVD_HOME = Join-Path $projectDir ".tools\avd"
$emulator = Join-Path $env:ANDROID_HOME "emulator\emulator.exe"
$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Starting Android TV Emulator from Command Line" -ForegroundColor Cyan
Write-Host "  Command: emulator -avd HyHyTvTest -gpu host" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. List AVDs
Write-Host "`n[1/3] Available AVDs:" -ForegroundColor Yellow
& $emulator -list-avds

# 2. Start Emulator
Write-Host "`n[2/3] Launching emulator (HyHyTvTest)..." -ForegroundColor Yellow
Start-Process -FilePath $emulator -ArgumentList "-avd", "HyHyTvTest", "-gpu", "host", "-dns-server", "8.8.8.8"

# 3. Wait for device
Write-Host "`n[3/3] Waiting for Android TV to boot..." -ForegroundColor Yellow
& $adb wait-for-device

do {
    Start-Sleep -Seconds 2
    $boot = (& $adb shell getprop sys.boot_completed 2>$null)
} while ($boot -notmatch "1")

Write-Host "Boot completed!" -ForegroundColor Green

# 4. Install & Launch
Write-Host "Installing HyHyTv release APK..." -ForegroundColor Yellow
$apkPath = Join-Path $projectDir "deliverables\HyHyTv-1.0.0-release.apk"
& $adb install -r $apkPath

Write-Host "Launching HyHyTv on Android TV..." -ForegroundColor Green
& $adb shell am start -n com.hyhytv.app/.MainActivity

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  HyHyTv is now running on the Android TV Emulator!" -ForegroundColor Cyan
Write-Host "  Use Arrow keys, Enter and Esc / Back to navigate." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
