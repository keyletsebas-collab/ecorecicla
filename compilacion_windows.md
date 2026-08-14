# Guía de Compilación de Reciminsa App en Windows (.NET MAUI 10 / 9 + Inno Setup)

Este documento contiene las instrucciones exactas y el prompt seguro para **Antigravity** en Windows. 
Evita errores y modificaciones no deseadas en el código ejecutando el script automatizado.

---

## 🔗 Repositorio del Proyecto
* **URL de GitHub**: [https://github.com/keyletsebas-collab/ecorecicla.git](https://github.com/keyletsebas-collab/ecorecicla.git)
* **Rama Principal**: `main`

---

## 🛠️ Requisitos Previos en Windows (Instalación en 1 paso)

Si no tienes instaladas las herramientas en tu máquina Windows, abre **PowerShell como Administrador** y ejecuta:

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements; winget install --id Microsoft.DotNet.SDK.10 -e --source winget --accept-package-agreements; winget install --id JRSoftware.InnoSetup -e --source winget --accept-package-agreements
```

Luego instala el workload de MAUI:
```powershell
dotnet workload install maui
```

Y añade Inno Setup a las variables de entorno:
```powershell
[System.Environment]::SetEnvironmentVariable("PATH", [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";C:\Program Files (x86)\Inno Setup 6", "User")
```

---

## 🤖 Prompt para Antigravity (Windows)

Copia y pega este prompt exacto en Antigravity en tu equipo Windows:

```text
Por favor, ejecuta el proceso de compilación automática para Windows ejecutando el script oficial:

1. Abre una terminal de PowerShell en la raíz del proyecto.
2. Asegúrate de estar en la rama main: git pull origin main
3. Ejecuta el script de compilación automática sin modificar ningún archivo de código fuente (.cs, .js, .html):
   powershell -ExecutionPolicy Bypass -File .\build_windows.ps1

REGLAS STRICTAS PARA ANTIGRAVITY:
- NO modifiques ningún archivo en ReciminsaApp, js, css o index.html durante el proceso de compilación.
- Si el script encuentra algún error de compilación o falta de herramientas (ej. Inno Setup o Workload MAUI), reporta el error exacto sin alterar el código del proyecto.
```
