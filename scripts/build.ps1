param([switch]$Release, [switch]$DeviceTest)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    if (-not $env:JAVA_HOME -and (Test-Path .tools/jdk)) {
        $env:JAVA_HOME = (Get-ChildItem .tools/jdk -Directory | Select-Object -First 1).FullName
    }
    if (-not $env:ANDROID_HOME -and (Test-Path .tools/android-sdk)) {
        $env:ANDROID_HOME = (Resolve-Path .tools/android-sdk).Path
    }
    $env:GRADLE_USER_HOME = Join-Path $projectRoot '.tools/gradle-home'
    if ($Release -and -not $env:HYHYTV_KEYSTORE) { & "$PSScriptRoot/new-local-signing.ps1" }
    $tasks = @(':app:assembleDebug', ':app:testDebugUnitTest', ':app:lintDebug')
    if ($Release) { $tasks += ':app:assembleRelease' }
    if ($DeviceTest) { $tasks += ':app:connectedDebugAndroidTest' }
    & .\gradlew.bat @tasks --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
