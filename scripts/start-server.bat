@echo off
cd /d "%~dp0\.."
echo ========================================================
echo   Kogane Restaurant Workstation POS - Production Server
echo ========================================================
echo.

set PORT=3000
set HOST=0.0.0.0
set NODE_ENV=production
set DEV_MODE=true

:: Find local IPv4 address
set LOCAL_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 2^>nul ^| findstr 0.0.0.0 ^| findstr /v "Default"') do (
    if not defined LOCAL_IP set LOCAL_IP=%%a
)

if not defined LOCAL_IP (
    for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.254*' -and $_.IPAddress -notlike '127.*' }).IPAddress | Select-Object -First 1" 2^>nul`) do (
        set LOCAL_IP=%%i
    )
)

echo Server Starting...
echo Counter / Admin PC:  http://localhost:%PORT%
if defined LOCAL_IP (
    echo Kitchen Tablets:     http://%LOCAL_IP%:%PORT%
    echo Cashier Phones:      http://%LOCAL_IP%:%PORT%
    set NUXT_PUBLIC_SHARE_ORIGIN=http://%LOCAL_IP%:%PORT%
) else (
    echo Kitchen Tablets:     http://localhost:%PORT%
)
echo.
echo Press Ctrl+C at any time to stop the server.
echo ========================================================
echo.

if exist ".output\server\index.mjs" (
    echo Running optimized production server...
    bun run .output/server/index.mjs
) else (
    echo Production build not found. Running dev server...
    bun --bun nuxt dev --host 0.0.0.0 --port 3000
)

pause
