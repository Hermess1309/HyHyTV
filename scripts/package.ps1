$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $projectRoot 'deliverables'
New-Item -ItemType Directory -Force $outDir | Out-Null
$apk = Join-Path $projectRoot 'app/build/outputs/apk/release/app-release.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Build the release APK first.' }
Copy-Item -LiteralPath $apk -Destination (Join-Path $outDir 'HyHyTv-1.0.0-release.apk') -Force
$zipPath = Join-Path $outDir 'HyHyTv-AndroidStudio-source.zip'
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @('settings.gradle.kts','build.gradle.kts','gradle.properties','gradlew','gradlew.bat','.gitignore','README.md','THIRD_PARTY_NOTICES.md','app/build.gradle.kts','app/proguard-rules.pro','docs/API_VERIFICATION.md','docs/REFERENCE_REVIEW.md','docs/TEST_REPORT.md') | ForEach-Object { Join-Path $projectRoot $_ }
foreach ($folder in @('app/src','app/schemas','scripts','gradle','.github','docs/screenshots')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse | Select-Object -ExpandProperty FullName
}
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in ($files | Sort-Object -Unique)) {
        $relative = [System.IO.Path]::GetRelativePath($projectRoot, $file).Replace('\','/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file, "HyHyTv/$relative", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
Get-FileHash -Algorithm SHA256 (Join-Path $outDir 'HyHyTv-1.0.0-release.apk'),$zipPath |
    ForEach-Object { "$($_.Hash.ToLower())  $([System.IO.Path]::GetFileName($_.Path))" } |
    Set-Content -LiteralPath (Join-Path $outDir 'SHA256SUMS.txt')
Get-ChildItem -LiteralPath $outDir -File | Select-Object Name,Length
