$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$signingPath = Join-Path $projectRoot '.tools/signing.properties'
if (Test-Path -LiteralPath $signingPath) { return }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to a complete JDK 17 or 21.' }
New-Item -ItemType Directory -Force (Join-Path $projectRoot '.tools') | Out-Null
$keyPath = Join-Path $projectRoot '.tools/hyhytv-local-release.jks'
if (Test-Path -LiteralPath $keyPath) { throw 'A keystore already exists without signing.properties. Restore its password before continuing.' }
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$password = [Convert]::ToBase64String($bytes)
& "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $keyPath -storepass $password -keypass $password -alias hyhytv -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=HyHyTv Local Release,O=HyHyTv,C=VN'
if ($LASTEXITCODE -ne 0) { throw 'Could not create the local signing key.' }
@("storeFile=.tools/hyhytv-local-release.jks", "storePassword=$password", "keyPassword=$password") | Set-Content -LiteralPath $signingPath
Write-Output 'Created a local release key in .tools. Back up the keystore and signing.properties privately for future updates.'
