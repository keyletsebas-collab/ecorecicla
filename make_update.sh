#!/bin/bash
# ==============================================================================
# SCRIPT DE AUTOMATIZACIÓN DE COMPILACIÓN: PARCHES Y VERSIONES
# ==============================================================================
# Uso:
#   ./make_update.sh [patch|version] [numero_version]
# Ejemplos:
#   ./make_update.sh patch 1.0.17
#   ./make_update.sh version 1.1.0
# ==============================================================================

TYPE=$1
VERSION=$2

if [ -z "$TYPE" ] || [ -z "$VERSION" ]; then
    echo "❌ Error: Faltan argumentos."
    echo "Uso: ./make_update.sh [patch|version] [numero_version]"
    exit 1
fi

if [ "$TYPE" != "patch" ] && [ "$TYPE" != "version" ]; then
    echo "❌ Error: Tipo inválido. Debe ser 'patch' o 'version'."
    exit 1
fi

echo "===================================================================="
echo "🚀 Iniciando proceso para [$TYPE] con versión [$VERSION]..."
echo "===================================================================="

# Rutas principales
BASE_DIR="/home/keylet/Escritorio/Proyectos/Reciminsa archivos app"
APP_DIR="$BASE_DIR/Reciminsa app"
ANDROID_DIR="$APP_DIR/ReciminsaApp"
WINDOWS_PORT_DIR="$BASE_DIR/reciminsaapp windows port"
INSTALLER_DIR="$BASE_DIR/instaladores rcapp"

# Extraer el último número (patch) y los dos primeros (major/minor)
VERSION_CODE=$(echo "$VERSION" | cut -d'.' -f3)
if [ -z "$VERSION_CODE" ]; then
    VERSION_CODE="0"
fi

echo "📦 1. Actualizando versión en archivos de configuración..."

# A. package.json
if [ -f "$APP_DIR/package.json" ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/g" "$APP_DIR/package.json"
    echo "  - package.json actualizado."
fi

# B. version.json
if [ -f "$APP_DIR/version.json" ]; then
    echo "{\"Version\":\"v$VERSION\",\"DownloadUrl\":\"https://github.com/keyletsebas-collab/ecorecicla/raw/main/Instalar_Reciminsa.exe\"}" > "$APP_DIR/version.json"
    echo "  - version.json actualizado."
fi

# C. settings.js (tanto local como en proyectos de puerto)
if [ -f "$APP_DIR/www/js/settings.js" ]; then
    sed -i "s/const APP_VERSION = '[^']*'/const APP_VERSION = 'v$VERSION'/g" "$APP_DIR/www/js/settings.js"
    echo "  - settings.js local actualizado."
fi

# D. MainPage.xaml.cs (Android)
if [ -f "$ANDROID_DIR/MainPage.xaml.cs" ]; then
    sed -i "s/private const string CurrentVersion = \"[^\"]*\"/private const string CurrentVersion = \"v$VERSION\"/g" "$ANDROID_DIR/MainPage.xaml.cs"
    echo "  - MainPage.xaml.cs (Android) actualizado."
fi

# E. ReciminsaApp.csproj (Android)
if [ -f "$ANDROID_DIR/ReciminsaApp.csproj" ]; then
    sed -i "s/<ApplicationDisplayVersion>[^<]*<\/ApplicationDisplayVersion>/<ApplicationDisplayVersion>$VERSION<\/ApplicationDisplayVersion>/g" "$ANDROID_DIR/ReciminsaApp.csproj"
    sed -i "s/<ApplicationVersion>[^<]*<\/ApplicationVersion>/<ApplicationVersion>$VERSION_CODE<\/ApplicationVersion>/g" "$ANDROID_DIR/ReciminsaApp.csproj"
    echo "  - ReciminsaApp.csproj (Android) actualizado."
fi

# F. ReciminsaApp.csproj (Windows Port)
WINDOWS_CS="$WINDOWS_PORT_DIR/Reciminsa app/ReciminsaApp/ReciminsaApp.csproj"
if [ -f "$WINDOWS_CS" ]; then
    sed -i "s/<ApplicationDisplayVersion>[^<]*<\/ApplicationDisplayVersion>/<ApplicationDisplayVersion>$VERSION<\/ApplicationDisplayVersion>/g" "$WINDOWS_CS"
    sed -i "s/<ApplicationVersion>[^<]*<\/ApplicationVersion>/<ApplicationVersion>$VERSION_CODE<\/ApplicationVersion>/g" "$WINDOWS_CS"
    echo "  - ReciminsaApp.csproj (Windows Port) actualizado."
fi

echo "🔄 2. Sincronizando recursos web (JS, CSS, HTML)..."
# Copiar recursos a Android wwwroot
if [ -d "$ANDROID_DIR/wwwroot" ]; then
    cp -r "$APP_DIR/www/"* "$ANDROID_DIR/wwwroot/"
    echo "  - Recursos copiados a Android wwwroot."
fi

# Copiar recursos a Windows Port wwwroot
if [ -d "$WINDOWS_PORT_DIR/wwwroot" ]; then
    cp -r "$APP_DIR/www/"* "$WINDOWS_PORT_DIR/wwwroot/"
    echo "  - Recursos copiados a Windows Port wwwroot."
fi

echo "🛠 3. Compilando y empaquetando plataformas..."

# --- ANDROID ---
echo "🤖 Compilando Android APK..."
rm -rf "$ANDROID_DIR/bin" "$ANDROID_DIR/obj"
cd "$ANDROID_DIR"
/home/keylet/.dotnet/dotnet publish -f net10.0-android -c Release
APK_SRC="$ANDROID_DIR/bin/Release/net10.0-android/publish/com.companyname.reciminsaapp-Signed.apk"
if [ -f "$APK_SRC" ]; then
    cp "$APK_SRC" "$INSTALLER_DIR/com.companyname.reciminsaapp-Signed.apk"
    cp "$APK_SRC" "$INSTALLER_DIR/Instalar_Reciminsa_v${VERSION}_MAUI.apk"
    cp "$APK_SRC" "/home/keylet/Escritorio/instaladores rcapp/ReciminsaApp_Android.apk"
    touch "$INSTALLER_DIR/"* "/home/keylet/Escritorio/instaladores rcapp/ReciminsaApp_Android.apk"
    echo "✅ Android APK copiado a instaladores."
else
    echo "❌ Error: No se encontró el APK compilado en $APK_SRC"
fi

# --- WINDOWS ---
echo "🪟 Compilando Instalador de Windows con Inno Setup..."
cd "$APP_DIR"
# Asegurar la versión correcta en el script de Inno Setup
sed -i "s/AppVersion=[0-9\.]*/AppVersion=${VERSION}/g" InnoSetupScript_MAUI.iss
# Ejecutar el compilador ISCC bajo Wine
wine /home/keylet/.wine/drive_c/inno/ISCC.exe InnoSetupScript_MAUI.iss
SETUP_EXE="$APP_DIR/reciminsaapp_pc_Setup.exe"
if [ -f "$SETUP_EXE" ]; then
    cp "$SETUP_EXE" "$INSTALLER_DIR/Instalar_Reciminsa_Windows_v${VERSION}.exe"
    rm -f "$SETUP_EXE"
    echo "✅ Instalador de Windows creado en: $INSTALLER_DIR/Instalar_Reciminsa_Windows_v${VERSION}.exe"
else
    echo "❌ Error: No se pudo generar el instalador de Windows."
fi

# --- LINUX ---
if [ "$TYPE" == "version" ]; then
    echo "🐧 Compilando Linux Deb (Versión Completa)..."
    cd "$APP_DIR"
    rm -rf out/
    npm run make
    # Buscar el deb generado
    DEB_FILE=$(find out/make/ -name "*.deb" | head -n 1)
    if [ -n "$DEB_FILE" ]; then
        cp "$DEB_FILE" "$INSTALLER_DIR/reciminsaapp_${VERSION}_amd64.deb"
        cp "$DEB_FILE" "/home/keylet/Escritorio/instaladores rcapp/reciminsaapp_${VERSION}_amd64.deb"
        echo "✅ Linux Deb copiado a instaladores."
    else
        echo "❌ Warning: No se encontró el paquete .deb compilado."
    fi
else
    echo "🐧 Empaquetando Parche de Linux (Solo recursos web)..."
    cd "$APP_DIR"
    ZIP_DEST="$INSTALLER_DIR/Reciminsa_Linux_Patch_v${VERSION}.zip"
    zip -q -r "$ZIP_DEST" www/
    echo "✅ Parche de Linux creado en: $ZIP_DEST"
fi

# --- DESKTOP SYNC ---
DESKTOP_RCAPP="/home/keylet/Escritorio/rcapp"
echo "📂 Sincronizando instaladores definitivos con el Escritorio..."
mkdir -p "$DESKTOP_RCAPP"
rm -rf "$DESKTOP_RCAPP"/*
# Copiar APK
if [ -f "$INSTALLER_DIR/Instalar_Reciminsa_v${VERSION}_MAUI.apk" ]; then
    cp "$INSTALLER_DIR/Instalar_Reciminsa_v${VERSION}_MAUI.apk" "$DESKTOP_RCAPP/"
fi
# Copiar Windows Installer
if [ -f "$INSTALLER_DIR/Instalar_Reciminsa_Windows_v${VERSION}.exe" ]; then
    cp "$INSTALLER_DIR/Instalar_Reciminsa_Windows_v${VERSION}.exe" "$DESKTOP_RCAPP/"
fi
# Copiar Linux Patch o Deb
if [ -f "$INSTALLER_DIR/Reciminsa_Linux_Patch_v${VERSION}.zip" ]; then
    cp "$INSTALLER_DIR/Reciminsa_Linux_Patch_v${VERSION}.zip" "$DESKTOP_RCAPP/"
fi
if [ -f "$INSTALLER_DIR/reciminsaapp_${VERSION}_amd64.deb" ]; then
    cp "$INSTALLER_DIR/reciminsaapp_${VERSION}_amd64.deb" "$DESKTOP_RCAPP/"
fi
touch "$DESKTOP_RCAPP"/* 2>/dev/null

echo "===================================================================="
echo "🎉 ¡PROCESO FINALIZADO CON ÉXITO!"
echo "Los instaladores de la versión/parche $VERSION están listos en:"
echo "👉 $INSTALLER_DIR"
echo "👉 $DESKTOP_RCAPP (Escritorio)"
echo "===================================================================="
