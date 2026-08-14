# 🤖 Prompt de Compilación Oficial para Antigravity en Windows (v1.16.1 Parche 1)

Copiar y pegar este bloque en Antigravity (Windows):

```text
Hola Antigravity. Por favor, ejecuta la compilación final de Reciminsa App v1.16.1 (Parche 1) para Windows y genera su instalador ejecutable oficial con Inno Setup siguiendo estas instrucciones:

1. Abre una consola de PowerShell en la raíz de este proyecto.
2. Ejecuta "git pull origin main" para estar seguro de tener los últimos cambios del repositorio.
3. Ejecuta el script oficial de compilación automática que se encuentra en la raíz del proyecto:
   powershell -ExecutionPolicy Bypass -File .\build_windows.ps1

REGLAS ESTRICTAS E INVIOLABLES DE SEGURIDAD:
- Queda estrictamente PROHIBIDO modificar, editar o borrar archivos de código fuente (.cs, .xaml, .js, .html, .css, .csproj).
- Toda la lógica de compilación (.NET MAUI Win32 desempaquetado, sincronización de assets web, copia de binarios e Inno Setup ISCC) ya está empaquetada y optimizada en build_windows.ps1.
- Si el script se ejecuta correctamente, confirma que el instalador "Instalar_Reciminsa_Windows_v1.16.1.exe" fue copiado en la carpeta "Desktop\instaladores rcapp\".
- Si el script arroja un error (por ejemplo, falta de Inno Setup o del workload de MAUI), MUESTRA EL ERROR AL USUARIO Y PÍDELE QUE INSTALE LA HERRAMIENTA CORRESPONDIENTE. No intentes modificar el código para "parchear" el error.
```
