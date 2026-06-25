[Setup]
AppName=Reciminsa
AppVersion=1.0.13
DefaultDirName={autopf}\Reciminsa
DefaultGroupName=Reciminsa
OutputDir=C:\Users\keyle\OneDrive\Desktop\github
OutputBaseFilename=Instalar_Reciminsa_v1.0.13_MAUI
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=C:\Users\keyle\OneDrive\Desktop\Reciminsa app\ReciminsaApp\Resources\AppIcon\appicon.ico

[Files]
Source: "C:\Users\keyle\OneDrive\Desktop\Reciminsa app\ReciminsaApp\bin\Release\net8.0-windows10.0.19041.0\win10-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Reciminsa App"; Filename: "{app}\ReciminsaApp.exe"
Name: "{autodesktop}\Reciminsa App"; Filename: "{app}\ReciminsaApp.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"; Flags: unchecked

[Run]
Filename: "{app}\ReciminsaApp.exe"; Description: "Ejecutar Reciminsa App"; Flags: nowait postinstall skipifsilent
