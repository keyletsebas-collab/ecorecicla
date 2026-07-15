# Reciminsa App (v1.16.0)

Este repositorio contiene el código fuente híbrido y nativo para la aplicación de control de Reciminsa.

---

## 📂 Contenido de la Carpeta `/rcapp`

Dentro del directorio `/rcapp` se encuentran los paquetes listos de la última compilación para distribución rápida:
1.  **`ReciminsaApp_Android.apk`**: Instalador nativo firmado de Android para teléfonos y tabletas.
2.  **`Reciminsa_Linux_Patch_v1.16.0.zip`**: Parche de recursos web compilados para actualizaciones rápidas en Linux sin reinstalar.
3.  **`reciminsaapp_linux_src.zip`**: Código fuente de Linux con su estructura limpia listo para empaquetado local.

---

## 🐧 Guía de Linux (Pop!_OS / Ubuntu / Debian)

### A. Ejecutar el Parche de Actualización Rápida
Si ya tienes la aplicación instalada y solo deseas actualizar los recursos web a la versión 1.16.0 (incluyendo gráficos y familias de materiales), ejecuta en la raíz del proyecto:
```bash
# 1. Descomprimir el parche reemplazando los recursos existentes
unzip -o rcapp/Reciminsa_Linux_Patch_v1.16.0.zip

# 2. Iniciar la aplicación
npm start
```

### B. Compilar e Instalar el Paquete `.deb` Nativo
Para compilar un instalador nativo completo en tu máquina local:
```bash
# 1. Descomprimir el código fuente limpio de Linux
unzip rcapp/reciminsaapp_linux_src.zip -d reciminsa_build
cd reciminsa_build

# 2. Instalar dependencias necesarias
npm install

# 3. Compilar el paquete instalador .deb
npm run make

# 4. Instalar en tu sistema operativo
sudo apt install ./out/make/deb/x64/reciminsaapp_1.16.0_amd64.deb
```

---

## 🤖 Guía de Android (MAUI)

El APK ya se encuentra precompilado. Si necesitas recompilar la versión de Android de manera nativa:
```bash
# 1. Asegúrate de tener instalado el workload de dotnet para Android
dotnet workload install android

# 2. Compilar el proyecto en modo Release y Firmado
dotnet publish ReciminsaApp/ReciminsaApp.csproj -f net10.0-android -c Release

# 3. El APK se generará en la ruta:
# ReciminsaApp/bin/Release/net10.0-android/publish/com.companyname.reciminsaapp-Signed.apk
```

---

## 🪟 Guía de Windows (Instalador Mejorado .exe)

Dado que la compilación de WinUI requiere el SDK nativo de Windows, debes ejecutar la compilación desde tu computadora con Windows siguiendo la guía en [compilacion_windows.md](file:///home/keylet/Documentos/ecorecicla/compilacion_windows.md):

```text
1. Clona el repositorio en tu PC con Windows.
2. Abre la consola y ejecuta: "git pull origin main"
3. Elimina carpetas temporales anteriores ("bin" y "obj" en ReciminsaApp).
4. Compila en modo Release autocontenido:
   dotnet publish -f net10.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:PublishSelfContained=true -p:PublishSingleFile=false
5. Copia los archivos del publish a la carpeta de distribución.
6. Compila el instalador usando Inno Setup:
   iscc InnoSetupScript_MAUI.iss
7. El archivo final "Instalar_Reciminsa_Windows.exe" estará listo para distribuir.
```

---

## 🌐 Servidor Local de Desarrollo
Puedes probar y navegar los recursos web de la aplicación directamente abriendo un servidor web HTTP:
```bash
python3 -m http.server 8000
```
Y navegando a: **[http://localhost:8000](http://localhost:8000)**.
