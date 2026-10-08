@echo off
cd /d "%~dp0\.."
echo ========================================================
echo   Kogane - Instant Mobile Access Tunnel (Cloudflare)
echo ========================================================
echo.
echo Starting secure tunnel to your local server on port 3000...
echo.
set UNTUN_ACCEPT_CLOUDFLARE_NOTICE=1
bunx untun tunnel http://localhost:3000 --qr
pause
