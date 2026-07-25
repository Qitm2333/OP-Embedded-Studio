$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Resolve-Path (Join-Path $ProjectDir "..\..")
$PortableDir = Join-Path $RepoDir ".android-portable"
$DownloadsDir = Join-Path $PortableDir "downloads"
$JdkRoot = Join-Path $PortableDir "jdk-17"
$SdkRoot = Join-Path $PortableDir "android-sdk"
$GradleRoot = Join-Path $PortableDir "gradle-8.9"
$OutputDir = Join-Path $RepoDir "dist\android"

function Get-PortableArchive([string]$Uri, [string]$Destination) {
    if (Test-Path -LiteralPath $Destination) {
        & cmd.exe /d /c "tar.exe -tf `"$Destination`" >nul 2>nul"
        if ($LASTEXITCODE -eq 0) { return }
    }
    Write-Host "Downloading $Uri"
    & curl.exe -L --fail --retry 3 --retry-delay 2 --continue-at - --output $Destination $Uri
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Uri" }
}

New-Item -ItemType Directory -Force -Path $DownloadsDir, $OutputDir | Out-Null

if (-not (Test-Path -LiteralPath $JdkRoot)) {
    $jdkArchive = Join-Path $DownloadsDir "temurin-jdk17.zip"
    $jdkExtract = Join-Path $PortableDir "jdk-17-extracted"
    Get-PortableArchive "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse" $jdkArchive
    New-Item -ItemType Directory -Force -Path $jdkExtract | Out-Null
    Expand-Archive -LiteralPath $jdkArchive -DestinationPath $jdkExtract -Force
    $jdkDirectory = Get-ChildItem -LiteralPath $jdkExtract -Directory | Select-Object -First 1
    if (-not $jdkDirectory) { throw "JDK archive did not contain a directory" }
    Copy-Item -LiteralPath $jdkDirectory.FullName -Destination $JdkRoot -Recurse
}

$sdkManager = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path -LiteralPath $sdkManager)) {
    $toolsArchive = Join-Path $DownloadsDir "android-command-line-tools-15859902.zip"
    $toolsExtract = Join-Path $PortableDir "android-command-line-15859902"
    Get-PortableArchive "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip" $toolsArchive
    $toolsHash = (Get-FileHash -LiteralPath $toolsArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($toolsHash -ne "90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a") {
        throw "Android command-line tools checksum mismatch"
    }
    New-Item -ItemType Directory -Force -Path $toolsExtract | Out-Null
    & tar.exe -xf $toolsArchive -C $toolsExtract
    if ($LASTEXITCODE -ne 0) { throw "Android command-line tools extraction failed" }
    $latestDir = Join-Path $SdkRoot "cmdline-tools\latest"
    New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
    Copy-Item -Path (Join-Path $toolsExtract "cmdline-tools\*") -Destination $latestDir -Recurse -Force
}

if (-not (Test-Path -LiteralPath $GradleRoot)) {
    $gradleArchive = Join-Path $DownloadsDir "gradle-8.9-bin.zip"
    Get-PortableArchive "https://mirrors.cloud.tencent.com/gradle/gradle-8.9-bin.zip" $gradleArchive
    $gradleHash = (Get-FileHash -LiteralPath $gradleArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($gradleHash -ne "d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab") {
        throw "Gradle archive checksum mismatch"
    }
    Expand-Archive -LiteralPath $gradleArchive -DestinationPath $PortableDir -Force
}

$env:JAVA_HOME = $JdkRoot
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:PATH = "$JdkRoot\bin;$SdkRoot\platform-tools;$env:PATH"

$licensesMarker = Join-Path $SdkRoot ".openpencil-licenses-accepted"
if (-not (Test-Path -LiteralPath $licensesMarker)) {
    Write-Host "Accepting Android SDK licenses"
    $licenseInput = Join-Path $PortableDir "android-license-input.txt"
    ((1..80 | ForEach-Object { "y" }) -join [Environment]::NewLine) |
        Set-Content -LiteralPath $licenseInput -Encoding Ascii
    & cmd.exe /d /s /c "`"$sdkManager`" --sdk_root=`"$SdkRoot`" --licenses < `"$licenseInput`""
    if ($LASTEXITCODE -ne 0) { throw "Android SDK license acceptance failed" }
    Remove-Item -LiteralPath $licenseInput -Force
    New-Item -ItemType File -Force -Path $licensesMarker | Out-Null
}

Write-Host "Preparing Android SDK packages"
& $sdkManager "--sdk_root=$SdkRoot" "platform-tools" "platforms;android-35" "build-tools;34.0.0" "build-tools;35.0.0"
if ($LASTEXITCODE -ne 0) { throw "Android SDK package installation failed" }

$gradle = Join-Path $GradleRoot "bin\gradle.bat"
Write-Host "Building OP Embedded BLE APK"
& $gradle --project-dir $ProjectDir :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Android APK build failed" }

$apkSource = Join-Path $ProjectDir "app\build\outputs\apk\debug\app-debug.apk"
$apkDestination = Join-Path $OutputDir "OP-Embedded-BLE-debug.apk"
Copy-Item -LiteralPath $apkSource -Destination $apkDestination -Force
Write-Host "APK ready: $apkDestination"
