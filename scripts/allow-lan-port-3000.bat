@echo off
:: Batch script to allow inbound connections on port 3000 through Windows Firewall
:: Requires Administrator privileges.
echo ========================================================
echo   Kogane - Allow Inbound LAN Port 3000 in Windows Firewall
echo ========================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator permissions...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Adding Windows Defender Firewall inbound rule for TCP port 3000...
netsh advfirewall firewall delete rule name="Kogane LAN Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Kogane LAN Port 3000" dir=in action=allow protocol=TCP localport=3000
if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Windows Firewall now allows port 3000 for LAN devices (tablets, phones)!
    echo You can now access http://192.168.1.16:3000 from your phone and tablet.
) else (
    echo.
    echo [ERROR] Failed to add firewall rule. Please run this file as Administrator.
)

echo.
pause
