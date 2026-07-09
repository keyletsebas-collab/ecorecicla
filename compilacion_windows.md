# Guía de Compilación de Reciminsa App en Windows (.NET MAUI 9 + Inno Setup)

Este documento contiene las instrucciones y el prompt exacto que debes darle a **Antigravity** en tu computadora con Windows para compilar la aplicación con su instalador formal de forma 100% automática.

---

## 🔗 Repositorio del Proyecto
* **URL de GitHub**: [https://github.com/keyletsebas-collab/ecorecicla.git](https://github.com/keyletsebas-collab/ecorecicla.git)
* **Rama Principal**: `main`

---

## 🛠️ Requisitos Previos en Windows
Para que la compilación funcione correctamente en tu máquina Windows, asegúrate de tener instalado:
1. **Git para Windows**: Para poder sincronizar los últimos cambios.
2. **.NET 9 SDK**: Con el workload de MAUI instalado. Puedes instalarlo abriendo una terminal de administración y ejecutando:
   ```powershell
   dotnet workload install maui
   ```
3. **Inno Setup**: Necesario para compilar el instalador `.exe`. Asegúrate de que la ruta del compilador `ISCC.exe` (por defecto `C:\Program Files (x86)\Inno Setup 6`) esté agregada a las Variables de Entorno del Sistema (**PATH**), para que pueda ser llamado desde cualquier terminal.

---

## 🤖 Prompt para Copiar y Pegar en Antigravity (Windows)

Copia todo el bloque de texto de abajo y pégalo directamente en tu chat con Antigravity en Windows:

```text
Por favor, compila la versión final de la aplicación en .NET MAUI para Windows y genera el instalador formal empaquetado de la siguiente manera:

1. Ve a la carpeta del proyecto en Windows, asegúrate de que el git remote apunta a:
   https://github.com/keyletsebas-collab/ecorecicla.git
2. Ejecuta "git pull origin main" para actualizar el código local con los últimos cambios y el fix de WebView2.
3. Limpia las carpetas temporales anteriores eliminando los directorios "bin" y "obj" dentro de la carpeta "ReciminsaApp".
4. Compila la aplicación de .NET MAUI en modo Release de forma autónoma (Self-Contained), empaquetando todo el framework para que el usuario no necesite descargar .NET por separado:
   dotnet publish -f net9.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:PublishSelfContained=true -p:PublishSingleFile=false
5. Limpia la carpeta "reciminsaapp windows port" y copia dentro de ella todos los archivos de salida generados en la carpeta "ReciminsaApp\bin\Release\net9.0-windows10.0.19041.0\win-x64\publish\".
6. Ejecuta "iscc InnoSetupScript_MAUI.iss" en la raíz del proyecto para compilar el instalador formal (.exe) con el logo oficial de la aplicación.
7. Copia el instalador generado "reciminsaapp_pc_Setup.exe" a tu carpeta de instaladores del escritorio en "C:\Users\<tu-usuario>\Desktop\instaladores rcapp\" con el nombre "Instalar_Reciminsa_Windows.exe".
```
