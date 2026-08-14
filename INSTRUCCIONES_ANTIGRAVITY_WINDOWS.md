# 🤖 Instrucciones para Antigravity (Compilación Windows + Inno Setup)

Copia y pega el bloque de texto gris de abajo directamente en tu chat con Antigravity en la computadora con Windows:

```text
Hola Antigravity. Por favor, ejecuta la compilación final de la aplicación Reciminsa App para Windows y genera su instalador formal con Inno Setup de forma 100% segura siguiendo estas instrucciones:

1. Abre una consola de PowerShell en la raíz de este proyecto.
2. Ejecuta "git pull origin main" para estar seguro de tener los últimos cambios del repositorio.
3. Ejecuta el script oficial de compilación automática que se encuentra en la raíz del proyecto:
   powershell -ExecutionPolicy Bypass -File .\build_windows.ps1

REGLAS STRICTAS E INVIOLABLES DE SEGURIDAD:
- Queda estrictamente PROHIBIDO modificar, editar o borrar archivos de código fuente (.cs, .xaml, .js, .html, .css, .csproj).
- Toda la lógica de compilación (.NET MAUI 10/9 Win32 desempaquetado, sincronización web, copia de binarios e Inno Setup ISCC) ya está empaquetada y optimizada en build_windows.ps1.
- Si el script se ejecuta correctamente, confirma que el instalador "Instalar_Reciminsa_Windows.exe" fue copiado en la carpeta "Desktop\instaladores rcapp\".
- Si el script arroja un error (por ejemplo, falta de Inno Setup o falta del workload de MAUI), MUESTRA EL ERROR AL USUARIO Y PÍDELE QUE INSTALE LA HERRAMIENTA CORRESPONDIENTE. No intentes modificar el código para "parchear" el error.
```

---

## 🛠️ ¿Qué hacer si en Windows falta alguna herramienta?

Si la terminal de Windows indica que falta alguna herramienta, ejecuta en **PowerShell como Administrador**:

1. **Instalar Git, .NET 10 e Inno Setup**:
   ```powershell
   winget install --id Git.Git -e --source winget; winget install --id Microsoft.DotNet.SDK.10 -e --source winget; winget install --id JRSoftware.InnoSetup -e --source winget
   ```

2. **Instalar Carga de Trabajo de .NET MAUI**:
   ```powershell
   dotnet workload install maui
   ```

3. **Registrar Inno Setup en el PATH de Windows**:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("PATH", [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";C:\Program Files (x86)\Inno Setup 6", "User")
   ```
