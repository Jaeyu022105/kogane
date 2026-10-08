@echo off
setlocal
echo ========================================================
echo   Kogane - Configure Windows Autostart on Reboot
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set TARGET_BAT=%SCRIPT_DIR%start-server.bat
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_VBS=%TEMP%\CreateKoganeShortcut.vbs

echo Creating autostart shortcut in:
echo %STARTUP_FOLDER%
echo.

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SHORTCUT_VBS%"
echo sLinkFile = "%STARTUP_FOLDER%\Kogane POS Server.lnk" >> "%SHORTCUT_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SHORTCUT_VBS%"
echo oLink.TargetPath = "%TARGET_BAT%" >> "%SHORTCUT_VBS%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%.." >> "%SHORTCUT_VBS%"
echo oLink.Description = "Kogane Restaurant POS Server" >> "%SHORTCUT_VBS%"
echo oLink.Save >> "%SHORTCUT_VBS%"

cscript //nologo "%SHORTCUT_VBS%"
del "%SHORTCUT_VBS%" >nul 2>&1

if exist "%STARTUP_FOLDER%\Kogane POS Server.lnk" (
    echo [SUCCESS] Kogane POS Server will now automatically start whenever this PC boots!
) else (
    echo [ERROR] Failed to create startup shortcut.
)

echo.
pause
