# Script de Compilación Automática para Windows (.NET MAUI + Inno Setup)
# Este script realiza la compilación completa sin modificar el código fuente.

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO COMPILACION AUTOMATICA RECIMINSA APP (WINDOWS)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Sincronizar Recursos Web
Write-Host "`n[Paso 1/6] Sincronizando recursos web..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    node build.js
    Write-Host "✅ Recursos web sincronizados correctamente." -ForegroundColor Green
} else {
    Write-Warning "⚠️ Node.js no fue detectado en el PATH. Se omitió la sincronización de web."
}

# 2. Limpieza de carpetas de compilación previa
Write-Host "`n[Paso 2/6] Limpiando carpetas temporales..." -ForegroundColor Yellow
$appDir = Join-Path $PSScriptRoot "ReciminsaApp"
$binDir = Join-Path $appDir "bin"
$objDir = Join-Path $appDir "obj"
$portDir = Join-Path $PSScriptRoot "reciminsaapp windows port"

if (Test-Path $binDir) { Remove-Item -Path $binDir -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path $objDir) { Remove-Item -Path $objDir -Recurse -Force -ErrorAction SilentlyContinue }

if (-not (Test-Path $portDir)) {
    New-Item -ItemType Directory -Path $portDir | Out-Null
} else {
    Get-ChildItem -Path $portDir -Exclude "*.ico" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "✅ Limpieza completada." -ForegroundColor Green

# 3. Determinar Target Framework (.NET 10 con fallback a .NET 9)
$targetFx = "net10.0-windows10.0.19041.0"
$sdks = dotnet --list-sdks 2>&1
if ($sdks -notmatch "10\.") {
    if ($sdks -match "9\.") {
        $targetFx = "net9.0-windows10.0.19041.0"
        Write-Host "ℹ️ SDK .NET 10 no detectado. Utilizando fallback: $targetFx" -ForegroundColor Yellow
    }
}
Write-Host "`n[Paso 3/6] Compilando .NET MAUI Release ($targetFx)..." -ForegroundColor Yellow

# 4. Compilar .NET MAUI con flags Win32 Desempaquetadas (None PackageType)
$csproj = Join-Path $appDir "ReciminsaApp.csproj"
$dotnetArgs = @(
    "publish",
    "`"$csproj`"",
    "-f", $targetFx,
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:WindowsPackageType=None",
    "-p:WindowsAppSDKSelfContained=true",
    "-p:PublishSingleFile=false"
)

$cmdString = "dotnet " + ($dotnetArgs -join " ")
Write-Host "Ejecutando: $cmdString" -ForegroundColor Gray
Invoke-Expression $cmdString

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Error en la compilación de .NET MAUI." -ForegroundColor Red
    Write-Host "Por favor verifica que la carga de trabajo MAUI esté instalada: dotnet workload install maui" -ForegroundColor Red
    exit 1
}

# 5. Copiar binarios al puerto de Inno Setup
Write-Host "`n[Paso 4/6] Copiando archivos de salida..." -ForegroundColor Yellow
$publishDir = Join-Path $appDir "bin\Release\$targetFx\win-x64\publish"
if (-not (Test-Path $publishDir)) {
    Write-Host "❌ No se encontró la carpeta de publicación: $publishDir" -ForegroundColor Red
    exit 1
}
Copy-Item -Path "$publishDir\*" -Destination $portDir -Recurse -Force
Write-Host "✅ Binarios copiados a '$portDir'." -ForegroundColor Green

# 6. Compilar Instalador con Inno Setup
Write-Host "`n[Paso 5/6] Buscando compilador de Inno Setup (ISCC)..." -ForegroundColor Yellow
$isccPath = $null

if (Get-Command iscc -ErrorAction SilentlyContinue) {
    $isccPath = "iscc"
} else {
    $possiblePaths = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe"
    )
    foreach ($p in $possiblePaths) {
        if (Test-Path $p) {
            $isccPath = "& `"$p`""
            break
        }
    }
}

if (-not $isccPath) {
    Write-Host "⚠️ Inno Setup (ISCC.exe) no fue encontrado." -ForegroundColor Red
    Write-Host "Puedes instalarlo desde PowerShell con:" -ForegroundColor Yellow
    Write-Host "winget install --id JRSoftware.InnoSetup -e --source winget" -ForegroundColor Yellow
    exit 1
}

$issFile = Join-Path $PSScriptRoot "InnoSetupScript_MAUI.iss"
Write-Host "Compilando instalador Inno Setup: $issFile" -ForegroundColor Gray
Invoke-Expression "$isccPath `"$issFile`""

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al generar el instalador con Inno Setup." -ForegroundColor Red
    exit 1
}

# 7. Despliegue del Instalador al Escritorio / Instaladores
Write-Host "`n[Paso 6/6] Copiando instalador generado..." -ForegroundColor Yellow
$setupFile = Join-Path $PSScriptRoot "reciminsaapp_pc_Setup.exe"
if (Test-Path $setupFile) {
    $userDesktopFolder = Join-Path $env:USERPROFILE "Desktop\instaladores rcapp"
    if (-not (Test-Path $userDesktopFolder)) {
        New-Item -ItemType Directory -Path $userDesktopFolder -Force | Out-Null
    }
    $destInstaller = Join-Path $userDesktopFolder "Instalar_Reciminsa_Windows.exe"
    Copy-Item -Path $setupFile -Destination $destInstaller -Force
    Write-Host "🎉 ¡PROCESO COMPLETADO CON ÉXITO!" -ForegroundColor Green
    Write-Host "📦 Instalador generado en:" -ForegroundColor Green
    Write-Host "   -> $setupFile" -ForegroundColor Cyan
    Write-Host "   -> $destInstaller" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ El instalador reciminsaapp_pc_Setup.exe no se encontró en la raíz." -ForegroundColor Yellow
}
