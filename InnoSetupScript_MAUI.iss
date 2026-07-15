[Setup]
AppName=Reciminsa
AppVersion=1.16.0
DefaultDirName={autopf}\Reciminsa
DefaultGroupName=Reciminsa
OutputDir=.
OutputBaseFilename=reciminsaapp_pc_Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=ReciminsaApp\Resources\AppIcon\appicon.ico

[Files]
Source: "..\reciminsaapp windows port\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "Reciminsa app\*"
Source: "runtimes\windowsdesktop-runtime-8.0.8-win-x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "runtimes\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"
Name: "{autodesktop}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"; Flags: unchecked

[Run]
Filename: "{tmp}\windowsdesktop-runtime-8.0.8-win-x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalando .NET Desktop Runtime 8.0 (x64)..."; Flags: runascurrentuser
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando Microsoft WebView2 Runtime..."; Flags: runascurrentuser
Filename: "{app}\Reciminsa.exe"; Description: "Ejecutar Reciminsa App"; Flags: nowait postinstall skipifsilent
