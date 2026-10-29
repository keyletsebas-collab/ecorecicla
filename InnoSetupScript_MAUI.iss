[Setup]
AppName=Reciminsa
AppVersion=1.18.0
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
Source: "ReciminsaApp\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "runtimes\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"
Name: "{autodesktop}\Reciminsa App"; Filename: "{app}\Reciminsa.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"; Flags: unchecked

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando Microsoft WebView2 Runtime..."; Flags: runascurrentuser; Check: IsWebView2RuntimeNeeded
Filename: "{app}\Reciminsa.exe"; Description: "Ejecutar Reciminsa App"; Flags: nowait postinstall skipifsilent

[Code]
function IsWebView2RuntimeNeeded(): boolean;
var
  Version: string;
  RuntimeNeeded: boolean;
begin
  RuntimeNeeded := True;
  
  // Verificar en registro de 64 bits
  if RegQueryStringValue(HKLM64, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) then
  begin
    if (Version <> '') and (Version <> '0.0.0.0') then RuntimeNeeded := False;
  end;

  // Verificar en registro de 32 bits
  if RuntimeNeeded then
  begin
    if RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) then
    begin
      if (Version <> '') and (Version <> '0.0.0.0') then RuntimeNeeded := False;
    end;
  end;
  
  // Verificar en registro de usuario actual (HKCU)
  if RuntimeNeeded then
  begin
    if RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) then
    begin
      if (Version <> '') and (Version <> '0.0.0.0') then RuntimeNeeded := False;
    end;
  end;

  Result := RuntimeNeeded;
end;
