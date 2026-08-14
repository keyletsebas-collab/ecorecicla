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
Source: "reciminsaapp windows port\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"
Name: "{autodesktop}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"; Flags: unchecked

[Run]
Filename: "{app}\Reciminsa.exe"; Description: "Ejecutar Reciminsa App"; Flags: nowait postinstall skipifsilent
