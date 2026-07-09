# Instrucción de Compilación del Proyecto Reciminsa App (Windows)

Este archivo contiene la instrucción directa para **Antigravity (Windows)**. 

Si eres Antigravity y estás leyendo esto, ejecuta los siguientes pasos de forma secuencial y autónoma para compilar y empaquetar la aplicación en .NET MAUI:

---

## 📋 Pasos a Ejecutar

### Paso 1: Inicialización y Descarga de Cambios
1. Abre una terminal de PowerShell en la raíz del proyecto.
2. Asegúrate de que estás en la rama principal (`main`). Si el usuario descargó el código como `.zip`, este paso ya estará al día. De lo contrario, ejecuta:
   ```powershell
   git pull origin main
   ```

### Paso 2: Limpieza de Caché del Proyecto
1. Ve a la carpeta `ReciminsaApp`.
2. Elimina por completo las carpetas temporales de compilación previa:
   * Directorio `bin`
   * Directorio `obj`
   * Esto evitará conflictos de caché entre distintas plataformas o versiones antiguas del framework.

### Paso 3: Compilación Autónoma en .NET MAUI 9/10
1. Ejecuta el comando de publicación para Windows en modo **Release** y de forma **auto-contenida** (Self-Contained). Esto empaquetará todas las dependencias de .NET MAUI y del framework dentro de la app para que el usuario final no tenga que instalar .NET en su computadora:
   ```powershell
   dotnet publish -f net9.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:PublishSelfContained=true -p:PublishSingleFile=false
   ```

### Paso 4: Sincronización de Binarios en el Port de Instalación
1. Limpia por completo el contenido de la carpeta `reciminsaapp windows port` (a excepción del archivo `appicon.ico`).
2. Copia todos los archivos de salida generados en el paso de publicación:
   * **Origen**: `ReciminsaApp\bin\Release\net9.0-windows10.0.19041.0\win-x64\publish\*`
   * **Destino**: `reciminsaapp windows port\`

### Paso 5: Generación del Instalador Formal (Inno Setup)
1. Ejecuta el compilador de Inno Setup desde la línea de comandos para empaquetar la aplicación con su instalador formal y su icono de reciclaje correspondiente:
   ```powershell
   iscc InnoSetupScript_MAUI.iss
   ```

### Paso 6: Despliegue del Instalador en el Escritorio
1. Copia el archivo instalador resultante en la carpeta de instaladores del usuario:
   * **Origen**: `reciminsaapp_pc_Setup.exe`
   * **Destino**: `C:\Users\<nombre-de-usuario>\Desktop\instaladores rcapp\Instalar_Reciminsa_Windows.exe`
     *(Reemplaza `<nombre-de-usuario>` por el nombre del perfil actual de Windows).*

---

> 📢 **Nota para el Usuario**: 
> Puedes arrastrar este archivo al chat de Antigravity en Windows o indicarle: 
> *"Lee el archivo prompt_antigravity_windows.md en la carpeta instaladores rcapp y ejecuta los pasos de compilación"*.
